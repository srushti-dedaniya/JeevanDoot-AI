import mongoose from 'mongoose';

export const AGENT_RUN_STATUSES = Object.freeze([
  'started',
  'awaiting_confirmation',
  'running',
  'completed',
  'failed',
  'expired',
]);

// Valid lifecycle transitions. Terminal states have no outgoing edges.
export const AGENT_RUN_TRANSITIONS = Object.freeze({
  started: ['awaiting_confirmation', 'running', 'completed', 'failed', 'expired'],
  awaiting_confirmation: ['running', 'completed', 'failed', 'expired'],
  running: ['awaiting_confirmation', 'completed', 'failed', 'expired'],
  completed: [],
  failed: [],
  expired: [],
});

export const canTransitionRun = (from, to) =>
  Boolean(AGENT_RUN_TRANSITIONS[from]?.includes(to));

const toolEventSchema = new mongoose.Schema(
  {
    tool: { type: String, required: true },
    outcome: { type: String, enum: ['ok', 'error'], required: true },
    code: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const agentRunSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      unique: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: { type: String, default: '' },
    intent: { type: String, default: '', index: true },
    status: {
      type: String,
      enum: AGENT_RUN_STATUSES,
      default: 'started',
      index: true,
    },
    proposalId: { type: String, default: '' },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    // Bounded, append-only event ledger (max 20 entries kept).
    events: { type: [toolEventSchema], default: [] },
    result: { type: String, enum: ['success', 'error', 'pending'], default: 'pending' },
    errorCode: { type: String, default: '' },
    completedAt: { type: Date, default: null },
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

// Retention cleanup only; reads never rely on TTL having run.
agentRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const AgentRun = mongoose.model('AgentRun', agentRunSchema);
export default AgentRun;
