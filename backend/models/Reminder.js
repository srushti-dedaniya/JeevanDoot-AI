import mongoose from 'mongoose';

export const REMINDER_TYPES = Object.freeze([
  'appointment_upcoming',
  'appointment_today',
  'followup_overdue',
  'followup_due',
  'referral_pending',
  'prescription_renewal',
  'custom',
]);

export const REMINDER_STATUSES = Object.freeze([
  'draft',
  'pending_approval',
  'approved',
  'sending',
  'sent',
  'failed',
  'delivery_unknown',
  'cancelled',
]);

export const REMINDER_CHANNELS = Object.freeze([
  'in_app',
  'email',
  'sms',
  'whatsapp',
]);

export const REMINDER_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

const reminderSchema = new mongoose.Schema(
  {
    reminderId: {
      type: String,
      unique: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: REMINDER_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: REMINDER_STATUSES,
      default: 'draft',
      index: true,
    },
    priority: {
      type: String,
      enum: REMINDER_PRIORITIES,
      default: 'medium',
    },
    channel: {
      type: String,
      enum: REMINDER_CHANNELS,
      default: 'in_app',
    },
    sourceEvent: {
      type: { type: String, enum: ['Appointment', 'Consultation', 'Referral', 'Prescription', 'Custom'] },
      id: { type: mongoose.Schema.Types.ObjectId, refPath: 'sourceEvent.type' },
      title: String,
      description: String,
      eventDate: Date,
    },
    recipient: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: String,
      contact: String,
      channel: String,
    },
    message: {
      subject: String,
      body: String,
      template: String,
      templateData: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    auditTrail: [
      {
        action: {
          type: String,
          enum: [
            'created',
            'submitted_for_approval',
            'approved',
            'rejected',
            'cancelled',
            'send_initiated',
            'sent',
            'delivery_confirmed',
            'delivery_failed',
            'delivery_unknown',
            'retried',
          ],
        },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedAt: { type: Date, default: Date.now },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

reminderSchema.index({ patient: 1, status: 1 });
reminderSchema.index({ createdBy: 1, status: 1 });
reminderSchema.index({ scheduledFor: 1, status: 1 });

reminderSchema.pre('save', async function ensureId(next) {
  if (!this.reminderId) {
    const { generateReminderId } = await import('../utils/generateId.js');
    this.reminderId = generateReminderId();
  }
  return next();
});

export const Reminder = mongoose.model('Reminder', reminderSchema);
export default Reminder;