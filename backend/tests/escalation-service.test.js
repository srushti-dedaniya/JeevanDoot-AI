/**
 * Escalation Service tests.
 * Uses a throwaway `jeevandoot_ai_test` database and skips honestly when
 * MongoDB is unreachable.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  User,
  Doctor,
  Patient,
  Appointment,
  Referral,
  Prescription,
  Consultation,
  Escalation,
} from '../models/index.js';
import { escalationService } from '../services/escalation.service.js';
import { evaluateContinuityRules } from '../services/continuity.service.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevandoot_ai_test';
let db = false;

before(async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    }
    db = true;
  } catch {
    console.log('# SKIP escalation-service: MongoDB unreachable at ' + URI);
  }
});

after(async () => {
  if (!db) return;
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!db) return;
  await Escalation.deleteMany({});
  await Appointment.deleteMany({});
  await Referral.deleteMany({});
  await Prescription.deleteMany({});
  await Consultation.deleteMany({});
  await Doctor.deleteMany({});
  await Patient.deleteMany({});
  await User.deleteMany({ email: /escalation-test-.*@test\.local/ });
});

const mkUser = async (email, role) => {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name: 'Escalation Test', email, password: 'Password@123', role });
};

const formatDate = (date) => {
  return date.toISOString().slice(0, 10);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const NOW = new Date('2026-10-13T10:00:00');

describe('escalationService.createEscalation', () => {
  it('creates an escalation for followup_overdue', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient1@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc1@test.local', 'doctor');

    const { escalation, duplicate } = await escalationService.createEscalation({
      patientId: String(patient._id),
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      sourceEvent: {
        type: 'Consultation',
        id: new mongoose.Types.ObjectId(),
        title: 'Follow-up overdue',
        description: 'Dr. Test',
        eventDate: addDays(NOW, -5),
      },
      reason: 'Follow-up overdue',
      evidence: { consultationId: new mongoose.Types.ObjectId().toString() },
      priority: 'high',
    });

    assert.equal(duplicate, false);
    assert.ok(escalation);
    assert.equal(escalation.patient.toString(), patient._id.toString());
    assert.equal(escalation.createdBy.toString(), doctorUser._id.toString());
    assert.equal(escalation.type, 'followup_overdue');
    assert.equal(escalation.status, 'pending_review');
    assert.equal(escalation.priority, 'high');
    assert.ok(escalation.idempotencyKey);
  });

  it('prevents duplicate escalations for same event', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient2@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc2@test.local', 'doctor');

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctorUser._id,
      date: formatDate(addDays(NOW, 2)),
      startTime: '10:00',
      status: 'upcoming',
    });

    const { escalation: escalation1 } = await escalationService.createEscalation({
      patientId: String(patient._id),
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      sourceEvent: {
        type: 'Appointment',
        id: appointment._id,
        title: 'Test',
        description: 'Test',
        eventDate: addDays(NOW, 2),
      },
      reason: 'Test reason',
    });

    const { escalation: escalation2, duplicate } = await escalationService.createEscalation({
      patientId: String(patient._id),
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      sourceEvent: {
        type: 'Appointment',
        id: appointment._id,
        title: 'Test',
        description: 'Test',
        eventDate: addDays(NOW, 2),
      },
      reason: 'Test reason',
    });

    assert.equal(duplicate, true);
    const id1 = escalation1.id || escalation1._id?.toString();
    const id2 = escalation2.id || escalation2._id?.toString();
    assert.equal(id1, id2);
  });

  it('throws error when patient not found', async (t) => {
    if (!db) return t.skip();
    const doctorUser = await mkUser('escalation-test-doc3@test.local', 'doctor');

    try {
      await escalationService.createEscalation({
        patientId: new mongoose.Types.ObjectId().toString(),
        createdBy: doctorUser._id,
        type: 'followup_overdue',
        reason: 'Test',
      });
      assert.fail('Should have thrown 404');
    } catch (e) {
      assert.equal(e.statusCode, 404);
      assert.match(e.message, /Patient not found/);
    }
  });
});

describe('escalationService.listEscalations', () => {
  it('lists escalations for a patient', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient3@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc4@test.local', 'doctor');

    await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    const result = await escalationService.listEscalations({ patientId: String(patient._id) });
    assert.ok(result.items.length >= 1);
    const patientId = result.items[0].patient?._id?.toString() || result.items[0].patient?.toString();
    assert.equal(patientId, patient._id.toString());
    assert.ok(result.meta);
  });
});

describe('escalationService.transitionStatus', () => {
  it('allows valid status transitions', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient4@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc5@test.local', 'doctor');

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    let updated = await escalationService.transitionStatus(escalation._id, 'acknowledged', doctorUser._id);
    assert.equal(updated.status, 'acknowledged');
    assert.ok(updated.acknowledgedAt);

    updated = await escalationService.transitionStatus(updated.id, 'in_progress', doctorUser._id);
    assert.equal(updated.status, 'in_progress');

    updated = await escalationService.transitionStatus(updated.id, 'resolved', doctorUser._id, { resolution: 'Fixed' });
    assert.equal(updated.status, 'resolved');
    assert.ok(updated.resolvedAt);
    assert.equal(updated.resolution, 'Fixed');
  });

  it('rejects invalid status transitions', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient5@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc6@test.local', 'doctor');

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    try {
      await escalationService.transitionStatus(escalation._id, 'resolved', doctorUser._id);
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /Invalid status transition/);
    }
  });

  it('requires resolution reason when resolving', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient6@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc7@test.local', 'doctor');

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'in_progress',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    try {
      await escalationService.resolveEscalation(escalation._id, doctorUser._id, '');
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /Resolution reason is required/);
    }
  });

  it('requires dismissal reason when dismissing', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient7@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc8@test.local', 'doctor');

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    try {
      await escalationService.dismissEscalation(escalation._id, doctorUser._id, '');
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /Dismissal reason is required/);
    }
  });
});

describe('escalationService.validateAuthorization', () => {
  it('allows patient to access their own escalations', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient8@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc9@test.local', 'doctor');

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    const authorized = await escalationService.validateAuthorization(escalation, patientUser);
    assert.equal(authorized, true);
  });

  it('allows doctor with patient relationship to access escalations', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient9@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc10@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Authorized', specialization: 'Cardiology' });

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(addDays(NOW, 1)),
      startTime: '10:00',
      status: 'upcoming',
    });

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    const authorized = await escalationService.validateAuthorization(escalation, doctorUser);
    assert.equal(authorized, true);
  });

  it('denies doctor without patient relationship', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient10@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc11@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Unauthorized', specialization: 'Neurology' });

    const otherDoctorUser = await mkUser('escalation-test-otherdoc@test.local', 'doctor');
    const otherDoctor = await Doctor.create({ user: otherDoctorUser._id, name: 'Dr. Creator', specialization: 'Cardiology' });

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: otherDoctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    const authorized = await escalationService.validateAuthorization(escalation, doctorUser);
    assert.equal(authorized, false);
  });

  it('allows admin to access all escalations', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient11@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc12@test.local', 'doctor');
    const adminUser = await mkUser('escalation-test-admin@test.local', 'admin');

    const escalation = await Escalation.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'followup_overdue',
      status: 'pending_review',
      sourceEvent: { type: 'Custom', id: null, title: 'Test', description: 'Test', eventDate: null },
      reason: 'Test',
    });

    const authorized = await escalationService.validateAuthorization(escalation, adminUser);
    assert.equal(authorized, true);
  });
});

describe('escalationService.generateFromContinuityInsights', () => {
  it('generates escalations from continuity insights', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient12@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc13@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test', specialization: 'Cardiology' });

    // Use a date 2 days in the future to avoid timezone issues with "today"
    const inTwoDays = addDays(NOW, 2);
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(inTwoDays),
      startTime: '10:00',
      status: 'upcoming',
    });

    const insights = await evaluateContinuityRules(String(patient._id), NOW);
    assert.ok(insights.length >= 1);

    const results = await escalationService.generateFromContinuityInsights(String(patient._id), doctorUser._id, insights);
    assert.ok(results.length >= 1);
    const successful = results.filter(r => r.escalation && !r.duplicate);
    assert.ok(successful.length >= 1);
  });

  it('generates correct escalation types from different insight categories', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('escalation-test-patient13@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('escalation-test-doc14@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Multi', specialization: 'Internal Medicine' });

    const today = NOW;
    const inTwoDays = addDays(NOW, 2);
    const fiveDaysAgo = addDays(NOW, -5);
    const twentyDaysAgo = addDays(NOW, -20);

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(inTwoDays),
      startTime: '10:00',
      status: 'upcoming',
    });
    await Consultation.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'followUp',
      startedAt: fiveDaysAgo,
      complaint: 'Followup',
      diagnosis: 'Condition',
    });
    await Referral.create({
      patient: patient._id,
      doctor: doctor._id,
      destination: 'agh',
      priority: 'high',
      reason: 'Referral reason',
      status: 'sent',
      createdAt: twentyDaysAgo,
    });

    const insights = await evaluateContinuityRules(String(patient._id), NOW);
    const categories = insights.map(i => i.category);
    assert.ok(categories.includes('upcoming_appointment'));
    assert.ok(categories.includes('followup_due'));
    assert.ok(categories.includes('referral_pending'));

    // Ensure createdAt is set correctly for referral
    const referralInsights = insights.filter(i => i.category === 'referral_pending');
    assert.ok(referralInsights.length > 0, 'referral_pending insight should exist');
    const referralInsight = referralInsights[0];
    assert.ok(referralInsight.evidence?.referralObjectId, 'referral_pending insight should have referralObjectId in evidence');

    const results = await escalationService.generateFromContinuityInsights(String(patient._id), doctorUser._id, insights);
    const types = results.filter(r => r.escalation).map(r => r.escalation.type);
    assert.ok(types.includes('followup_overdue'), 'Should include followup_overdue');
    assert.ok(types.includes('referral_pending_long'), 'Should include referral_pending_long');
  });
});