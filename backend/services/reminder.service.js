import { Reminder } from '../models/index.js';
import { Appointment, Consultation, Referral, Prescription, Patient, Doctor, User } from '../models/index.js';
import { notificationService } from './notification.service.js';
import { ROLES } from '../models/User.js';
import ApiError from '../utils/ApiError.js';

const VALID_TRANSITIONS = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'cancelled'],
  approved: ['sending', 'cancelled'],
  sending: ['sent', 'failed', 'delivery_unknown'],
  sent: [],
  failed: ['pending_approval', 'cancelled'],
  delivery_unknown: ['pending_approval', 'cancelled'],
  cancelled: [],
};

const buildIdempotencyKey = (patientId, type, sourceEventId) => `${patientId}:${type}:${sourceEventId}`;

const generateMessage = (type, event, recipientName) => {
  const templates = {
    appointment_upcoming: {
      subject: 'Upcoming Appointment Reminder',
      body: `Dear ${recipientName},\n\nThis is a reminder that you have an appointment scheduled for ${event.eventDate?.toLocaleDateString() || 'soon'} at ${event.description || ''}.\n\nPlease arrive 10 minutes before your scheduled time.\n\nBest regards,\nJeevanDoot Care Team`,
    },
    appointment_today: {
      subject: 'Appointment Today',
      body: `Dear ${recipientName},\n\nYou have an appointment today${event.description ? ` at ${event.description}` : ''}.\n\nPlease arrive 10 minutes before your scheduled time.\n\nBest regards,\nJeevanDoot Care Team`,
    },
    followup_overdue: {
      subject: 'Follow-up Appointment Overdue',
      body: `Dear ${recipientName},\n\nYour follow-up appointment from ${event.eventDate?.toLocaleDateString() || 'recently'} is overdue.\n\nPlease contact your doctor to schedule the follow-up as soon as possible.\n\nBest regards,\nJeevanDoot Care Team`,
    },
    followup_due: {
      subject: 'Follow-up Appointment Due',
      body: `Dear ${recipientName},\n\nYou have a follow-up appointment due${event.eventDate ? ` on ${event.eventDate.toLocaleDateString()}` : ''}.\n\nPlease schedule your follow-up with your doctor.\n\nBest regards,\nJeevanDoot Care Team`,
    },
    referral_pending: {
      subject: 'Referral Status Update',
      body: `Dear ${recipientName},\n\nYour referral to ${event.description || 'a specialist'} is still pending.\n\nPlease contact your doctor or the referral destination for an update.\n\nBest regards,\nJeevanDoot Care Team`,
    },
    prescription_renewal: {
      subject: 'Prescription Renewal Reminder',
      body: `Dear ${recipientName},\n\nYour prescription${event.description ? ` for ${event.description}` : ''} may need renewal.\n\nPlease consult your doctor for a renewal if needed.\n\nBest regards,\nJeevanDoot Care Team`,
    },
    custom: {
      subject: event.title || 'Reminder',
      body: event.description || 'You have a reminder.',
    },
  };

  const template = templates[type] || templates.custom;
  return {
    subject: template.subject,
    body: template.body,
    template: type,
    templateData: { recipientName, eventTitle: event.title, eventDate: event.eventDate, eventDescription: event.description },
  };
};

const getRecipientInfo = async (patientId, channel) => {
  const patient = await Patient.findById(patientId).populate('user').lean();
  if (!patient) return null;

  const user = patient.user;
  let contact = '';
  switch (channel) {
    case 'email':
      contact = user?.personalInfo?.email || patient.personalInfo?.email || '';
      break;
    case 'sms':
    case 'whatsapp':
      contact = user?.phone || patient.personalInfo?.phone || '';
      break;
    case 'in_app':
    default:
      contact = '';
  }

  return {
    userId: user?._id || null,
    name: patient.personalInfo?.fullName || user?.name || 'Patient',
    contact,
    channel,
  };
};

