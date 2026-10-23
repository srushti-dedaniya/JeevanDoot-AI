/**
 * Reminder Service tests.
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
  Reminder,
} from '../models/index.js';
import { reminderService } from '../services/reminder.service.js';
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
    console.log('# SKIP reminder-service: MongoDB unreachable at ' + URI);
  }
});

after(async () => {
  if (!db) return;
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!db) return;
  await Reminder.deleteMany({});
  await Appointment.deleteMany({});
  await Referral.deleteMany({});
  await Prescription.deleteMany({});
  await Consultation.deleteMany({});
  await Doctor.deleteMany({});
  await Patient.deleteMany({});
  await User.deleteMany({ email: /reminder-test-.*@test\.local/ });
});

const mkUser = async (email, role) => {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name: 'Reminder Test', email, password: 'Password@123', role });
};

const formatDate = (date) => {
  return date.toISOString().slice(0, 10);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Fixed reference date for deterministic tests
const NOW = new Date('2026-10-13T10:00:00');

describe('reminderService.createDraft', () => {
  it('creates a reminder draft for appointment_upcoming', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient1@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc1@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test', specialization: 'Cardiology' });

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(addDays(NOW, 2)),
      startTime: '10:00',
      status: 'upcoming',
    });

    const { reminder, duplicate } = await reminderService.createDraft({
      patientId: String(patient._id),
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      sourceEvent: {
        type: 'Appointment',
        id: appointment._id,
        title: 'Appointment with Dr. Test',
        description: 'Cardiology consultation',
        eventDate: addDays(NOW, 2),
      },
    });

    assert.equal(duplicate, false);
    assert.ok(reminder);
    assert.equal(reminder.patient.toString(), patient._id.toString());
    assert.equal(reminder.createdBy.toString(), doctorUser._id.toString());
    assert.equal(reminder.type, 'appointment_upcoming');
    assert.equal(reminder.status, 'draft');
    assert.equal(reminder.channel, 'in_app');
    assert.ok(reminder.message.subject);
    assert.ok(reminder.message.body);
    assert.ok(reminder.idempotencyKey);
  });

  it('prevents duplicate reminder drafts for same event', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient2@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc2@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test2', specialization: 'Neurology' });

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(addDays(NOW, 2)),
      startTime: '10:00',
      status: 'upcoming',
    });

    const { reminder: reminder1, duplicate: dup1 } = await reminderService.createDraft({
      patientId: String(patient._id),
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      sourceEvent: {
        type: 'Appointment',
        id: appointment._id,
        title: 'Appointment with Dr. Test2',
        description: 'Neurology consultation',
        eventDate: addDays(NOW, 2),
      },
    });

    assert.equal(dup1, false);
    assert.ok(reminder1.id || reminder1._id);

    const { reminder: reminder2, duplicate } = await reminderService.createDraft({
      patientId: String(patient._id),
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      sourceEvent: {
        type: 'Appointment',
        id: appointment._id,
        title: 'Appointment with Dr. Test2',
        description: 'Neurology consultation',
        eventDate: addDays(NOW, 2),
      },
    });

    assert.equal(duplicate, true);
    const id1 = reminder1.id || reminder1._id?.toString();
    const id2 = reminder2.id || reminder2._id?.toString();
    assert.equal(id1, id2);
  });

  it('throws error when patient not found', async (t) => {
    if (!db) return t.skip();
    const doctorUser = await mkUser('reminder-test-doc3@test.local', 'doctor');

    try {
      await reminderService.createDraft({
        patientId: new mongoose.Types.ObjectId().toString(),
        createdBy: doctorUser._id,
        type: 'appointment_upcoming',
      });
      assert.fail('Should have thrown 404');
    } catch (e) {
      assert.equal(e.statusCode, 404);
      assert.match(e.message, /Patient not found/);
    }
  });

  it('throws error when no contact for non-in_app channel', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient3@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    try {
      await reminderService.createDraft({
        patientId: String(patient._id),
        createdBy: patientUser._id,
        type: 'appointment_upcoming',
        channel: 'email',
      });
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /No email contact available/);
    }
  });
});

describe('reminderService.listReminders', () => {
  it('lists reminders for a patient', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient4@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc4@test.local', 'doctor');

    await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    const result = await reminderService.listReminders({ patientId: String(patient._id) });
    assert.ok(result.items.length >= 1);
    const patientId = result.items[0].patient?._id?.toString() || result.items[0].patient?.toString();
    assert.equal(patientId, patient._id.toString());
    assert.ok(result.meta);
  });
});

describe('reminderService.transitionStatus', () => {
  it('allows valid status transitions', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient5@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc5@test.local', 'doctor');

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    // draft -> pending_approval
    let updated = await reminderService.transitionStatus(reminder._id, 'pending_approval', doctorUser._id);
    assert.equal(updated.status, 'pending_approval');

    // pending_approval -> approved
    updated = await reminderService.transitionStatus(updated._id, 'approved', doctorUser._id);
    assert.equal(updated.status, 'approved');
    assert.ok(updated.approvedBy);

    // approved -> sending
    updated = await reminderService.transitionStatus(updated._id, 'sending', doctorUser._id);
    assert.equal(updated.status, 'sending');

    // sending -> sent
    updated = await reminderService.transitionStatus(updated._id, 'sent', doctorUser._id);
    assert.equal(updated.status, 'sent');
    assert.ok(updated.sentAt);
  });

  it('rejects invalid status transitions', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient6@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc6@test.local', 'doctor');

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    try {
      await reminderService.transitionStatus(reminder._id, 'approved', doctorUser._id);
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /Invalid status transition/);
    }
  });

  it('allows cancellation from draft', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient7@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc7@test.local', 'doctor');

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    const updated = await reminderService.cancelReminder(reminder._id, doctorUser._id);
    assert.equal(updated.status, 'cancelled');
  });
});

describe('reminderService.sendReminder', () => {
  it('sends in-app reminder successfully', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient8@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc8@test.local', 'doctor');

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'approved',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test message' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
      approvedBy: doctorUser._id,
    });

    const updated = await reminderService.sendReminder(reminder._id, doctorUser._id);
    assert.ok(['sent', 'delivery_unknown'].includes(updated.status));
  });

  it('rejects sending non-approved reminder', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient9@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc9@test.local', 'doctor');

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test message' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    try {
      await reminderService.sendReminder(reminder._id, doctorUser._id);
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /Cannot send reminder in status/);
    }
  });
});

describe('reminderService.generateFromContinuityInsights', () => {
  it('generates reminders from continuity insights', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient10@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc10@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test', specialization: 'Cardiology' });

    const today = NOW;
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(today),
      startTime: '10:00',
      status: 'upcoming',
    });

    const insights = await evaluateContinuityRules(String(patient._id), NOW);
    assert.ok(insights.length >= 1);

    const results = await reminderService.generateFromContinuityInsights(String(patient._id), doctorUser._id, insights);
    assert.ok(results.length >= 1);
    const successful = results.filter(r => r.reminder && !r.duplicate);
    assert.ok(successful.length >= 1);
  });

  it('generates correct reminder types from different insight categories', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient11@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc11@test.local', 'doctor');
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
    const referral = await Referral.create({
      patient: patient._id,
      doctor: doctor._id,
      destination: 'agh',
      priority: 'high',
      reason: 'Referral reason',
      status: 'sent',
      createdAt: twentyDaysAgo,
    });

    // Ensure createdAt is set correctly (Mongoose timestamps might override)
    if (referral.createdAt.getTime() !== twentyDaysAgo.getTime()) {
      await Referral.findByIdAndUpdate(referral._id, { createdAt: twentyDaysAgo });
    }

    const insights = await evaluateContinuityRules(String(patient._id), NOW);
    const categories = insights.map(i => i.category);
    assert.ok(categories.includes('upcoming_appointment'));
    assert.ok(categories.includes('followup_due'));
    assert.ok(categories.includes('referral_pending'));

    // Debug: log insights and their evidence
    const referralInsights = insights.filter(i => i.category === 'referral_pending');
    assert.ok(referralInsights.length > 0, 'referral_pending insight should exist');
    const referralInsight = referralInsights[0];
    assert.ok(referralInsight.evidence?.referralId, 'referral_pending insight should have referralId in evidence');
    assert.equal(referralInsight.category, 'referral_pending', 'insight category should be referral_pending');

    const results = await reminderService.generateFromContinuityInsights(String(patient._id), doctorUser._id, insights);
    const referralResults = results.filter(r => r.insight && r.insight.category === 'referral_pending');
    const types = results.filter(r => r.reminder).map(r => r.reminder.type);
    assert.ok(types.includes('appointment_upcoming') || types.includes('appointment_today'));
    assert.ok(types.includes('followup_overdue'));
    assert.ok(types.includes('referral_pending'), `Expected referral_pending in types, got: ${JSON.stringify(types)}. Referral results: ${JSON.stringify(referralResults.map(r => ({ type: r.reminder?.type, error: r.error })))}`);
  });
});

describe('reminderService.validateAuthorization', () => {
  it('allows patient to access their own reminders', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient12@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc12@test.local', 'doctor');

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    const authorized = await reminderService.validateAuthorization(reminder, patientUser);
    assert.equal(authorized, true);
  });

  it('allows doctor with patient relationship to access reminders', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient13@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc13@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Authorized', specialization: 'Cardiology' });

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(addDays(NOW, 1)),
      startTime: '10:00',
      status: 'upcoming',
    });

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    const authorized = await reminderService.validateAuthorization(reminder, doctorUser);
    assert.equal(authorized, true);
  });

  it('denies doctor without patient relationship', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient14@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc14@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Unauthorized', specialization: 'Neurology' });

    // Create reminder with a DIFFERENT doctor as creator
    const otherDoctorUser = await mkUser('reminder-test-otherdoc@test.local', 'doctor');
    const otherDoctor = await Doctor.create({ user: otherDoctorUser._id, name: 'Dr. Creator', specialization: 'Cardiology' });

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: otherDoctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    const authorized = await reminderService.validateAuthorization(reminder, doctorUser);
    assert.equal(authorized, false);
  });

  it('allows admin to access all reminders', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('reminder-test-patient15@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('reminder-test-doc15@test.local', 'doctor');
    const adminUser = await mkUser('reminder-test-admin@test.local', 'admin');

    const reminder = await Reminder.create({
      patient: patient._id,
      createdBy: doctorUser._id,
      type: 'appointment_upcoming',
      status: 'draft',
      channel: 'in_app',
      message: { subject: 'Test', body: 'Test' },
      recipient: { userId: patientUser._id, name: 'Test Patient', contact: '', channel: 'in_app' },
    });

    const authorized = await reminderService.validateAuthorization(reminder, adminUser);
    assert.equal(authorized, true);
  });
});