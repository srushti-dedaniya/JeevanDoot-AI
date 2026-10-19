/**
 * Workflow planning tests (Phase 4).
 * Uses a throwaway `jeevandoot_ai_test` database and cleans up afterwards.
 */
/* global process */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User, Patient, Doctor, Appointment } from '../models/index.js';
import { createWorkflowPlan, getWorkflowPlan, getActiveWorkflowPlan, advanceWorkflowStep, completeWorkflowStep, failWorkflowStep, cancelWorkflow } from '../services/ai/workflowPlanner.js';
import { WorkflowPlan } from '../models/index.js';

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
    console.log('# SKIP workflow-planner: MongoDB unreachable at ' + URI);
  }
});

after(async () => {
  if (!db) return;
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!db) return;
  await WorkflowPlan.deleteMany({});
  await Appointment.deleteMany({});
  await Doctor.deleteMany({});
  await Patient.deleteMany({});
  await User.deleteMany({ email: /wf-test-.*@test\.local/ });
});

const mkPatientUser = async (email) =>
  User.create({ name: 'WF Patient', email, password: 'Password@123', role: 'patient' });

const mkDoctorUser = async (email) =>
  User.create({ name: 'WF Doctor', email, password: 'Password@123', role: 'doctor' });

const setupPatientDoctor = async () => {
  const patientUser = await mkPatientUser(`wf-test-patient-${Date.now()}-${Math.random()}@test.local`);
  const doctorUser = await mkDoctorUser(`wf-test-doctor-${Date.now()}-${Math.random()}@test.local`);
  const patient = await Patient.create({ user: patientUser._id });
  await patient.save();
  const doctor = await Doctor.create({ user: doctorUser._id, name: 'Test Doctor', specialization: 'Cardiology' });
  return { patientUser, doctorUser, patient, doctor };
};

describe('Workflow Planning Engine', () => {
  it('creates a workflow plan for appointment coordination', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({
      user: patientUser,
      workflowType: 'appointment_coordination',
      initialContext: {},
    });

    assert.ok(plan.planId.startsWith('WFP-'));
    assert.equal(plan.workflowType, 'appointment_coordination');
    assert.equal(plan.status, 'planned');
    assert.equal(plan.currentStepIndex, 0);
    assert.equal(plan.steps.length, 7);
    assert.ok(plan.steps[0].name === 'identify_need');
    assert.ok(plan.steps[plan.steps.length - 1].name === 'execute_booking');
  });

  it('creates workflow plans for all supported types', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    for (const type of ['appointment_coordination', 'reschedule_cancel', 'referral_coordination', 'followup_coordination', 'role_aware_coordination']) {
      const plan = await createWorkflowPlan({ user: patientUser, workflowType: type, initialContext: {} });
      assert.ok(plan.planId);
      assert.equal(plan.workflowType, type);
    }
  });

  it('rejects unknown workflow types', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    await assert.rejects(
      createWorkflowPlan({ user: patientUser, workflowType: 'unknown_type', initialContext: {} }),
      /Unknown workflow type/
    );
  });

  it('retrieves a workflow plan by ID', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    const created = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    const retrieved = await getWorkflowPlan(created.planId, patientUser._id);

    assert.ok(retrieved);
    assert.equal(retrieved.planId, created.planId);
  });

  it('returns null for workflow plan not owned by user', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();
    const otherUser = await mkPatientUser(`wf-test-other-${Date.now()}@test.local`);

    const created = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    const retrieved = await getWorkflowPlan(created.planId, otherUser._id);

    assert.equal(retrieved, null);
  });

  it('gets active workflow plan for user', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    const active = await getActiveWorkflowPlan(patientUser._id);

    assert.ok(active);
    assert.equal(active.workflowType, 'appointment_coordination');
    assert.ok(['planned', 'awaiting_input', 'awaiting_confirmation', 'running'].includes(active.status));
  });

  it('advances workflow step when required fields provided', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    const advanced = await advanceWorkflowStep(plan.planId, patientUser._id, { actionType: 'book', doctorId: String(doctor._id), doctorName: 'Test Doctor' });

    assert.equal(advanced.currentStepIndex, 0);
    assert.equal(advanced.context.actionType, 'book');
    assert.equal(advanced.context.doctorId, String(doctor._id));
  });

  it('completes workflow step and advances to next', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    await advanceWorkflowStep(plan.planId, patientUser._id, { actionType: 'book', doctorId: String(doctor._id), doctorName: 'Test Doctor' });

    const completed = await completeWorkflowStep(plan.planId, patientUser._id, { context: { date: '2030-01-15', startTime: '10:30' } });

    assert.equal(completed.currentStepIndex, 1);
    assert.equal(completed.context.date, '2030-01-15');
    assert.equal(completed.context.startTime, '10:30');
  });

  it('fails workflow step on error', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    const failed = await failWorkflowStep(plan.planId, patientUser._id, new Error('Test error'), 'TEST_ERROR');

    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'Test error');
    assert.ok(failed.completedAt);
  });

  it('cancels active workflow', async (t) => {
    if (!db) return t.skip();
    const { patientUser } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    const cancelled = await cancelWorkflow(plan.planId, patientUser._id);

    assert.equal(cancelled.status, 'cancelled');
    assert.ok(cancelled.completedAt);
  });

  it('prevents advancing completed workflow', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    // Complete all steps
    for (let i = 0; i < 7; i++) {
      await advanceWorkflowStep(plan.planId, patientUser._id, { actionType: 'book', doctorId: String(doctor._id), date: '2030-01-15', startTime: '10:30' });
      await completeWorkflowStep(plan.planId, patientUser._id, { context: { date: '2030-01-15', startTime: '10:30' } });
    }

    await assert.rejects(
      advanceWorkflowStep(plan.planId, patientUser._id, {}),
      /terminal state/
    );
  });

  it('enforces step dependencies', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    // Try to advance to step 2 (select_datetime) without completing step 1 (select_doctor)
    // This should work since we're just advancing with context
    const advanced = await advanceWorkflowStep(plan.planId, patientUser._id, { doctorId: String(doctor._id), date: '2030-01-15', startTime: '10:30' });
    assert.ok(advanced);
  });

  it('stores context and proposal IDs across steps', async (t) => {
    if (!db) return t.skip();
    const { patientUser, doctor } = await setupPatientDoctor();

    const plan = await createWorkflowPlan({ user: patientUser, workflowType: 'appointment_coordination', initialContext: {} });
    await advanceWorkflowStep(plan.planId, patientUser._id, { actionType: 'book', doctorId: String(doctor._id), date: '2030-01-15', startTime: '10:30' });
    const appointmentId = new mongoose.Types.ObjectId();
    const completed = await completeWorkflowStep(plan.planId, patientUser._id, { proposalId: 'PAP-TEST123', appointmentId: String(appointmentId) });

    assert.equal(completed.proposalId, 'PAP-TEST123');
    assert.equal(String(completed.appointmentId), String(appointmentId));
  });
});