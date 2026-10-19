import mongoose from 'mongoose';

export const PROPOSAL_ACTIONS = Object.freeze(['book', 'reschedule', 'cancel']);

export const PROPOSAL_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'failed',
  'expired',
]);

export const PROPOSAL_TTL_MS = 10 * 60 * 1000;

const agentProposalSchema = new mongoose.Schema(
  {
    proposalId: {
      type: String,
      unique: true,
      index: true,
    },
    actionType: {
      type: String,
      enum: PROPOSAL_ACTIONS,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: { type: String, default: '' },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    // Target appointment for reschedule/cancel flows.
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    // Validated new details (book/reschedule). Cancel uses reason instead.
    date: { type: Date, default: null },
    startTime: { type: String, default: '' },
    purpose: { type: String, default: 'general' },
    notes: { type: String, default: '' },
    reason: { type: String, default: '' },
    // Snapshot of the target appointment at prepare time (stale-write guard).
    snapshot: {
      status: { type: String, default: '' },
      date: { type: Date, default: null },
      startTime: { type: String, default: '' },
    },
    requestId: { type: String, default: '' },
    status: {
      type: String,
      enum: PROPOSAL_STATUSES,
      default: 'pending',
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    errorCode: { type: String, default: '' },
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

// Cleanup mechanism only — application code always enforces expiry itself
// because TTL deletion is not immediate.
agentProposalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

agentProposalSchema.pre('save', async function ensureId(next) {
  if (!this.proposalId) {
    const { generateProposalId } = await import('../utils/generateId.js');
    this.proposalId = generateProposalId();
  }
  return next();
});

export const AgentProposal = mongoose.model('AgentProposal', agentProposalSchema);
export default AgentProposal;
