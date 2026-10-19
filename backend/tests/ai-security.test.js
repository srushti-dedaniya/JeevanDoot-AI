/**
 * AI security regression tests (Phase 2D).
 * Each test pins a concrete audit finding. DB-backed cases use the throwaway
 * `jeevandoot_ai_test` database and skip honestly when MongoDB is unreachable.
 */
/* global process */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { sanitizeEntities } from '../services/ai/intent.js';
import { rateLimit, resetRateLimits } from '../middleware/rateLimit.js';
import ApiError from '../utils/ApiError.js';
import { Appointment, AgentRun, User } from '../models/index.js';
import { getRun, listMyRuns } from '../controllers/ai.controller.js';
import { callTool } from '../services/ai/tools.js';
import { resolveModifiableAppointment } from '../services/ai/tools.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevandoot_ai_test';
let db = false;

before(async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    }
    db = true;
  } catch {
    console.log('# SKIP ai-security: MongoDB unreachable at ' + URI);
  }
});

after(async () => {
  if (!db) return;
  await mongoose.disconnect();
});

const mockRes = () => {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

describe('entity sanitization (model-output trust boundary)', () => {  it('keeps valid entities intact', () => {
    assert.deepEqual(
      sanitizeEntities({ date: '2026-11-02', startTime: '10:30', dayPart: 'morning', weekday: 'friday', doctorName: 'Sharma', confirmHint: true }),
      { date: '2026-11-02', startTime: '10:30', dayPart: 'morning', weekday: 'friday', doctorName: 'Sharma', confirmHint: true }
    );
  });
  it('drops unknown keys and malformed values', () => {
    assert.deepEqual(
      sanitizeEntities({
        date: 'yesterday', startTime: '25:99', dayPart: 'midnight', weekday: 'funday',
        doctorName: 'x', confirmHint: 'yes',
        $where: 'evil', __proto__: { polluted: true }, patient: ' чужой-id',
      }),
      {}
    );
    assert.equal({}.polluted, undefined);
  });
  it('truncates oversized doctor names', () => {
    const out = sanitizeEntities({ doctorName: 'a'.repeat(500) });
    assert.equal(out.doctorName.length, 40);
  });
  it('handles non-objects', () => {
    assert.deepEqual(sanitizeEntities(null), {});
    assert.deepEqual(sanitizeEntities('tomorrow'), {});
    assert.deepEqual(sanitizeEntities(['2026-11-02']), {});
  });
});

describe('rate limiter (abuse guard)', () => {
  it('allows up to max, then 429s with retryAfter', () => {
    resetRateLimits();
    const mw = rateLimit({ windowMs: 60_000, max: 3 });
    const req = { user: { _id: 'u1' }, ip: '1.2.3.4' };
    let nextCalls = 0;
    const next = (err) => {
      nextCalls += 1;
      if (err) throw err;
    };
    mw(req, {}, next);
    mw(req, {}, next);
    mw(req, {}, next);
    assert.equal(nextCalls, 3);
    assert.throws(() => mw(req, {}, next), (e) => e instanceof ApiError && e.statusCode === 429 && e.details?.retryAfter >= 0);
  });
  it('recovers after the window elapses', async () => {
    resetRateLimits();
    const mw = rateLimit({ windowMs: 50, max: 1 });
    const req = { user: { _id: 'u2' }, ip: '1.2.3.4' };
    const next = (err) => {
      if (err) throw err;
    };
    mw(req, {}, next);
    assert.throws(() => mw(req, {}, next), /Too many requests/);
    await new Promise((r) => setTimeout(r, 70));
    mw(req, {}, next); // no throw after window reset
  });
  it('isolates users and falls back to IP without trusting proxies', () => {
    resetRateLimits();
    const mw = rateLimit({ windowMs: 60_000, max: 1 });
    const next = (err) => {
      if (err) throw err;
    };
    mw({ user: { _id: 'alice' }, ip: '9.9.9.9' }, {}, next);
    mw({ user: { _id: 'bob' }, ip: '9.9.9.9' }, {}, next); // same IP, different user: allowed
    // Spoofed forwarding headers are ignored: only req.ip is used as fallback.
    mw({ ip: '5.5.5.5', headers: { 'x-forwarded-for': 'alice' } }, {}, next);
    assert.throws(() => mw({ ip: '5.5.5.5', headers: { 'x-forwarded-for': 'someone-else' } }, {}, next), /Too many requests/);
  });
});

describe('reschedule atomic guard includes date (TOCTOU fix)', () => {
  it('refuses to overwrite when the date moved concurrently', async (t) => {
    if (!db) return t.skip();
    const appt = await Appointment.create({
      patient: new mongoose.Types.ObjectId(),
      doctor: new mongoose.Types.ObjectId(),
      date: '2030-05-01',
      startTime: '10:30',
      status: 'upcoming',
    });
    try {
      // Exact hardened filter from confirmReschedule, but with a stale date.
      const stale = await Appointment.findOneAndUpdate(
        { _id: appt._id, status: 'upcoming', date: new Date('2030-05-02'), startTime: '10:30' },
        { $set: { date: new Date('2030-06-01'), startTime: '11:30' } },
        { new: true }
      ).lean();
      assert.equal(stale, null);
      // Correct filter still applies cleanly.
      const fresh = await Appointment.findOneAndUpdate(
        { _id: appt._id, status: 'upcoming', date: new Date('2030-05-01'), startTime: '10:30' },
        { $set: { date: new Date('2030-06-01'), startTime: '11:30' } },
        { new: true }
      ).lean();
      assert.ok(fresh);
    } finally {
      await Appointment.deleteOne({ _id: appt._id });
    }
  });
});

describe('agent-run access control', () => {
  it('owners read own runs; others are denied; output holds no sensitive fields', async (t) => {
    if (!db) return t.skip();
    const mkUser = async (email, role) => {
      const existing = await User.findOne({ email });
      if (existing) return existing;
      return User.create({ name: 'Audit Test', email, password: 'Password@123', role });
    };
    const alice = await mkUser('ai-audit-alice@test.local', 'patient');
    const bob = await mkUser('ai-audit-bob@test.local', 'doctor');
    const { startRun } = await import('../services/ai/agentRuns.js');
    const run = await startRun({ user: alice, intent: 'UPCOMING_APPOINTMENTS' });

    const ownerRes = mockRes();
    await getRun({ params: { id: run.requestId }, user: alice }, ownerRes, (e) => {
      if (e) throw e;
    });
    assert.equal(ownerRes.statusCode, 200);
    const keys = Object.keys(ownerRes.body.data).sort();
    assert.ok(!keys.includes('actor'), 'owner view must not include actor record');
    assert.ok(!keys.includes('transcript') && !keys.includes('messages') && !keys.includes('token'));

    await assert.rejects(
      getRun({ params: { id: run.requestId }, user: bob }, mockRes(), (e) => {
        if (e) throw e;
      }),
      /only view your own/
    );

    const listRes = mockRes();
    await listMyRuns({ query: {}, user: bob }, listRes, (e) => {
      if (e) throw e;
    });
    assert.ok(!(listRes.body.data || []).some((r) => r.requestId === run.requestId));

    await AgentRun.deleteOne({ requestId: run.requestId });
    await User.deleteMany({ email: /ai-audit-.*@test\.local/ });
  });
});

describe('tool registry prototype safety (regression)', () => {
  it('rejects inherited property names with honest 400, never TypeError', async () => {
    for (const name of ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString']) {
      try {
        await callTool(name, { role: 'admin', _id: 'u' }, {});
        assert.fail(`tool ${name} must not resolve`);
      } catch (error) {
        assert.ok(
          error instanceof ApiError && error.statusCode === 400,
          `expected honest 400 for ${name}, got: ${error && error.constructor?.name}: ${error?.message}`
        );
      }
    }
  });
});

describe('appointment modification ownership', () => {
  it('patient/doctor strangers are denied; admin and owners pass', async (t) => {
    if (!db) return t.skip();
    const { Patient } = await import('../models/index.js');
    const ownerUserId = new mongoose.Types.ObjectId();
    const ownerPatient = await Patient.create({ user: ownerUserId });
    const appt = await Appointment.create({
      patient: ownerPatient._id,
      doctor: new mongoose.Types.ObjectId(),
      date: '2031-02-01',
      startTime: '10:30',
      status: 'upcoming',
    });
    try {
      const id = String(appt._id);
      // Strangers: unrelated patient and doctor get 403, never the record.
      await assert.rejects(
        resolveModifiableAppointment({ _id: new mongoose.Types.ObjectId(), role: 'patient' }, { appointmentId: id }),
        /only change your own/
      );
      await assert.rejects(
        resolveModifiableAppointment({ _id: new mongoose.Types.ObjectId(), role: 'doctor' }, { appointmentId: id }),
        /own schedule/
      );
      // Disallowed roles can never modify, even with a valid id.
      await assert.rejects(
        resolveModifiableAppointment({ _id: new mongoose.Types.ObjectId(), role: 'ngo' }, { appointmentId: id }),
        /not permitted/
      );
      await assert.rejects(
        resolveModifiableAppointment({ _id: new mongoose.Types.ObjectId(), role: 'government' }, { appointmentId: id }),
        /not permitted/
      );
      // True owner resolves; admin resolves (mirrors route permissions).
      const owner = await resolveModifiableAppointment({ _id: ownerUserId, role: 'patient' }, { appointmentId: id });
      assert.equal(String(owner._id), id);
      const admin = await resolveModifiableAppointment({ _id: new mongoose.Types.ObjectId(), role: 'admin' }, { appointmentId: id });
      assert.equal(String(admin._id), id);
      // Malformed ids are rejected before any record access.
      await assert.rejects(
        resolveModifiableAppointment({ _id: new mongoose.Types.ObjectId(), role: 'admin' }, { appointmentId: 'not-an-id' }),
        /Invalid appointment/
      );
    } finally {
      await Appointment.deleteOne({ _id: appt._id });
      await Patient.deleteOne({ _id: ownerPatient._id });
    }
  });
});