export const reminderService = {
  async createDraft({
    patientId,
    createdBy,
    type,
    sourceEvent,
    recipientOverride,
    channel = 'in_app',
    priority = 'medium',
    scheduledFor = null,
  }) {
    const patient = await Patient.findById(patientId).lean();
    if (!patient) throw new ApiError(404, 'Patient not found.');

    const idempotencyKey = sourceEvent?.id ? buildIdempotencyKey(patientId, type, sourceEvent.id) : null;

    if (idempotencyKey) {
      const existing = await Reminder.findOne({ idempotencyKey }).lean();
      if (existing) {
        return { reminder: existing, duplicate: true };
      }
    }

    const recipient = recipientOverride || (await getRecipientInfo(patientId, channel));
    if (!recipient?.userId) {
      throw new ApiError(400, 'Recipient user not found for this patient.');
    }

    if (channel !== 'in_app' && !recipient.contact) {
      throw new ApiError(400, `No ${channel} contact available for recipient.`);
    }

    const eventData = {
      type: sourceEvent?.type || 'Custom',
      id: sourceEvent?.id || null,
      title: sourceEvent?.title || '',
      description: sourceEvent?.description || '',
      eventDate: sourceEvent?.eventDate || null,
    };

    const message = generateMessage(type, eventData, recipient.name);

    const reminder = await Reminder.create({
      patient: patientId,
      createdBy,
      type,
      status: 'draft',
      priority,
      channel,
      sourceEvent: eventData,
      recipient,
      message,
      scheduledFor,
      idempotencyKey,
      auditTrail: [{ action: 'created', performedBy: createdBy, details: { type, sourceEvent: eventData } }],
    });

    return { reminder: reminder.toJSON(), duplicate: false };
  },

  async listReminders({ patientId, createdBy, status, page = 1, limit = 20 }) {
    const query = {};
    if (patientId) query.patient = patientId;
    if (createdBy) query.createdBy = createdBy;
    if (status) query.status = status;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [items, total] = await Promise.all([
      Reminder.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('createdBy', 'name role')
        .populate('approvedBy', 'name role')
        .populate('patient', 'personalInfo.fullName')
        .lean(),
      Reminder.countDocuments(query),
    ]);

    return {
      items,
      meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    };
  },

  async getReminderById(reminderId) {
    return Reminder.findById(reminderId)
      .populate('createdBy', 'name role')
      .populate('approvedBy', 'name role')
      .populate('patient', 'personalInfo.fullName')
      .lean();
  },

  async transitionStatus(reminderId, newStatus, userId, details = {}) {
    const reminder = await Reminder.findById(reminderId);
    if (!reminder) throw new ApiError(404, 'Reminder not found.');

    const allowed = VALID_TRANSITIONS[reminder.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(400, `Invalid status transition from ${reminder.status} to ${newStatus}.`);
    }

    const actionMap = {
      pending_approval: 'submitted_for_approval',
      approved: 'approved',
      cancelled: 'cancelled',
      sending: 'send_initiated',
      sent: 'sent',
      failed: 'delivery_failed',
      delivery_unknown: 'delivery_unknown',
    };

    reminder.status = newStatus;
    if (newStatus === 'approved') reminder.approvedBy = userId;
    if (newStatus === 'sent') reminder.sentAt = new Date();
    if (newStatus === 'failed') reminder.failedAt = new Date();
    if (newStatus === 'delivery_unknown') reminder.deliveredAt = null;

    reminder.auditTrail.push({
      action: actionMap[newStatus] || newStatus,
      performedBy: userId,
      details,
    });

    await reminder.save();
    return reminder;
  },

  async sendReminder(reminderId, userId) {
    const reminder = await Reminder.findById(reminderId);
    if (!reminder) throw new ApiError(404, 'Reminder not found.');

    if (reminder.status !== 'approved' && reminder.status !== 'failed' && reminder.status !== 'delivery_unknown') {
      throw new ApiError(400, `Cannot send reminder in status: ${reminder.status}`);
    }

    reminder.status = 'sending';
    reminder.auditTrail.push({ action: 'send_initiated', performedBy: userId });
    await reminder.save();

    try {
      let sent = false;
      let providerResponse = {};

      if (reminder.channel === 'in_app') {
        const user = await User.findById(reminder.recipient.userId).lean();
        if (user) {
          await notificationService.notify({
            userIds: [user._id],
            title: reminder.message.subject,
            description: reminder.message.body,
            type: 'appointment',
            meta: { reminderId: reminder._id.toString(), reminderType: reminder.type },
          });
          sent = true;
        }
      } else {
        reminder.providerResponse = { note: `Delivery via ${reminder.channel} not configured.`, channel: reminder.channel };
        sent = false;
      }

      if (sent) {
        reminder.status = 'sent';
        reminder.sentAt = new Date();
        reminder.auditTrail.push({ action: 'sent', performedBy: userId, details: { providerResponse } });
      } else {
        reminder.status = 'delivery_unknown';
        reminder.failedAt = new Date();
        reminder.failureReason = `Delivery via ${reminder.channel} not configured.`;
        reminder.auditTrail.push({ action: 'delivery_unknown', performedBy: userId, details: { reason: reminder.failureReason } });
      }

      await reminder.save();
      return reminder;
    } catch (error) {
      reminder.status = 'failed';
      reminder.failedAt = new Date();
      reminder.failureReason = error.message || 'Unknown error';
      reminder.auditTrail.push({ action: 'delivery_failed', performedBy: userId, details: { error: error.message } });
      await reminder.save();
      return reminder;
    }
  },

  async cancelReminder(reminderId, userId) {
    const reminder = await Reminder.findById(reminderId);
    if (!reminder) throw new ApiError(404, 'Reminder not found.');

    const allowed = VALID_TRANSITIONS[reminder.status] || [];
    if (!allowed.includes('cancelled')) {
      throw new ApiError(400, `Cannot cancel reminder in status: ${reminder.status}`);
    }

    reminder.status = 'cancelled';
    reminder.auditTrail.push({ action: 'cancelled', performedBy: userId });
    await reminder.save();
    return reminder;
  },

  async getUpcomingReminders(patientId, days = 7) {
    const future = new Date();
    future.setDate(future.getDate() + days);

    return Reminder.find({
      patient: patientId,
      status: { $in: ['draft', 'pending_approval', 'approved'] },
      scheduledFor: { $lte: future },
    })
      .sort({ scheduledFor: 1 })
      .lean();
  },

  async generateFromContinuityInsights(patientId, createdBy, insights) {
    const results = [];
    for (const insight of insights) {
      let type = null;
      let sourceEvent = null;
      let channel = 'in_app';

      if (insight.category === 'upcoming_appointment') {
        type = insight.ruleId === 'upcoming_appointment_today' ? 'appointment_today' : 'appointment_upcoming';
        sourceEvent = {
          type: 'Appointment',
          id: insight.evidence?.appointmentId,
          title: insight.title,
          description: `${insight.evidence?.doctor || 'your doctor'} - ${insight.evidence?.appointmentTime || ''}`,
          eventDate: insight.evidence?.appointmentDate ? new Date(insight.evidence.appointmentDate) : null,
        };
      } else if (insight.category === 'followup_due') {
        type = 'followup_overdue';
        sourceEvent = {
          type: 'Consultation',
          id: insight.evidence?.consultationId,
          title: insight.title,
          description: insight.evidence?.doctor || '',
          eventDate: insight.evidence?.consultationDate ? new Date(insight.evidence.consultationDate) : null,
        };
      } else if (insight.category === 'referral_pending') {
        type = 'referral_pending';
        sourceEvent = {
          type: 'Referral',
          id: insight.evidence?.referralObjectId || insight.evidence?.referralId,
          title: insight.title,
          description: insight.evidence?.destination || '',
          eventDate: insight.evidence?.createdAt ? new Date(insight.evidence.createdAt) : null,
        };
      } else if (insight.category === 'missing_documentation' && insight.ruleId === 'prescription_not_dispensed') {
        type = 'prescription_renewal';
        sourceEvent = {
          type: 'Prescription',
          id: insight.evidence?.prescriptionId,
          title: insight.title,
          description: insight.evidence?.medicines || '',
          eventDate: insight.evidence?.issuedAt ? new Date(insight.evidence.issuedAt) : null,
        };
      }

      if (type && sourceEvent) {
        try {
          const { reminder, duplicate } = await this.createDraft({
            patientId,
            createdBy,
            type,
            sourceEvent,
            channel,
          });
          results.push({ insight, reminder, duplicate });
        } catch (error) {
          results.push({ insight, error: error.message });
        }
      }
    }
    return results;
  },

  async validateAuthorization(reminder, user) {
    try {
      const isOwner = reminder.recipient?.userId && String(reminder.recipient.userId) === String(user._id);
      const isCreator = String(reminder.createdBy) === String(user._id);
      const isDoctor = user?.role === 'doctor';
      const isAdmin = user?.role === 'admin';

      if (isOwner || isCreator || isAdmin) return true;

      if (isDoctor) {
        const doctor = await Doctor.findOne({ user: user._id }).lean();
        if (!doctor) return false;
        const { Appointment, Referral, Consultation, Prescription } = await import('../models/index.js');
        const [hasAppointment, hasReferral, hasConsultation, hasPrescription] = await Promise.all([
          Appointment.exists({ patient: reminder.patient, doctor: doctor._id }),
          Referral.exists({ patient: reminder.patient, doctor: doctor._id }),
          Consultation.exists({ patient: reminder.patient, doctor: doctor._id }),
          Prescription.exists({ patient: reminder.patient, doctor: doctor._id }),
        ]);
        return Boolean(hasAppointment || hasReferral || hasConsultation || hasPrescription);
      }

      return false;
    } catch (error) {
      return false;
    }
  },
};

export default reminderService;