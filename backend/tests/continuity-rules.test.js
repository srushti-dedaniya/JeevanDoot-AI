/**
 * Care Continuity Rules Service tests.
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
} from '../models/index.js';
import {
  evaluateContinuityRules,
  ruleUpcomingAppointment,
  ruleFollowupDue,
  ruleReferralPending,
  ruleCarePlanTaskOverdue,
  ruleMissingDocumentation,
} from '../services/continuity.service.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevandoot_ai_test';
let db = false;

before(async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    }
    db = true;
  } catch {
    console.log('# SKIP continuity-rules: MongoDB unreachable at ' + URI);
  }
});

after(async () => {
  if (!db) return;
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!db) return;
  await Appointment.deleteMany({});
  await Referral.deleteMany({});
  await Prescription.deleteMany({});
  await Consultation.deleteMany({});
  await Doctor.deleteMany({});
  await Patient.deleteMany({});
  await User.deleteMany({ email: /continuity-test-.*@test\.local/ });
});

const mkUser = async (email, role) => {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name: 'Continuity Test', email, password: 'Password@123', role });
};

// Fixed reference date for deterministic tests
const NOW = new Date('2026-10-13T10:00:00');

const formatDate = (date) => {
  return date.toISOString().slice(0, 10);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

describe('ruleUpcomingAppointment', () => {
  it('returns insight for appointment today', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient1@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc1@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test', specialization: 'Cardiology' });

    const today = NOW;
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(today),
      startTime: '10:00',
      status: 'upcoming',
    });

    const insights = await ruleUpcomingAppointment(String(patient._id), NOW);
    assert.equal(insights.length, 1);
    assert.equal(insights[0].ruleId, 'upcoming_appointment_today');
    assert.equal(insights[0].category, 'upcoming_appointment');
    assert.equal(insights[0].priority, 'high');
    assert.match(insights[0].title, /Appointment today/);
    assert.ok(insights[0].evidence.appointmentId);
    assert.equal(insights[0].evidence.doctor, 'Dr. Test');
  });

  it('returns insight for appointment within 3 days', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient2@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc2@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Soon', specialization: 'Neurology' });

    const inTwoDays = addDays(NOW, 2);
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(inTwoDays),
      startTime: '14:00',
      status: 'upcoming',
    });

    const insights = await ruleUpcomingAppointment(String(patient._id), NOW);
    assert.equal(insights.length, 1);
    assert.equal(insights[0].ruleId, 'upcoming_appointment_soon');
    assert.equal(insights[0].priority, 'medium');
    assert.match(insights[0].title, /Appointment in 2 days/);
  });

  it('does not return insight for appointment beyond 3 days', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient3@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc3@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Later', specialization: 'Dermatology' });

    const inTenDays = addDays(NOW, 10);
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(inTenDays),
      startTime: '10:00',
      status: 'upcoming',
    });

    const insights = await ruleUpcomingAppointment(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('does not return insight for cancelled appointments', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient4@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc4@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Cancelled', specialization: 'Pediatrics' });

    const today = new Date();
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(today),
      startTime: '10:00',
      status: 'cancelled',
    });

    const insights = await ruleUpcomingAppointment(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('returns no insights for patient with no appointments', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient5@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    const insights = await ruleUpcomingAppointment(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });
});

describe('ruleFollowupDue', () => {
  it('returns insight for overdue follow-up consultation', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient6@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc5@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Followup', specialization: 'Endocrinology' });

    const fiveDaysAgo = addDays(NOW, -5);
    await Consultation.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'followUp',
      startedAt: fiveDaysAgo,
      complaint: 'Diabetes check',
      diagnosis: 'Type 2 Diabetes',
    });

    const insights = await ruleFollowupDue(String(patient._id), NOW);
    assert.equal(insights.length, 1);
    assert.equal(insights[0].ruleId, 'followup_overdue');
    assert.equal(insights[0].category, 'followup_due');
    assert.equal(insights[0].priority, 'high');
    assert.match(insights[0].title, /Follow-up overdue/);
    assert.match(insights[0].explanation, /5 days? overdue/);
  });

  it('does not return insight for future follow-up consultation', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient7@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc6@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Future', specialization: 'Cardiology' });

    const inFiveDays = addDays(NOW, 5);
    await Consultation.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'followUp',
      startedAt: inFiveDays,
      complaint: 'Heart check',
      diagnosis: 'Hypertension',
    });

    const insights = await ruleFollowupDue(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('returns no insights for patient with no follow-up consultations', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient8@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    const insights = await ruleFollowupDue(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });
});

describe('ruleReferralPending', () => {
  it('returns insight for referral pending > 14 days', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient9@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc7@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Referrer', specialization: 'General Physician' });

    const twentyDaysAgo = addDays(NOW, -20);
    await Referral.create({
      patient: patient._id,
      doctor: doctor._id,
      destination: 'agh',
      priority: 'high',
      reason: 'Suspected cardiac issue',
      status: 'sent',
      createdAt: twentyDaysAgo,
    });

    const insights = await ruleReferralPending(String(patient._id), NOW);
    assert.equal(insights.length, 1);
    assert.equal(insights[0].ruleId, 'referral_pending_long');
    assert.equal(insights[0].category, 'referral_pending');
    assert.equal(insights[0].priority, 'medium');
    assert.match(insights[0].title, /Referral pending outcome/);
    assert.match(insights[0].explanation, /20 days?/);
  });

  it('does not return insight for referral pending < 14 days', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient10@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc8@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Recent', specialization: 'Orthopedics' });

    const fiveDaysAgo = addDays(NOW, -5);
    await Referral.create({
      patient: patient._id,
      doctor: doctor._id,
      destination: 'dcc',
      priority: 'normal',
      reason: 'Knee pain',
      status: 'sent',
      createdAt: fiveDaysAgo,
    });

    const insights = await ruleReferralPending(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('does not return insight for completed referral', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient11@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc9@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Completed', specialization: 'Radiology' });

    const twentyDaysAgo = addDays(NOW, -20);
    await Referral.create({
      patient: patient._id,
      doctor: doctor._id,
      destination: 'drr',
      priority: 'urgent',
      reason: 'Emergency scan',
      status: 'completed',
      createdAt: twentyDaysAgo,
    });

    const insights = await ruleReferralPending(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('returns no insights for patient with no referrals', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient12@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    const insights = await ruleReferralPending(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });
});

describe('ruleCarePlanTaskOverdue', () => {
  it('returns empty array (placeholder)', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient13@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    const insights = await ruleCarePlanTaskOverdue(String(patient._id));
    assert.equal(insights.length, 0);
    assert.deepEqual(insights, []);
  });
});

describe('ruleMissingDocumentation', () => {
  it('returns insight for prescription not dispensed after 7 days', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient14@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc10@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Prescriber', specialization: 'Psychiatry' });

    const tenDaysAgo = addDays(NOW, -10);
    await Prescription.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'active',
      issuedAt: tenDaysAgo,
      diagnosis: 'Anxiety',
      medicines: [{ medicineName: 'Sertraline', dosage: '50mg', frequency: 'Once daily', duration: '30 days' }],
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 1);
    assert.equal(insights[0].ruleId, 'prescription_not_dispensed');
    assert.equal(insights[0].category, 'missing_documentation');
    assert.equal(insights[0].priority, 'medium');
    assert.match(insights[0].title, /Prescription not dispensed/);
    assert.match(insights[0].explanation, /10 days?/);
  });

  it('does not return insight for prescription dispensed within 7 days', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient15@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc11@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Quick', specialization: 'General Physician' });

    const threeDaysAgo = addDays(NOW, -3);
    await Prescription.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'active',
      issuedAt: threeDaysAgo,
      diagnosis: 'Cold',
      medicines: [{ medicineName: 'Paracetamol', dosage: '500mg', frequency: 'Twice daily', duration: '5 days' }],
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('returns insight for completed consultation without diagnosis', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient16@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc12@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. NoDiag', specialization: 'Dermatology' });

    await Consultation.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'completed',
      startedAt: addDays(NOW, -2),
      complaint: 'Skin rash',
      diagnosis: '',
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 1);
    assert.equal(insights[0].ruleId, 'consultation_missing_diagnosis');
    assert.equal(insights[0].category, 'missing_documentation');
    assert.equal(insights[0].priority, 'low');
    assert.match(insights[0].title, /Consultation missing diagnosis/);
  });

  it('does not return insight for completed consultation with diagnosis', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient17@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc13@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. WithDiag', specialization: 'Cardiology' });

    await Consultation.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'completed',
      startedAt: addDays(NOW, -2),
      complaint: 'Chest pain',
      diagnosis: 'Angina',
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('returns no insights for patient with no missing documentation', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient18@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });
});

describe('evaluateContinuityRules', () => {
  it('aggregates insights from all rules', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient19@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc14@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Multi', specialization: 'Internal Medicine' });

    const today = new Date();
    const inTwoDays = addDays(NOW, 2);
    const fiveDaysAgo = addDays(NOW, -5);
    const twentyDaysAgo = addDays(NOW, -20);
    const tenDaysAgo = addDays(NOW, -10);

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
    await Prescription.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'active',
      issuedAt: tenDaysAgo,
      diagnosis: 'Diagnosis',
      medicines: [{ medicineName: 'Medicine', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }],
    });

    const insights = await evaluateContinuityRules(String(patient._id), NOW);
    assert.ok(insights.length >= 4);
    const categories = insights.map(i => i.category);
    assert.ok(categories.includes('upcoming_appointment'));
    assert.ok(categories.includes('followup_due'));
    assert.ok(categories.includes('referral_pending'));
    assert.ok(categories.includes('missing_documentation'));
  });

  it('sorts insights by priority (high first)', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient20@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc15@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Sort', specialization: 'General Physician' });

    const today = NOW;
    const inTwoDays = addDays(NOW, 2);

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(today),
      startTime: '10:00',
      status: 'upcoming',
    });
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(inTwoDays),
      startTime: '14:00',
      status: 'upcoming',
    });

    const insights = await evaluateContinuityRules(String(patient._id), NOW);
    assert.ok(insights.length >= 2);
    const priorities = insights.map(i => i.priority);
    assert.equal(priorities[0], 'high');
  });

  it('returns empty array for patient with no records', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient21@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    const insights = await evaluateContinuityRules(String(patient._id), NOW);
    assert.deepEqual(insights, []);
  });

  it('does not generate duplicate insights for same record', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient22@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc16@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Dup', specialization: 'General Physician' });

    const today = NOW;
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(today),
      startTime: '10:00',
      status: 'upcoming',
    });

    const insights1 = await evaluateContinuityRules(String(patient._id), NOW);
    const insights2 = await evaluateContinuityRules(String(patient._id), NOW);
    assert.equal(insights1.length, insights2.length);
    assert.equal(insights1[0].ruleId, insights2[0].ruleId);
  });
});

describe('Invalid or missing dates handling', () => {
  it('handles missing startedAt in followup consultation gracefully', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient23@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc17@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. NoDate', specialization: 'General Physician' });

    const consult = await Consultation.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'followUp',
      startedAt: null,
      complaint: 'No date',
      diagnosis: 'Condition',
    });

    const insights = await ruleFollowupDue(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('handles missing issuedAt in prescription gracefully', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient24@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc18@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. NoIssue', specialization: 'General Physician' });

    await Prescription.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'active',
      issuedAt: null,
      diagnosis: 'Diagnosis',
      medicines: [{ medicineName: 'Medicine', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }],
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('handles missing createdAt in referral gracefully', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient25@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc19@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. NoCreated', specialization: 'General Physician' });

    await Referral.create({
      patient: patient._id,
      doctor: doctor._id,
      destination: 'agh',
      priority: 'high',
      reason: 'Reason',
      status: 'sent',
      createdAt: null,
    });

    const insights = await ruleReferralPending(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });
});

describe('Completed or resolved tasks', () => {
  it('does not report completed appointment as upcoming', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient26@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc20@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Completed', specialization: 'General Physician' });

    const today = new Date();
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(today),
      startTime: '10:00',
      status: 'completed',
    });

    const insights = await ruleUpcomingAppointment(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('does not report dispensed prescription as missing', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient27@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc21@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Dispensed', specialization: 'General Physician' });

    const tenDaysAgo = addDays(NOW, -10);
    await Prescription.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'dispensed',
      issuedAt: tenDaysAgo,
      diagnosis: 'Diagnosis',
      medicines: [{ medicineName: 'Medicine', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }],
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('does not report completed consultation as missing diagnosis', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient28@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc22@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Completed', specialization: 'General Physician' });

    await Consultation.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'completed',
      startedAt: addDays(NOW, -2),
      complaint: 'Complaint',
      diagnosis: 'Diagnosis',
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });
});

describe('Boundary conditions', () => {
  it('handles appointment exactly 3 days out', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient29@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc23@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Boundary', specialization: 'General Physician' });

    const threeDaysOut = addDays(NOW, 3);
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: formatDate(threeDaysOut),
      startTime: '10:00',
      status: 'upcoming',
    });

    const insights = await ruleUpcomingAppointment(String(patient._id), NOW);
    assert.equal(insights.length, 1);
    assert.equal(insights[0].ruleId, 'upcoming_appointment_soon');
  });

  it('handles referral exactly 14 days pending', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient30@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc24@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Boundary', specialization: 'General Physician' });

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    await Referral.create({
      patient: patient._id,
      doctor: doctor._id,
      destination: 'agh',
      priority: 'high',
      reason: 'Reason',
      status: 'sent',
      createdAt: fourteenDaysAgo,
    });

    const insights = await ruleReferralPending(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });

  it('handles prescription exactly 7 days undispensed', async (t) => {
    if (!db) return t.skip();
    const patientUser = await mkUser('continuity-test-patient31@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });
    const doctorUser = await mkUser('continuity-test-doc25@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Boundary', specialization: 'General Physician' });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await Prescription.create({
      patient: patient._id,
      doctor: doctor._id,
      status: 'active',
      issuedAt: sevenDaysAgo,
      diagnosis: 'Diagnosis',
      medicines: [{ medicineName: 'Medicine', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }],
    });

    const insights = await ruleMissingDocumentation(String(patient._id), NOW);
    assert.equal(insights.length, 0);
  });
});

describe('Patient isolation', () => {
  it('does not leak insights across patients', async (t) => {
    if (!db) return t.skip();
    const patientUser1 = await mkUser('continuity-test-patient32@test.local', 'patient');
    const patient1 = await Patient.create({ user: patientUser1._id });
    const patientUser2 = await mkUser('continuity-test-patient33@test.local', 'patient');
    const patient2 = await Patient.create({ user: patientUser2._id });
    const doctorUser = await mkUser('continuity-test-doc26@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Shared', specialization: 'General Physician' });

    const today = NOW;
    await Appointment.create({
      patient: patient1._id,
      doctor: doctor._id,
      date: formatDate(today),
      startTime: '10:00',
      status: 'upcoming',
    });

    const insights1 = await evaluateContinuityRules(String(patient1._id), NOW);
    const insights2 = await evaluateContinuityRules(String(patient2._id), NOW);

    assert.equal(insights1.length, 1);
    assert.equal(insights2.length, 0);
  });
});