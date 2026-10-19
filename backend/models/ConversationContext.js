import mongoose from 'mongoose';

export const CONTEXT_TTL_MS = 60 * 60 * 1000;
export const MAX_CONTEXT_LENGTH = 5000;

const conversationContextSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workflowPlan: {
      type: String,
      required: true,
      index: true,
    },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now },
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

conversationContextSchema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 0 });

export const ConversationContext = mongoose.model('ConversationContext', conversationContextSchema);
export default ConversationContext;