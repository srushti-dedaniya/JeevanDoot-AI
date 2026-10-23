import { Escalation } from '../models/index.js';
import { Consultation, Referral, Appointment, Prescription, Patient, Doctor, User } from '../models/index.js';
import { evaluateContinuityRules } from './continuity.service.js';
import { ROLES } from '../models/User.js';
import ApiError from '../utils/ApiError.js';

const VALID_TRANSITIONS = {
  pending_review: ['acknowledged', 'dismissed'],
  acknowledged: ['in_progress', 'dismissed'],
  in_progress: ['resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
};

const buildIdempotencyKey = (patientId, type, sourceEventId) => `${patientId}:${type}:${sourceEventId}`;

const generateEscalationReason = (insight) => {
  const reasons = {
    followup_due: `Follow-up overdue: ${insight.explanation}`,
    referral_pending: `Referral pending outcome: ${insight.explanation}`,
    care_plan_task_overdue: `Care plan task overdue: ${insight.explanation}`,
    missing_documentation: `Missing documentation: ${insight.explanation}`,
    continuity_task_unresolved: `Unresolved continuity task: ${insight.explanation}`,
  };
  return reasons[insight.category] || `Continuity issue: ${insight.explanation}`;
};

export const escalationService = {
  async createEscalation({
    patientId,
    createdBy,
    type,
    sourceEvent,
    reason,
    evidence,
    priority = 'medium',
  }) {
    const patient = await Patient.findById(patientId).lean();
    if (!patient) throw new ApiError(404, 'Patient not found.');

    const idempotencyKey = sourceEvent?.id ? buildIdempotencyKey(patientId, type, sourceEvent.id) : null;

    if (idempotencyKey) {
      const existing = await Escalation.findOne({ idempotencyKey }).lean();
      if (existing) {
        return { escalation: existing, duplicate: true };
      }
    }

    const eventData = {
      type: sourceEvent?.type || 'Custom',
      id: sourceEvent?.id || null,
      title: sourceEvent?.title || '',
      description: sourceEvent?.description || '',
      eventDate: sourceEvent?.eventDate || null,
    };

    const escalation = await Escalation.create({
      patient: patientId,
      createdBy,
      type,
      status: 'pending_review',
      priority,
      sourceEvent: eventData,
      reason,
      evidence,
      idempotencyKey,
      auditTrail: [{ action: 'created', performedBy: createdBy, details: { type, sourceEvent: eventData, reason } }],
    });

    return { escalation: escalation.toJSON(), duplicate: false };
  },

  async listEscalations({ patientId, createdBy, reviewedBy, status, page = 1, limit = 20 }) {
    const query = {};
    if (patientId) query.patient = patientId;
    if (createdBy) query.createdBy = createdBy;
    if (reviewedBy) query.reviewedBy = reviewedBy;
    if (status) query.status = status;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [items, total] = await Promise.all([
      Escalation.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('createdBy', 'name role')
        .populate('reviewedBy', 'name role')
        .populate('patient', 'personalInfo.fullName')
        .lean(),
      Escalation.countDocuments(query),
    ]);

    return {
      items,
      meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    };
  },

  async getEscalationById(escalationId) {
    return Escalation.findById(escalationId)
      .populate('createdBy', 'name role')
      .populate('reviewedBy', 'name role')
      .populate('patient', 'personalInfo.fullName')
      .lean();
  },

  async transitionStatus(escalationId, newStatus, userId, details = {}) {
    const escalation = await Escalation.findById(escalationId);
    if (!escalation) throw new ApiError(404, 'Escalation not found.');

    const allowed = VALID_TRANSITIONS[escalation.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(400, `Invalid status transition from ${escalation.status} to ${newStatus}.`);
    }

    const actionMap = {
      acknowledged: 'acknowledged',
      in_progress: 'in_progress',
      resolved: 'resolved',
      dismissed: 'dismissed',
    };

    escalation.status = newStatus;
    if (newStatus === 'acknowledged') escalation.acknowledgedAt = new Date();
    if (newStatus === 'resolved') escalation.resolvedAt = new Date();
    if (newStatus === 'dismissed') escalation.dismissedAt = new Date();

    escalation.reviewedBy = userId;

    if (details.resolution) escalation.resolution = details.resolution;
    if (details.dismissalReason) escalation.dismissalReason = details.dismissalReason;

    escalation.auditTrail.push({
      action: actionMap[newStatus] || newStatus,
      performedBy: userId,
      details,
    });

    await escalation.save();
    return escalation.toJSON();
  },

  async acknowledgeEscalation(escalationId, userId) {
    return this.transitionStatus(escalationId, 'acknowledged', userId);
  },

  async startProgress(escalationId, userId) {
    return this.transitionStatus(escalationId, 'in_progress', userId);
  },

  async resolveEscalation(escalationId, userId, resolution) {
    if (!resolution) throw new ApiError(400, 'Resolution reason is required.');
    return this.transitionStatus(escalationId, 'resolved', userId, { resolution });
  },

  async dismissEscalation(escalationId, userId, dismissalReason) {
    if (!dismissalReason) throw new ApiError(400, 'Dismissal reason is required.');
    return this.transitionStatus(escalationId, 'dismissed', userId, { dismissalReason });
  },

  async generateFromContinuityInsights(patientId, createdBy, insights) {
    const results = [];
    for (const insight of insights) {
      let type = null;
      let sourceEvent = null;
      let priority = 'medium';

      if (insight.category === 'upcoming_appointment') {
        type = insight.ruleId === 'upcoming_appointment_today' ? 'appointment_today' : 'appointment_upcoming';
        sourceEvent = {
          type: 'Appointment',
          id: insight.evidence?.appointmentId,
          title: insight.title,
          description: `${insight.evidence?.doctor || 'your doctor'} - ${insight.evidence?.appointmentTime || ''}`,
          eventDate: insight.evidence?.appointmentDate ? new Date(insight.evidence.appointmentDate) : null,
        };
        priority = insight.ruleId === 'upcoming_appointment_today' ? 'high' : 'medium';
      } else if (insight.category === 'followup_due') {
        type = 'followup_overdue';
        sourceEvent = {
          type: 'Consultation',
          id: insight.evidence?.consultationId,
          title: insight.title,
          description: insight.evidence?.doctor || '',
          eventDate: insight.evidence?.consultationDate ? new Date(insight.evidence.consultationDate) : null,
        };
        priority = 'high';
      } else if (insight.category === 'referral_pending') {
        type = 'referral_pending_long';
        sourceEvent = {
          type: 'Referral',
          id: insight.evidence?.referralObjectId || insight.evidence?.referralId,
          title: insight.title,
          description: insight.evidence?.destination || '',
          eventDate: insight.evidence?.createdAt ? new Date(insight.evidence.createdAt) : null,
        };
        priority = 'medium';
      } else if (insight.category === 'care_plan_task_overdue') {
        type = 'care_plan_task_overdue';
        sourceEvent = {
          type: 'Custom',
          id: insight.sourceRecord?.id,
          title: insight.title,
          description: insight.explanation,
          eventDate: insight.evidence?.createdAt ? new Date(insight.evidence.createdAt) : null,
        };
        priority = 'high';
      } else if (insight.category === 'missing_documentation') {
        type = 'missing_documentation';
        sourceEvent = {
          type: insight.evidence?.prescriptionId ? 'Prescription' : 'Consultation',
          id: insight.evidence?.prescriptionId || insight.evidence?.consultationId,
          title: insight.title,
          description: insight.explanation,
          eventDate: insight.evidence?.issuedAt ? new Date(insight.evidence.issuedAt) : (insight.evidence?.consultationDate ? new Date(insight.evidence.consultationDate) : null),
        };
        priority = insight.ruleId === 'prescription_not_dispensed' ? 'medium' : 'low';
      }

      if (type && sourceEvent) {
        try {
          const reason = generateEscalationReason(insight);
          const { escalation, duplicate } = await this.createEscalation({
            patientId,
            createdBy,
            type,
            sourceEvent,
            reason,
            evidence: insight.evidence,
            priority,
          });
          results.push({ insight, escalation, duplicate });
        } catch (error) {
          results.push({ insight, error: error.message });
        }
      }
    }
    return results;
  },

  async validateAuthorization(escalation, user) {
    try {
      // Check if user is the patient's user (patient owns the escalation)
      let isOwner = false;
      if (escalation.patient) {
        const patient = await Patient.findById(escalation.patient).lean();
        if (patient && patient.user) {
          isOwner = String(patient.user) === String(user._id);
        }
      }
      const isCreator = String(escalation.createdBy) === String(user._id);
      const isDoctor = user?.role === 'doctor';
      const isAdmin = user?.role === 'admin';

      if (isOwner || isCreator || isAdmin) return true;

      if (isDoctor) {
        const doctor = await Doctor.findOne({ user: user._id }).lean();
        if (!doctor) return false;
        const { Appointment, Referral, Consultation, Prescription } = await import('../models/index.js');
        const [hasAppointment, hasReferral, hasConsultation, hasPrescription] = await Promise.all([
          Appointment.exists({ patient: escalation.patient, doctor: doctor._id }),
          Referral.exists({ patient: escalation.patient, doctor: doctor._id }),
          Consultation.exists({ patient: escalation.patient, doctor: doctor._id }),
          Prescription.exists({ patient: escalation.patient, doctor: doctor._id }),
        ]);
        return Boolean(hasAppointment || hasReferral || hasConsultation || hasPrescription);
      }

      return false;
    } catch (error) {
      return false;
    }
  },
};
export default escalationService;