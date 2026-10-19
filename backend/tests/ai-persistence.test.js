/**
 * AI persistence tests — require a reachable MongoDB (uses a throwaway
 * `jeevandoot_ai_test` database and cleans up afterwards). If MongoDB is
 * unreachable the suite reports a skip instead of failing, so `npm test`
 * stays green in environments without a database.
 *
 * Covers: proposal survival across reads ("restart"), expiry + ownership,
 * concurrent consume (exactly one winner), idempotent replay, run lifecycle
 * with bounded append-only events, and stale-snapshot rejection logic.
 */
/* global process */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  issueProposal,
  peekProposal,
  consumeProposal,
  bindAppointment,
  markProposalFailed,
} from '../services/ai/proposals.js';
import {
  startRun,
  transitionRun,
  appendRunEvent,
} from '../services/ai/agentRuns.js';
import { snapshotMatches } from '../controllers/ai.controller.js';
import { AgentProposal, AgentRun } from '../models/index.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevandoot_ai_test';
let db = false;

before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    db = true;
    await AgentProposal.deleteMany({});
    await AgentRun.deleteMany({});
  } catch {
    console.log('# SKIP ai-persistence: MongoDB unreachable at ' + URI);
  }
});

beforeEach(async () => {
  if (!db) return;
  await AgentProposal.deleteMany({});
  await AgentRun.deleteMany({});
});

after(async () => {
  if (!db) return;
  await AgentProposal.deleteMany({});
  await AgentRun.deleteMany({});
  await mongoose.disconnect();
});

const uid = () => new mongoose.Types.ObjectId();
const base = () => ({
  userId: uid(),
  role: 'patient',
  actionType: 'book',
  patientId: uid(),
  doctorId: uid(),
  date: '2030-01-15',
  startTime: '10:30',
});

describe('persistent proposals', () => {
  it('survives process-level storage changes (fresh read)', async (t) => {
    if (!db) return t.skip();
    const issued = await issueProposal(base());
    assert.ok(issued.proposalId.startsWith('PAP-'));
    // A "restarted" process performs a fresh query — same document found.
    const reread = await peekProposal(issued.proposalId, String(issued.user));
    assert.equal(reread?.proposalId, issued.proposalId);
  });
  it('enforces ownership and expiry', async (t) => {
    if (!db) return t.skip();
    const issued = await issueProposal(base());
    assert.equal(await peekProposal(issued.proposalId, String(uid())), null);
    const expiring = await issueProposal({ ...base(), ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(await peekProposal(expiring.proposalId, String(expiring.user)), null);
    await assert.rejects(consumeProposal(expiring.proposalId, String(expiring.user)), /expired/);
    await assert.rejects(consumeProposal(issued.proposalId, String(uid())), /not valid for this session/);
  });
  it('exactly one winner on concurrent consume; replay is idempotent', async (t) => {
    if (!db) return t.skip();
    const issued = await issueProposal(base());
    const owner = String(issued.user);
    const [a, b] = await Promise.all([
      consumeProposal(issued.proposalId, owner),
      consumeProposal(issued.proposalId, owner),
    ]);
    const winners = [a, b].filter((r) => r.replay === false);
    assert.equal(winners.length, 1);
    await bindAppointment(issued.proposalId, uid());
    const replay = await consumeProposal(issued.proposalId, owner);
    assert.equal(replay.replay, true);
    assert.ok(replay.proposal.appointmentId);
  });
  it('failed proposals replay without side effects', async (t) => {
    if (!db) return t.skip();
    const issued = await issueProposal(base());
    await consumeProposal(issued.proposalId, String(issued.user));
    await markProposalFailed(issued.proposalId, 'conflict');
    const replay = await consumeProposal(issued.proposalId, String(issued.user));
    assert.equal(replay.replay, true);
  });
});

describe('persistent agent runs', () => {
  it('tracks lifecycle with valid transitions only', async (t) => {
    if (!db) return t.skip();
    const actor = { _id: uid(), role: 'patient' };
    const run = await startRun({ user: actor, intent: 'BOOK_APPOINTMENT' });
    assert.equal(run.status, 'started');
    const awaiting = await transitionRun(run.requestId, 'awaiting_confirmation');
    assert.equal(awaiting.status, 'awaiting_confirmation');
    const invalid = await transitionRun(run.requestId, 'started');
    assert.equal(invalid.status, 'awaiting_confirmation');
    const done = await transitionRun(awaiting.requestId, 'completed');
    assert.equal(done.status, 'completed');
    assert.equal(done.result, 'success');
    const terminal = await transitionRun(run.requestId, 'running');
    assert.equal(terminal.status, 'completed');
  });
  it('keeps a bounded append-only event ledger without sensitive data', async (t) => {
    if (!db) return t.skip();
    const actor = { _id: uid(), role: 'doctor' };
    const run = await startRun({ user: actor, intent: 'REFERRALS' });
    for (let i = 0; i < 25; i += 1) {
      await appendRunEvent(run.requestId, { tool: 'listAuthorizedReferrals', outcome: i % 2 ? 'error' : 'ok', code: '403 FORBIDDEN!! token=secret' });
    }
    const reread = await AgentRun.findOne({ requestId: run.requestId }).lean();
    assert.ok(reread.events.length <= 20);
    for (const event of reread.events) {
      assert.deepEqual(Object.keys(event).sort(), ['at', 'code', 'outcome', 'tool']);
      assert.match(event.code, /^[a-z0-9_]*$/i);
    }
    const doc = JSON.stringify(reread);
    assert.ok(!doc.includes('token=secret'));
  });
});

describe('stale-snapshot guard', () => {
  it('rejects proposals when the appointment changed since prepare', () => {
    const proposal = {
      snapshot: { status: 'upcoming', date: new Date('2030-01-15T00:00:00.000Z'), startTime: '10:30' },
    };
    const same = { status: 'upcoming', date: new Date('2030-01-15T00:00:00.000Z'), startTime: '10:30' };
    const moved = { status: 'upcoming', date: new Date('2030-01-16T00:00:00.000Z'), startTime: '10:30' };
    const cancelled = { status: 'cancelled', date: new Date('2030-01-15T00:00:00.000Z'), startTime: '10:30' };
    assert.equal(snapshotMatches(proposal, same), true);
    assert.equal(snapshotMatches(proposal, moved), false);
    assert.equal(snapshotMatches(proposal, cancelled), false);
  });
});
