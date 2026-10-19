/**
 * Conversation context service (Phase 4).
 *
 * Manages multi-turn conversation context for workflows, with bounded
 * storage and automatic cleanup. Context is scoped to the authenticated
 * user and workflow plan.
 */

import { ConversationContext } from '../../models/index.js';

export const MAX_CONTEXT_LENGTH = 5000;
export const CONTEXT_TTL_MS = 60 * 60 * 1000;

export const createConversationContext = async ({
  userId,
  workflowPlanId,
  initialContext = {},
}) => {
  if (!userId || !workflowPlanId) {
    throw new Error('userId and workflowPlanId are required');
  }

  const context = await ConversationContext.create({
    user: userId,
    workflowPlan: workflowPlanId,
    context: initialContext,
    messageCount: 0,
    lastMessageAt: new Date(),
  });

  return context.toJSON();
};

export const getConversationContext = async (workflowPlanId, userId) => {
  const context = await ConversationContext.findOne({
    workflowPlan: workflowPlanId,
    user: userId,
  }).lean();

  return context || null;
};

export const updateConversationContext = async (workflowPlanId, userId, updates = {}) => {
  const context = await ConversationContext.findOneAndUpdate(
    { workflowPlan: workflowPlanId, user: userId },
    {
      $set: {
        context: updates,
        lastMessageAt: new Date(),
      },
      $inc: { messageCount: 1 },
    },
    { new: true, upsert: true }
  ).lean();

  return context;
};

export const appendToConversationContext = async (workflowPlanId, userId, key, value) => {
  const context = await ConversationContext.findOne({ workflowPlan: workflowPlanId, user: userId });
  if (!context) return null;

  const updatedContext = { ...context.context, [key]: value };
  if (JSON.stringify(updatedContext).length > MAX_CONTEXT_LENGTH) {
    throw new Error('Conversation context exceeds maximum length');
  }

  context.context = updatedContext;
  context.messageCount += 1;
  context.lastMessageAt = new Date();
  await context.save();

  return context.toJSON();
};

export const clearConversationContext = async (workflowPlanId, userId) => {
  await ConversationContext.deleteOne({ workflowPlan: workflowPlanId, user: userId });
};

export const pruneExpiredContexts = async (nowMs = Date.now()) => {
  const res = await ConversationContext.deleteMany({
    lastMessageAt: { $lt: new Date(nowMs - CONTEXT_TTL_MS) },
  });
  return res.deletedCount || 0;
};

export const buildPromptContext = async (workflowPlanId, userId, maxMessages = 10) => {
  const context = await getConversationContext(workflowPlanId, userId);
  if (!context) return { systemPrompt: '', history: [] };

  return {
    systemPrompt: `Current workflow: ${context.context.workflowType || 'unknown'}. Current step: ${context.context.currentStepName || 'unknown'}. Context: ${JSON.stringify(context.context)}`,
    history: [],
  };
};

export default {
  createConversationContext,
  getConversationContext,
  updateConversationContext,
  appendToConversationContext,
  clearConversationContext,
  pruneExpiredContexts,
  buildPromptContext,
  MAX_CONTEXT_LENGTH,
  CONTEXT_TTL_MS,
};