import mongoose from 'mongoose';

export const ESCALATION_TYPES = Object.freeze([
  'followup_overdue',
  'referral_pending_long',
  'care_plan_task_overdue',
  'missing_documentation',
  'continuity_task_unresolved',
  'appointment_upcoming',
  'appointment_today',
]);

export const ESCALATION_STATUSES = Object.freeze([
  'pending_review',
  'acknowledged',
  'in_progress',
  'resolved',
  'dismissed',
]);

export const ESCALATION_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

const escalationSchema = new mongoose.Schema(
  {
    escalationId: {
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
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: ESCALATION_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: ESCALATION_STATUSES,
      default: 'pending_review',
      index: true,
    },
    priority: {
      type: String,
      enum: ESCALATION_PRIORITIES,
      default: 'medium',
    },
    sourceEvent: {
      type: { type: String, enum: ['Consultation', 'Referral', 'Appointment', 'Prescription', 'Custom'] },
      id: { type: mongoose.Schema.Types.ObjectId, refPath: 'sourceEvent.type' },
      title: String,
      description: String,
      eventDate: Date,
    },
    reason: {
      type: String,
      required: true,
    },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resolution: {
      type: String,
      default: '',
    },
    dismissalReason: {
      type: String,
      default: '',
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
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
            'acknowledged',
            'in_progress',
            'resolved',
            'dismissed',
            'reopened',
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

escalationSchema.index({ patient: 1, status: 1 });
escalationSchema.index({ createdBy: 1, status: 1 });
escalationSchema.index({ reviewedBy: 1, status: 1 });

escalationSchema.pre('save', async function ensureId(next) {
  if (!this.escalationId) {
    const { generateEscalationId } = await import('../utils/generateId.js');
    this.escalationId = generateEscalationId();
  }
  return next();
});

export const Escalation = mongoose.model('Escalation', escalationSchema);
export default Escalation;