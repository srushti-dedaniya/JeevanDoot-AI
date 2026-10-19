/**
 * AgentRun lifecycle service (Phase 2C) — persistent, append-only workflow
 * ledger. Records the minimum needed for accountability: actor snapshot,
 * intent, status transitions, bounded tool events, and final outcome.
 *
 * Never stores: chat history, raw prompts, provider responses, tokens,
 * secrets, model reasoning, or patient health details.
 */

import { randomUUID } from 'node:crypto';
import { AgentRun, canTransitionRun } from '../../models/index.js';

export { canTransitionRun };

const MAX_EVENTS = 20;

const sanitizeCode = (code) =>
  String(code || '')
    .slice(0, 40)
    .replace(/[^a-z0-9_]/gi, '') || 'error';

export const startRun = async ({ user, intent, requestId = randomUUID() }) => {
  const run = await AgentRun.create({
    requestId,
    actor: user._id,
    role: user.role,
    intent: intent || '',
    status: 'started',
    events: [],
    result: 'pending',
  });
  return run.toJSON();
};

export const transitionRun = async (requestId, to, { errorCode = '' } = {}) => {
  const run = await AgentRun.findOne({ requestId });
  if (!run) return null;
  if (!canTransitionRun(run.status, to)) return run.toJSON();
  run.status = to;
  if (errorCode) run.errorCode = sanitizeCode(errorCode);
  if (['completed', 'failed', 'expired'].includes(to)) {
    run.completedAt = new Date();
    run.result = to === 'completed' ? 'success' : 'error';
  }
  await run.save();
  return run.toJSON();
};

/** Append-only event recording (array capped at MAX_EVENTS). */
export const appendRunEvent = async (requestId, { tool, outcome, code = '' }) => {
  const event = {
    tool: String(tool || 'unknown').slice(0, 60),
    outcome: outcome === 'ok' ? 'ok' : 'error',
    code: outcome === 'ok' ? '' : sanitizeCode(code),
    at: new Date(),
  };
  const run = await AgentRun.findOneAndUpdate(
    { requestId },
    { $push: { events: { $each: [event], $slice: -MAX_EVENTS } } },
    { new: true }
  ).lean();
  return run || null;
};

export const linkRunProposal = async (requestId, proposalId, appointmentId = null) => {
  await AgentRun.updateOne(
    { requestId },
    {
      $set: {
        ...(proposalId ? { proposalId } : {}),
        ...(appointmentId ? { appointmentId } : {}),
      },
    }
  );
};

export default { startRun, transitionRun, appendRunEvent, linkRunProposal };
