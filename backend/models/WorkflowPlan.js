import mongoose from 'mongoose';

export const WORKFLOW_TYPES = Object.freeze([
  'appointment_coordination',
  'reschedule_cancel',
  'referral_coordination',
  'followup_coordination',
  'role_aware_coordination',
]);

export const WORKFLOW_STATUSES = Object.freeze([
  'planned',
  'awaiting_input',
  'awaiting_confirmation',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const WORKFLOW_STEP_STATUSES = Object.freeze([
  'pending',
  'awaiting_input',
  'awaiting_confirmation',
  'running',
  'completed',
  'failed',
  'skipped',
]);

export const MAX_WORKFLOW_STEPS = 10;
export const MAX_TOOL_CALLS_PER_STEP = 5;
export const WORKFLOW_TIMEOUT_MS = 30 * 60 * 1000;

const workflowStepSchema = new mongoose.Schema(
  {
    stepIndex: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    dependsOn: [{ type: Number }],
    requiredFields: [{ type: String }],
    proposedAction: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: WORKFLOW_STEP_STATUSES,
      default: 'pending',
    },
    toolCalls: [{ type: mongoose.Schema.Types.Mixed }],
    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const workflowPlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      unique: true,
      index: true,
    },
    workflowType: {
      type: String,
      enum: WORKFLOW_TYPES,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: { type: String, required: true },
    status: {
      type: String,
      enum: WORKFLOW_STATUSES,
      default: 'planned',
      index: true,
    },
    steps: { type: [workflowStepSchema], default: [] },
    currentStepIndex: { type: Number, default: 0 },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    proposalId: { type: String, default: '' },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
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

workflowPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
workflowPlanSchema.index({ user: 1, status: 1 });

workflowPlanSchema.pre('save', async function ensureId(next) {
  if (!this.planId) {
    const { generateWorkflowPlanId } = await import('../utils/generateId.js');
    this.planId = generateWorkflowPlanId();
  }
  return next();
});

export const WorkflowPlan = mongoose.model('WorkflowPlan', workflowPlanSchema);
export default WorkflowPlan;