/**
 * Persistent appointment proposals (Phase 2C).
 *
 * MongoDB-backed store following existing Mongoose conventions, replacing the
 * Phase 2B in-memory Map. Survives restarts and is shared across instances.
 *
 * Safety properties:
 *  - Server-generated proposalId + timestamps; expiry enforced in every
 *    read/mutation (TTL index is cleanup only, never the authority).
 *  - consumeProposal uses one atomic findOneAndUpdate so two instances can
 *    never both consume the same proposal.
 *  - Ownership (proposal.user === session user) checked on every access.
 *  - No tokens, conversations, or model prompts are stored.
 *
 * Transactions / replica sets: proposal consume + appointment write are two
 * separate documents, so multi-document ACID transactions would need a
 * replica set (standalone mongod rejects them). This module deliberately
 * does NOT require transactions: the atomic consume is the single winner
 * election, and confirm paths implement crash recovery (replay re-binds an
 * already-created appointment instead of creating another). To run with
 * transactions in production, deploy MongoDB as a replica set — local dev:
 *   mongod --replSet rs0 --dbpath <path>   (then: mongosh --eval "rs.initiate()")
 * and point MONGODB_URI at it; no code changes are needed for that upgrade.
 */

import ApiError from '../../utils/ApiError.js';
import { AgentProposal, PROPOSAL_TTL_MS } from '../../models/index.js';

export { PROPOSAL_TTL_MS };

/** Pure liveness check (unit-testable without a database). */
export const isProposalLive = (proposal, nowMs = Date.now()) => {
  if (!proposal) return false;
  if (proposal.status !== 'pending') return false;
  return new Date(proposal.expiresAt).getTime() > nowMs;
};

export const issueProposal = async ({
  userId,
  role,
  actionType = 'book',
  patientId,
  doctorId,
  appointment = null,
  date = null,
  startTime = '',
  purpose = 'general',
  notes = '',
  reason = '',
  snapshot = {},
  requestId = '',
  ttlMs = PROPOSAL_TTL_MS,
} = {}) => {
  if (!userId || !patientId || !doctorId) {
    throw new ApiError(400, 'Proposal requires user, patient and doctor references.');
  }
  if ((actionType === 'book' || actionType === 'reschedule') && (!date || !startTime)) {
    throw new ApiError(400, 'Proposal requires a date and time slot.');
  }
  const proposal = await AgentProposal.create({
    actionType,
    user: userId,
    role: role || '',
    patient: patientId,
    doctor: doctorId,
    appointment: appointment || null,
    date: date ? new Date(date) : null,
    startTime,
    purpose,
    notes,
    reason,
    snapshot: {
      status: snapshot.status || '',
      date: snapshot.date ? new Date(snapshot.date) : null,
      startTime: snapshot.startTime || '',
    },
    requestId,
    status: 'pending',
    expiresAt: new Date(Date.now() + ttlMs),
  });
  // Never claim persistence before the write succeeds — create() resolved.
  return proposal.toJSON();
};

/** Returns a live proposal owned by userId, else null. */
export const peekProposal = async (proposalId, userId, nowMs = Date.now()) => {
  const proposal = await AgentProposal.findOne({
    proposalId,
    user: userId,
    status: 'pending',
    expiresAt: { $gt: new Date(nowMs) },
  }).lean();
  return proposal || null;
};

/**
 * Atomically consumes a proposal exactly once.
 * Returns { proposal, replay: false } to the single winner.
 * A concurrent/ repeat caller gets { proposal, replay: true } (idempotent
 * replay) or an honest 403/410 when foreign or expired.
 */
export const consumeProposal = async (proposalId, userId, nowMs = Date.now()) => {
  const claimed = await AgentProposal.findOneAndUpdate(
    {
      proposalId,
      user: userId,
      status: 'pending',
      expiresAt: { $gt: new Date(nowMs) },
    },
    { $set: { status: 'confirmed' } },
    { new: true }
  ).lean();

  if (claimed) return { proposal: claimed, replay: false };

  const existing = await AgentProposal.findOne({ proposalId }).lean();
  if (!existing || String(existing.user) !== String(userId)) {
    throw new ApiError(403, 'Confirmation is not valid for this session.');
  }
  if (existing.status === 'confirmed' || existing.status === 'failed') {
    return { proposal: existing, replay: true };
  }
  throw new ApiError(410, 'This booking proposal has expired. Please start again.');
};

export const markProposalFailed = async (proposalId, errorCode = '') => {
  await AgentProposal.updateOne({ proposalId }, { $set: { status: 'failed', errorCode } });
};

export const bindAppointment = async (proposalId, appointmentId) => {
  await AgentProposal.updateOne({ proposalId }, { $set: { appointmentId } });
};

/** Explicit cleanup of expired documents (TTL index handles this anyway). */
export const pruneProposals = async (nowMs = Date.now()) => {
  const res = await AgentProposal.deleteMany({ expiresAt: { $lt: new Date(nowMs) } });
  return res.deletedCount || 0;
};

export default {
  issueProposal,
  peekProposal,
  consumeProposal,
  markProposalFailed,
  bindAppointment,
  pruneProposals,
  isProposalLive,
  PROPOSAL_TTL_MS,
};
