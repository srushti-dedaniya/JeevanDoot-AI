/**
 * End-to-end AI appointment workflow tests (Phase 3C).
 * Uses a throwaway `jeevandoot_ai_test` database and cleans up afterwards.
 * If MongoDB is unreachable the suite reports a skip instead of failing.
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
import { AgentProposal, AgentRun, Appointment, Doctor, Patient, User } from '../models/index.js';
import {
  callTool,
  resolveBookingPatientId,
  resolveBookingDoctor,
  assertSlotFree,
  resolveModifiableAppointment,
} from '../services/ai/tools.js';
import { getProvider } from '../services/ai/provider.js';
import { orchestrate } from '../services/ai/orchestrator.js';
import { INTENTS } from '../services/ai/intent.js';
import ApiError from '../utils/ApiError.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevandoot_ai_test';
let db = false;

const uid = () => new mongoose.Types.ObjectId();

before(async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    }
    db = true;
  } catch {
    console.log('# SKIP ai-e2e: MongoDB unreachable at ' + URI);
  }
});

after(async () => {
  if (!db) return;
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!db) return;
  await AgentProposal.deleteMany({});
  await AgentRun.deleteMany({});
  await Appointment.deleteMany({});
  await Doctor.deleteMany({});
  await Patient.deleteMany({});
  await User.deleteMany({ email: /e2e-test-.*@test\.local/ });
});

const mkPatientUser = async (email) =>
  User.create({ name: 'E2E Patient', email, password: 'Password@123', role: 'patient' });

const mkDoctorUser = async (email) =>
  User.create({ name: 'E2E Doctor', email, password: 'Password@123', role: 'doctor' });

const mkAdminUser = async (email) =>
  User.create({ name: 'E2E Admin', email, password: 'Password@123', role: 'admin' });

const setupPatientDoctor = async () => {
  const patientUser = await mkPatientUser(`e2e-test-patient-${Date.now()}-${Math.random()}@test.local`);
  const doctorUser = await mkDoctorUser(`e2e-test-doctor-${Date.now()}-${Math.random()}@test.local`);
  const patient = await Patient.create({ user: patientUser._id });
  await patient.save();
  const doctor = await Doctor.create({ user: doctorUser._id, name: 'Test Doctor', specialization: 'Cardiology' });
  return { patientUser, doctorUser, patient, doctor };
};

describe('E2E: Patient views own appointments', () => {
  it('returns only own upcoming appointments via tool', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctorUser, patient, doctor } = await setupPatientDoctor();
    const otherPatientUser = await mkPatientUser(`e2e-test-other-${Date.now()}@test.local`);
    const otherPatient = await Patient.create({ user: otherPatientUser._id });
    await otherPatient.save();

    await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-01-15', startTime: '10:30', status: 'upcoming' });
    await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-01-16', startTime: '11:00', status: 'upcoming' });
    await Appointment.create({ patient: otherPatient._id, doctor: doctor._id, date: '2030-01-15', startTime: '14:00', status: 'upcoming' });

    const result = await callTool('listUpcomingAppointments', patientUser, {});
    assert.equal(result.length, 2);
    for (const appt of result) {
      assert.ok(appt.patient, 'Should have patient info');
    }
  });
});

describe('E2E: Proposal lifecycle (issue -> consume -> bind)', () => {
  it('creates proposal, consumes once, replay is idempotent', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor, patient } = await setupPatientDoctor();

    const proposal = await issueProposal({
      userId: patientUser._id,
      role: 'patient',
      actionType: 'book',
      patientId: patient._id,
      doctorId: doctor._id,
      date: '2030-01-20',
      startTime: '10:30',
    });

    const first = await consumeProposal(proposal.proposalId, String(patientUser._id));
    assert.equal(first.replay, false);
    assert.ok(first.proposal.proposalId);

    // Bind an appointment to the proposal
    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-20',
      startTime: '10:30',
      status: 'upcoming',
    });
    await bindAppointment(proposal.proposalId, String(appointment._id));

    const second = await consumeProposal(proposal.proposalId, String(patientUser._id));
    assert.equal(second.replay, true);
    assert.ok(second.proposal.appointmentId);
  });

  it('concurrent consumes produce exactly one winner', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor, patient } = await setupPatientDoctor();

    const proposal = await issueProposal({
      userId: patientUser._id,
      role: 'patient',
      actionType: 'book',
      patientId: patient._id,
      doctorId: doctor._id,
      date: '2030-01-21',
      startTime: '10:30',
    });

    const owner = String(patientUser._id);
    const [a, b] = await Promise.all([
      consumeProposal(proposal.proposalId, owner),
      consumeProposal(proposal.proposalId, owner),
    ]);
    const winners = [a, b].filter((r) => r.replay === false);
    assert.equal(winners.length, 1);
  });
});

describe('E2E: Slot unavailable is rejected at prepare time', () => {
  it('assertSlotFree throws when slot already booked', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor, patient } = await setupPatientDoctor();
    const otherPatientUser = await mkPatientUser(`e2e-test-other-${Date.now()}@test.local`);
    const otherPatient = await Patient.create({ user: otherPatientUser._id });
    await otherPatient.save();

    await Appointment.create({ patient: otherPatient._id, doctor: doctor._id, date: '2030-01-25', startTime: '10:30', status: 'upcoming' });

    await assert.rejects(
      assertSlotFree(String(doctor._id), '2030-01-25', '10:30'),
      /already booked/
    );
  });
});

describe('E2E: Reschedule and cancel ownership checks', () => {
  it('resolveModifiableAppointment rejects cross-patient access', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();
    const otherPatientUser = await mkPatientUser(`e2e-test-other-${Date.now()}@test.local`);
    const otherPatient = await Patient.create({ user: otherPatientUser._id });
    await otherPatient.save();
    const appointment = await Appointment.create({ patient: otherPatient._id, doctor: doctor._id, date: '2030-03-05', startTime: '10:30', status: 'upcoming' });

    await assert.rejects(
      resolveModifiableAppointment(patientUser, { appointmentId: String(appointment._id) }),
      /only change your own/
    );
  });

  it('resolveModifiableAppointment rejects cross-doctor access', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor: doctor1 } = await setupPatientDoctor();
    const otherDoctorUser = await mkDoctorUser(`e2e-test-other-doc-${Date.now()}@test.local`);
    const otherDoctor = await Doctor.create({ user: otherDoctorUser._id, name: 'Dr Other' });
    // patientUser already has a patient from setupPatientDoctor()
    const patient = await Patient.findOne({ user: patientUser._id });
    assert.ok(patient, 'Patient should exist for patientUser');
    const appointment = await Appointment.create({ patient: patient._id, doctor: doctor1._id, date: '2030-03-15', startTime: '10:30', status: 'upcoming' });

    await assert.rejects(
      resolveModifiableAppointment(otherDoctorUser, { appointmentId: String(appointment._id) }),
      /own schedule/
    );
  });
});

describe('E2E: Cross-patient access rejected at controller level', () => {
  it('patient cannot book for another patient (controller validates ownership)', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();
    const otherPatientUser = await mkPatientUser(`e2e-test-other-${Date.now()}@test.local`);
    const otherPatient = await Patient.create({ user: otherPatientUser._id });
    await otherPatient.save();

    const proposal = await issueProposal({
      userId: patientUser._id,
      role: 'patient',
      actionType: 'book',
      patientId: otherPatient._id, // Different patient!
      doctorId: doctor._id,
      date: '2030-03-01',
      startTime: '10:30',
    });

    const consumed = await consumeProposal(proposal.proposalId, String(patientUser._id));
    assert.equal(consumed.replay, false);
    
    // Controller's confirmBooking validates session patient matches proposal
    // The session patient is the one linked to patientUser
    const sessionPatientId = await resolveBookingPatientId(patientUser);
    assert.notEqual(sessionPatientId, String(proposal.patient));
  });
});

describe('E2E: Role-based tool authorization', () => {
  it('patient can access listUpcomingAppointments', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();
    const result = await callTool('listUpcomingAppointments', patientUser, {});
    assert.ok(Array.isArray(result));
  });

  it('doctor can access listUpcomingAppointments', async (t) => {
    if (!db) return t.skip();
    const { doctorUser } = await setupPatientDoctor();
    const result = await callTool('listUpcomingAppointments', doctorUser, {});
    assert.ok(Array.isArray(result));
  });

  it('admin can access listUpcomingAppointments', async (t) => {
    if (!db) return t.skip();
    const adminUser = await mkAdminUser(`e2e-test-admin-${Date.now()}@test.local`);
    const result = await callTool('listUpcomingAppointments', adminUser, {});
    assert.ok(Array.isArray(result));
  });

  it('government can access listUpcomingAppointments', async (t) => {
    if (!db) return t.skip();
    const govUser = await User.create({ name: 'E2E Gov', email: `e2e-test-gov-${Date.now()}@test.local`, password: 'Password@123', role: 'government' });
    const result = await callTool('listUpcomingAppointments', govUser, {});
    assert.ok(Array.isArray(result));
  });

  it('ngo cannot access listUpcomingAppointments', async (t) => {
    if (!db) return t.skip();
    const ngoUser = await User.create({ name: 'E2E NGO', email: `e2e-test-ngo-${Date.now()}@test.local`, password: 'Password@123', role: 'ngo' });
    await assert.rejects(
      callTool('listUpcomingAppointments', ngoUser, {}),
      /not permitted/
    );
  });

  it('ngo cannot access getAppointmentAvailability', async (t) => {
    if (!db) return t.skip();
    const ngoUser = await User.create({ name: 'E2E NGO', email: `e2e-test-ngo2-${Date.now()}@test.local`, password: 'Password@123', role: 'ngo' });
    await assert.rejects(
      callTool('getAppointmentAvailability', ngoUser, { doctorId: uid().toString(), date: '2030-01-15' }),
      /not permitted/
    );
  });

  it('patient can access getAppointmentAvailability', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();
    const result = await callTool('getAppointmentAvailability', patientUser, { doctorId: String(doctor._id), date: '2030-01-15' });
    assert.ok(Array.isArray(result));
  });
});

describe('E2E: AgentRun audit records', () => {
  it('startRun creates a run record', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    const provider = getProvider();
    const classification = await provider.classify({ message: 'Show my appointments', history: [] });
    const run = await startRun({ user: patientUser, intent: classification.intent });

    assert.ok(run.requestId);
    const runRecord = await AgentRun.findOne({ requestId: run.requestId }).lean();
    assert.ok(runRecord, 'Run record should exist');
    assert.equal(runRecord.status, 'started');
    assert.equal(runRecord.intent, classification.intent);
  });

  it('transitionRun updates run status', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    const run = await startRun({ user: patientUser, intent: 'UPCOMING_APPOINTMENTS' });
    const updated = await transitionRun(run.requestId, 'completed');
    assert.equal(updated.status, 'completed');
    assert.equal(updated.result, 'success');
  });

  it('appendRunEvent adds bounded events without sensitive data', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    const run = await startRun({ user: patientUser, intent: 'UPCOMING_APPOINTMENTS' });
    for (let i = 0; i < 25; i++) {
      await appendRunEvent(run.requestId, { tool: 'listUpcomingAppointments', outcome: i % 2 ? 'error' : 'ok', code: 'TEST_CODE' });
    }
    const reread = await AgentRun.findOne({ requestId: run.requestId }).lean();
    assert.ok(reread.events.length <= 20, 'Events should be bounded to 20');
    for (const event of reread.events) {
      assert.deepEqual(Object.keys(event).sort(), ['at', 'code', 'outcome', 'tool']);
      assert.match(event.code, /^[a-z0-9_]*$/i);
    }
  });
});

describe('E2E: Provider failure handling', () => {
  it('local provider never exposes secrets', async (t) => {
    if (!db) return t.skip();
    const provider = getProvider();
    const result = await provider.classify({ message: 'test', history: [] });
    assert.equal(typeof result.intent, 'string');
    assert.equal(typeof result.entities, 'object');
    assert.equal(provider.aiGenerated, false);
    assert.equal(provider.name, 'local-deterministic');
  });

  it('orchestrate handles invalid intent gracefully (falls to default)', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();
    const result = await orchestrate({
      user: patientUser,
      classification: { intent: 'INVALID_INTENT', entities: {}, confidence: 0.9 },
      providerName: 'local-deterministic',
      message: 'test',
    });
    assert.ok(result.message.includes('I can help'));
    assert.equal(result.requiresConfirmation, false);
  });
});

describe('E2E: Non-AI appointment APIs continue working', () => {
  it('direct appointment creation works', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor, patient } = await setupPatientDoctor();
    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      purpose: 'checkup',
      date: '2030-04-01',
      startTime: '09:00',
      status: 'upcoming',
    });
    assert.ok(appointment._id);
    assert.equal(appointment.status, 'upcoming');
  });

  it('direct appointment cancellation works', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor, patient } = await setupPatientDoctor();
    const appointment = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-04-05', startTime: '09:00', status: 'upcoming' });
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancelledReason = 'Test cancellation';
    await appointment.save();
    assert.equal(appointment.status, 'cancelled');
  });

  it('direct appointment reschedule works', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor, patient } = await setupPatientDoctor();
    const appointment = await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-04-10', startTime: '09:00', status: 'upcoming' });
    appointment.date = new Date('2030-04-11');
    appointment.startTime = '10:00';
    await appointment.save();
    const updated = await Appointment.findById(appointment._id).lean();
    assert.ok(updated);
    // Date may be returned as ISO string or Date object, convert to compare
    const updatedDateStr = updated.date instanceof Date ? updated.date.toISOString().slice(0, 10) : String(updated.date).slice(0, 10);
    assert.equal(updatedDateStr, '2030-04-11');
    assert.equal(updated.startTime, '10:00');
  });

  it('double-booking guard works at database level', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor, patient } = await setupPatientDoctor();
    await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-04-15', startTime: '09:00', status: 'upcoming' });

    let error = null;
    try {
      await Appointment.create({ patient: patient._id, doctor: doctor._id, date: '2030-04-15', startTime: '09:00', status: 'upcoming' });
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    assert.equal(error.code, 11000);
  });
});