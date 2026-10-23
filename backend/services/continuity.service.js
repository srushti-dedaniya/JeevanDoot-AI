/**
 * Care Continuity Rules Service (Phase 2 - Feature 3).
 *
 * Deterministic, explainable rules for care continuity insights.
 * Reads existing records only — never creates or invents clinical data.
 */

import {
  Appointment,
  Referral,
  Prescription,
  Consultation,
  MedicalReport,
  Patient,
} from '../models/index.js';
import { REFERRAL_DESTINATIONS } from '../models/Referral.js';

const INSIGHT_CATEGORIES = Object.freeze([
  'upcoming_appointment',
  'followup_due',
  'referral_pending',
  'care_plan_task_overdue',
  'missing_documentation',
]);

const INSIGHT_STATUSES = Object.freeze([
  'open',
  'reviewed',
  'resolved',
  'dismissed',
]);

const RULE_PRIORITIES = Object.freeze({
  high: 'high',
  medium: 'medium',
  low: 'low',
});

/**
 * Calculates days between two dates.
 */
const daysBetween = (from, to) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffTime = Math.abs(toDate - fromDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Checks if a date is in the past.
 */
const isPast = (dateStr, now = new Date()) => {
  const date = new Date(dateStr);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return date < today;
};

/**
 * Checks if a date is within the next N days.
 */
const isWithinDays = (dateStr, days, now = new Date()) => {
  const date = new Date(dateStr);
  const today = new Date(now);
  const future = new Date(now);
  future.setDate(today.getDate() + days);
  return date >= today && date <= future;
};

/**
 * Rule: Upcoming appointment requiring attention.
 */
const ruleUpcomingAppointment = async (patientId, now = new Date()) => {
  const appointments = await Appointment.find({
    patient: patientId,
    status: 'upcoming',
  })
    .sort({ date: 1, startTime: 1 })
    .populate('doctor', 'name specialization')
    .lean();

  const insights = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(today.getDate() + 3);

  for (const appt of appointments) {
    const apptDate = new Date(appt.date);
    apptDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((apptDate - today) / (1000 * 60 * 60 * 24));
    const isSoon = apptDate <= threeDaysFromNow;

    if (daysUntil === 0) {
      insights.push({
        ruleId: 'upcoming_appointment_today',
        category: 'upcoming_appointment',
        priority: RULE_PRIORITIES.high,
        patientId,
        sourceRecord: { type: 'Appointment', id: appt._id.toString() },
        title: 'Appointment today',
        explanation: `You have an appointment with ${appt.doctor?.name || 'your doctor'} today at ${appt.startTime}.`,
        evidence: {
          appointmentId: appt._id.toString(),
          appointmentDate: appt.date,
          appointmentTime: appt.startTime,
          doctor: appt.doctor?.name,
          specialization: appt.doctor?.specialization,
        },
        status: 'open',
        createdAt: now,
        recommendedAction: 'Attend your appointment or reschedule if needed.',
      });
    } else if (isSoon) {
      insights.push({
        ruleId: 'upcoming_appointment_soon',
        category: 'upcoming_appointment',
        priority: RULE_PRIORITIES.medium,
        patientId,
        sourceRecord: { type: 'Appointment', id: appt._id.toString() },
        title: `Appointment in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
        explanation: `You have an appointment with ${appt.doctor?.name || 'your doctor'} on ${appt.date} at ${appt.startTime}.`,
        evidence: {
          appointmentId: appt._id.toString(),
          appointmentDate: appt.date,
          appointmentTime: appt.startTime,
          doctor: appt.doctor?.name,
          specialization: appt.doctor?.specialization,
        },
        status: 'open',
        createdAt: now,
        recommendedAction: 'Prepare for your appointment or reschedule if needed.',
      });
    }
  }
  return insights;
};

/**
 * Rule: Follow-up due based on explicit follow-up date or care plan.
 * Uses Consultation.followUp field or explicit follow-up date.
 */
const ruleFollowupDue = async (patientId, now = new Date()) => {
  const insights = [];

  // Check consultations with followUp status
  const followupConsultations = await Consultation.find({
    patient: patientId,
    status: 'followUp',
  })
    .sort({ startedAt: -1 })
    .populate('doctor', 'name specialization')
    .lean();

  for (const consult of followupConsultations) {
    // Check if follow-up date has passed
    if (consult.startedAt && isPast(consult.startedAt, now)) {
      const daysOverdue = daysBetween(consult.startedAt, now);
      insights.push({
        ruleId: 'followup_overdue',
        category: 'followup_due',
        priority: RULE_PRIORITIES.high,
        patientId,
        sourceRecord: { type: 'Consultation', id: consult._id.toString() },
        title: 'Follow-up overdue',
        explanation: `A follow-up from ${consult.startedAt.toISOString().slice(0, 10)} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue.`,
        evidence: {
          consultationId: consult._id.toString(),
          consultationDate: consult.startedAt?.toISOString().slice(0, 10),
          doctor: consult.doctor?.name,
          specialization: consult.doctor?.specialization,
          complaint: consult.complaint,
          diagnosis: consult.diagnosis,
        },
        status: 'open',
        createdAt: now,
        recommendedAction: 'Schedule the follow-up appointment or contact your doctor.',
      });
    }
  }

  // Check for follow-up field in consultations (explicit follow-up date)
  const consultationsWithFollowup = await Consultation.find({
    patient: patientId,
    followUp: { $exists: true, $ne: null },
  }).lean();

  for (const consult of consultationsWithFollowup) {
    // This would need a followUp date field in the schema
    // Currently checking if followUp field exists but no date
  }

  return insights;
};

/**
 * Rule: Referral pending outcome beyond reasonable interval.
 */
const ruleReferralPending = async (patientId, now = new Date()) => {
  const insights = [];
  const pendingReferrals = await Referral.find({
    patient: patientId,
    status: { $in: ['sent', 'accepted'] },
  })
    .sort({ createdAt: -1 })
    .populate('doctor', 'name specialization')
    .lean();

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  for (const ref of pendingReferrals) {
    // Check if referral has been pending for more than 14 days
    if (ref.createdAt && new Date(ref.createdAt) < fourteenDaysAgo) {
      const daysPending = daysBetween(ref.createdAt, now);
      const destinationLabel = REFERRAL_DESTINATIONS.find(d => d.code === ref.destination)?.label || ref.destination;
      
      insights.push({
        ruleId: 'referral_pending_long',
        category: 'referral_pending',
        priority: RULE_PRIORITIES.medium,
        patientId,
        sourceRecord: { type: 'Referral', id: ref.referralId || ref._id.toString() },
        title: 'Referral pending outcome',
        explanation: `Referral to ${destinationLabel} (${ref.priority} priority) has been pending for ${daysPending} day${daysPending === 1 ? '' : 's'}.`,
        evidence: {
          referralId: ref.referralId,
          referralObjectId: ref._id.toString(),
          destination: destinationLabel,
          priority: ref.priority,
          reason: ref.reason,
          createdAt: ref.createdAt,
          status: ref.status,
        },
        status: 'open',
        createdAt: now,
        recommendedAction: 'Contact the referral destination or your doctor for an update.',
      });
    }
  }
  return insights;
};

/**
 * Rule: Care plan task overdue (if care plan model exists).
 * This is a placeholder for when care plan model is added.
 */
const ruleCarePlanTaskOverdue = async (patientId, now = new Date()) => {
  // Placeholder for future care plan model
  // Would check for tasks with due dates that have passed without completion
  return [];
};

/**
 * Rule: Missing documentation that requires human verification.
 * e.g., prescriptions without dispensing, consultations without diagnosis.
 */
const ruleMissingDocumentation = async (patientId, now = new Date()) => {
  const insights = [];

  // Prescriptions without dispensed status
  const undispensedPrescriptions = await Prescription.find({
    patient: patientId,
    status: 'active',
    dispensedAt: { $exists: false },
  })
    .populate('doctor', 'name specialization')
    .lean();

  for (const rx of undispensedPrescriptions) {
    const daysSinceIssued = rx.issuedAt ? daysBetween(rx.issuedAt, now) : 0;
    if (daysSinceIssued > 7) {
      insights.push({
        ruleId: 'prescription_not_dispensed',
        category: 'missing_documentation',
        priority: RULE_PRIORITIES.medium,
        patientId,
        sourceRecord: { type: 'Prescription', id: rx._id.toString() },
        title: 'Prescription not dispensed',
        explanation: `Prescription from ${rx.issuedAt?.toISOString().slice(0, 10)} has not been marked as dispensed after ${daysSinceIssued} days.`,
        evidence: {
          prescriptionId: rx.prescriptionId || rx._id.toString(),
          issuedAt: rx.issuedAt,
          doctor: rx.doctor?.name,
          diagnosis: rx.diagnosis,
          medicines: rx.medicines?.map(m => m.medicineName).join(', '),
        },
        status: 'open',
        createdAt: now,
        recommendedAction: 'Confirm dispensing with pharmacy or follow up with patient.',
      });
    }
  }

  // Consultations without diagnosis
  const consultationsWithoutDiagnosis = await Consultation.find({
    patient: patientId,
    status: 'completed',
    diagnosis: { $in: ['', null] },
  })
    .populate('doctor', 'name specialization')
    .lean();

  for (const consult of consultationsWithoutDiagnosis) {
    insights.push({
      ruleId: 'consultation_missing_diagnosis',
      category: 'missing_documentation',
      priority: RULE_PRIORITIES.low,
      patientId,
      sourceRecord: { type: 'Consultation', id: consult._id.toString() },
      title: 'Consultation missing diagnosis',
      explanation: `Completed consultation from ${consult.startedAt?.toISOString().slice(0, 10)} does not have a recorded diagnosis.`,
      evidence: {
        consultationId: consult._id.toString(),
        consultationDate: consult.startedAt?.toISOString().slice(0, 10),
        doctor: consult.doctor?.name,
        specialization: consult.doctor?.specialization,
        complaint: consult.complaint,
      },
      status: 'open',
      createdAt: now,
      recommendedAction: 'Add diagnosis to consultation record.',
    });
  }

  return insights;
};

/**
 * Main function to evaluate all continuity rules for a patient.
 */
export const evaluateContinuityRules = async (patientId, now = new Date()) => {
  const [
    upcomingAppts,
    followupDue,
    referralPending,
    carePlanTasks,
    missingDocs,
  ] = await Promise.all([
    ruleUpcomingAppointment(patientId, now),
    ruleFollowupDue(patientId, now),
    ruleReferralPending(patientId, now),
    ruleCarePlanTaskOverdue(patientId, now),
    ruleMissingDocumentation(patientId, now),
  ]);

  const allInsights = [
    ...upcomingAppts,
    ...followupDue,
    ...referralPending,
    ...carePlanTasks,
    ...missingDocs,
  ];

  // Sort by priority (high first), then by createdAt
  return allInsights.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};

export { INSIGHT_CATEGORIES as CONTINUITY_INSIGHT_CATEGORIES, INSIGHT_STATUSES };
export {
  ruleUpcomingAppointment,
  ruleFollowupDue,
  ruleReferralPending,
  ruleCarePlanTaskOverdue,
  ruleMissingDocumentation,
};