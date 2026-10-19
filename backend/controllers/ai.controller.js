/**
 * AI Task Agent controller (Phase 2C).
 *
 * POST /ai/chat         — orchestrated understanding + allow-listed tools.
 * POST /ai/confirm      — proposal-bound confirmation (book / reschedule /
 *                         cancel). Single atomic consume; replay is idempotent.
 * GET  /ai/proposal/:id — read-only re-check of a pending draft.
 * GET  /ai/runs         — caller's own agent runs (paginated).
 * GET  /ai/runs/:id     — one run (own, or admin).
 * GET  /ai/admin/runs   — all runs (admin only, paginated + filters).
 *
 * Auth: existing JWT middleware. Identity/role always from the session.
 * Writes happen ONLY in confirm after ownership + snapshot + availability
 * revalidation, never from a client-supplied `confirmed` flag.
 */

import { randomUUID } from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { created, success } from '../utils/response.js';
import { getProvider } from '../services/ai/provider.js';
import { sanitizeEntities } from '../services/ai/intent.js';
import { orchestrate } from '../services/ai/orchestrator.js';
import {
  bindAppointment,
  consumeProposal,
  markProposalFailed,
  peekProposal,
} from '../services/ai/proposals.js';
import {
  appendRunEvent,
  linkRunProposal,
  startRun,
  transitionRun,
} from '../services/ai/agentRuns.js';
import {
  assertSlotFree,
  resolveBookingDoctor,
  resolveBookingPatientId,
  resolveModifiableAppointment,
} from '../services/ai/tools.js';
import { AgentRun, Appointment, WorkflowPlan } from '../models/index.js';
import mongoose from 'mongoose';
import { getActiveWorkflowPlan } from '../services/ai/workflowPlanner.js';
import { executeWorkflowStep } from '../services/ai/workflowExecutor.js';

const MAX_MESSAGE = 2000;
const MAX_HISTORY = 10;

const historyItem = (value) => {
  if (!value || typeof value !== 'object') throw new Error('Invalid history item.');
  const from = value.from === 'assistant' ? 'assistant' : 'user';
  const text = String(value.text || '').slice(0, MAX_MESSAGE);
  if (!text.trim()) throw new Error('Invalid history item.');
  return { from, text };
};

const snapshotOf = (a) => ({
  status: a.status,
  date: a.date ? new Date(a.date).toISOString() : '',
  startTime: a.startTime || '',
});

export const snapshotMatches = (proposal, appointment) => {
  const snap = proposal.snapshot || {};
  const current = snapshotOf(appointment);
  return (
    (snap.status || '') === current.status &&
    String(snap.date ? new Date(snap.date).toISOString() : '') === current.date &&
    (snap.startTime || '') === current.startTime
  );
};

/**
 * POST /ai/chat
 * Body: { message: string (1..2000), history?: [{ from, text }] (<=10) }
 * Returns { data: { intent, entities, message, toolCalls, actions,
 *   requiresConfirmation, requestId, provider, workflowPlan? } }.
 */
export const chat = asyncHandler(async (req, res) => {
  const message = String(req.body?.message || '');
  if (!message.trim() || message.length > MAX_MESSAGE) {
    throw new ApiError(400, 'Message must be 1..2000 characters.');
  }
  let history = [];
  if (req.body?.history !== undefined) {
    if (!Array.isArray(req.body.history) || req.body.history.length > MAX_HISTORY) {
      throw new ApiError(400, `History must be an array of at most ${MAX_HISTORY} messages.`);
    }
    try {
      history = req.body.history.map(historyItem);
    } catch {
      throw new ApiError(400, 'History items must be { from, text }.');
    }
  }

  const provider = getProvider();
  let classification;
  try {
    classification = await provider.classify({ message, history });
  } catch {
    // Provider failure is an honest error — never fabricated success.
    throw new ApiError(502, 'The assistant service is temporarily unavailable. Please try again.');
  }

  // Check for active workflow plan first
  const activePlan = await getActiveWorkflowPlan(req.user._id);
  let requestId;
  let result;

  if (activePlan) {
    // Continue existing workflow
    const run = await startRun({ user: req.user, intent: classification.intent });
    requestId = run.requestId;
    classification.entities = sanitizeEntities(classification.entities);

    try {
      const plan = await executeWorkflowStep({
        plan: activePlan,
        user: req.user,
        message,
      });
      result = {
        intent: classification.intent,
        entities: classification.entities,
        message: `Workflow step completed: ${plan.proposedAction ? 'Action prepared' : 'Input received'}`,
        toolCalls: plan.toolCalls || [],
        actions: plan.proposedAction ? [plan.proposedAction] : [],
        requiresConfirmation: plan.proposedAction?.status === 'awaiting' || false,
        requestId,
        provider: { name: provider.name, aiGenerated: provider.name !== 'local-deterministic' },
        workflowPlan: { planId: activePlan.planId, status: plan.status, currentStep: plan.currentStepIndex + 1, totalSteps: activePlan.steps.length },
      };

      for (const call of result.toolCalls || []) {
        await appendRunEvent(requestId, { tool: call.tool, outcome: 'ok' });
      }
      if (result.actions?.some(a => a.proposalId)) {
        await linkRunProposal(requestId, result.actions.find(a => a.proposalId).proposalId);
        await transitionRun(requestId, 'awaiting_confirmation');
      } else if (result.workflowPlan?.status === 'completed') {
        await transitionRun(requestId, 'completed');
      } else {
        await transitionRun(requestId, 'running');
      }

      console.info('[ai-chat-workflow]', {
        requestId,
        role: req.user.role,
        intent: result.intent,
        workflowType: activePlan.workflowType,
        currentStep: activePlan.currentStepIndex + 1,
        tools: result.toolCalls?.map(t => t.tool) || [],
      });

      return success(res, result);
    } catch (error) {
      await appendRunEvent(requestId, {
        tool: 'workflow',
        outcome: 'error',
        code: error.statusCode || error.status || 'error',
      });
      await transitionRun(requestId, 'failed', { errorCode: error.statusCode || error.status || 'error' });
      throw error;
    }
  }

  // No active workflow - use standard orchestration
  const run = await startRun({ user: req.user, intent: classification.intent });
  requestId = run.requestId;
  classification.entities = sanitizeEntities(classification.entities);

  try {
    result = await orchestrate({
      user: req.user,
      classification,
      providerName: provider.name,
      message,
    });
    result.requestId = requestId;

    for (const call of result.toolCalls || []) {
      await appendRunEvent(requestId, { tool: call.tool, outcome: 'ok' });
    }
    const proposalAction = (result.actions || []).find((a) => a.proposalId);
    if (proposalAction) {
      await linkRunProposal(requestId, proposalAction.proposalId);
      await transitionRun(requestId, 'awaiting_confirmation');
    } else {
      await transitionRun(requestId, 'completed');
    }

    console.info('[ai-chat]', {
      requestId,
      role: req.user.role,
      intent: result.intent,
      tools: (result.toolCalls || []).map((t) => t.tool),
      provider: provider.name,
    });

    return success(res, result);
  } catch (error) {
    await appendRunEvent(requestId, {
      tool: 'orchestrate',
      outcome: 'error',
      code: error.statusCode || error.status || 'error',
    });
    await transitionRun(requestId, 'failed', { errorCode: error.statusCode || error.status || 'error' });
    throw error;
  }
});

const replayResult = async (proposal) => {
  const existing = proposal.appointmentId
    ? await Appointment.findById(proposal.appointmentId)
        .populate('doctor', 'name specialization')
        .populate('patient', 'patientId')
        .lean()
    : null;
  if (existing) {
    return { appointment: { id: String(existing._id), status: existing.status }, duplicate: true };
  }
  // Crash-recovery: consumed but never bound — look for the appointment the
  // write would have created before reporting anything.
  if (proposal.actionType === 'book') {
    const recovered = await Appointment.findOne({
      patient: proposal.patient,
      doctor: proposal.doctor,
      date: proposal.date,
      startTime: proposal.startTime,
      status: 'upcoming',
    }).lean();
    if (recovered) {
      await bindAppointment(proposal.proposalId, String(recovered._id));
      return { appointment: { id: String(recovered._id), status: recovered.status }, duplicate: true };
    }
  }
  await markProposalFailed(proposal.proposalId, 'unresolved');
  throw new ApiError(409, 'This request was already processed but no record was found. Please check your appointments before trying again.');
};

/**
 * POST /ai/confirm
 * Body: { proposalId: string }
 * Atomic single-winner consume; replay returns the recorded outcome.
 * Ownership, snapshot and availability are revalidated before any write.
 */
export const confirm = asyncHandler(async (req, res) => {
  const proposalId = String(req.body?.proposalId || '');
  if (!proposalId || proposalId.length > 64) {
    throw new ApiError(400, 'A valid proposalId is required.');
  }

  const { proposal, replay } = await consumeProposal(proposalId, String(req.user._id));

  if (replay) {
    const outcome = await replayResult(proposal);
    await transitionRun(proposal.requestId, 'completed').catch(() => null);
    return success(res, { ...outcome, requestId: randomUUID() });
  }

  const runRequestId = proposal.requestId;
  if (runRequestId) await transitionRun(runRequestId, 'running').catch(() => null);

  try {
    let result;
    if (proposal.actionType === 'book') {
      result = await confirmBooking(req, proposal);
    } else if (proposal.actionType === 'reschedule') {
      result = await confirmReschedule(req, proposal);
    } else if (proposal.actionType === 'cancel') {
      result = await confirmCancel(req, proposal);
    } else {
      throw new ApiError(400, 'Unknown proposal action.');
    }
    if (runRequestId) {
      await linkRunProposal(runRequestId, proposal.proposalId, result.appointment?.id || null).catch(() => null);
      await transitionRun(runRequestId, 'completed').catch(() => null);
    }
    console.info('[ai-confirm]', { requestId: proposal.requestId, action: proposal.actionType, role: req.user.role });
    return created(res, { ...result, duplicate: false, requestId: randomUUID() });
  } catch (error) {
    await markProposalFailed(proposal.proposalId, error.statusCode || error.status || 'error').catch(() => null);
    if (runRequestId) {
      await appendRunEvent(runRequestId, {
        tool: 'confirm',
        outcome: 'error',
        code: error.statusCode || error.status || 'error',
      }).catch(() => null);
      await transitionRun(runRequestId, 'failed', { errorCode: error.statusCode || error.status || 'error' }).catch(() => null);
    }
    throw error;
  }
});

const confirmBooking = async (req, proposal) => {
  // Re-derive ownership from the session and require it to match the proposal.
  const patientId = await resolveBookingPatientId(req.user);
  if (patientId !== String(proposal.patient)) {
    throw new ApiError(403, 'This confirmation does not belong to your patient record.');
  }
  await resolveBookingDoctor(String(proposal.doctor));
  await assertSlotFree(String(proposal.doctor), proposal.date, proposal.startTime);

  let appointment;
  try {
    appointment = await Appointment.create({
      patient: proposal.patient,
      doctor: proposal.doctor,
      purpose: proposal.purpose || 'general',
      date: proposal.date,
      startTime: proposal.startTime,
      notes: proposal.notes || '',
    });
  } catch (error) {
    // Cross-instance race lost at the database guard: report honestly.
    if (error?.code === 11000) throw new ApiError(409, 'The doctor is already booked at this time.');
    throw error;
  }
  await bindAppointment(proposal.proposalId, String(appointment._id));

  const populated = await Appointment.findById(appointment._id)
    .populate('doctor', 'name specialization')
    .populate('patient', 'patientId')
    .lean();

  return {
    appointment: {
      id: String(populated._id),
      status: populated.status,
      date: populated.date,
      startTime: populated.startTime,
    },
  };
};

const confirmReschedule = async (req, proposal) => {
  const appointment = await Appointment.findById(proposal.appointment)
    .populate('doctor', 'name specialization')
    .populate('patient', 'patientId')
    .lean();
  if (!appointment) throw new ApiError(404, 'The appointment no longer exists.');
  // Ownership re-check (patient own / doctor own schedule / admin).
  await resolveModifiableAppointment(req.user, { appointmentId: String(appointment._id) });
  // Stale-proposal guard: the appointment must be unchanged since prepare.
  if (!snapshotMatches(proposal, appointment)) {
    throw new ApiError(409, 'The appointment changed since this proposal was prepared. Please start again.');
  }
  await assertSlotFree(String(proposal.doctor), proposal.date, proposal.startTime, appointment._id);

  const updated = await Appointment.findOneAndUpdate(
    {
      _id: appointment._id,
      status: 'upcoming',
      date: appointment.date,
      startTime: proposal.snapshot?.startTime || appointment.startTime,
    },
    { $set: { date: proposal.date, startTime: proposal.startTime } },
    { new: true, runValidators: true }
  )
    .populate('doctor', 'name specialization')
    .populate('patient', 'patientId')
    .lean();
  if (!updated) {
    throw new ApiError(409, 'The appointment changed since this proposal was prepared. Please start again.');
  }
  await bindAppointment(proposal.proposalId, String(updated._id));
  return {
    appointment: {
      id: String(updated._id),
      status: updated.status,
      date: updated.date,
      startTime: updated.startTime,
    },
  };
};

const confirmCancel = async (req, proposal) => {
  const appointment = await Appointment.findById(proposal.appointment).lean();
  if (!appointment) throw new ApiError(404, 'The appointment no longer exists.');
  await resolveModifiableAppointment(req.user, { appointmentId: String(appointment._id) });
  if (!snapshotMatches(proposal, appointment)) {
    throw new ApiError(409, 'The appointment changed since this proposal was prepared. Please start again.');
  }
  // Atomic upcoming -> cancelled transition; a concurrent cancel wins once.
  const updated = await Appointment.findOneAndUpdate(
    { _id: appointment._id, status: 'upcoming' },
    { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledReason: proposal.reason || 'Cancelled via JeevanDoot AI' } },
    { new: true }
  ).lean();
  if (!updated) {
    throw new ApiError(409, 'The appointment was already cancelled.');
  }
  await bindAppointment(proposal.proposalId, String(updated._id));
  return {
    appointment: { id: String(updated._id), status: updated.status },
  };
};

/** GET /ai/proposal/:id — read-only re-check of a pending draft. */
export const peek = asyncHandler(async (req, res) => {
  const proposal = await peekProposal(String(req.params.id || ''), String(req.user._id));
  if (!proposal) throw new ApiError(404, 'No pending booking proposal found for this session.');
  return success(res, {
    proposalId: proposal.proposalId,
    actionType: proposal.actionType,
    doctorId: proposal.doctor,
    date: proposal.date,
    startTime: proposal.startTime,
    expiresAt: proposal.expiresAt,
  });
});

/** GET /ai/workflow/:id — read-only re-check of an active workflow plan. */
export const getWorkflowPlan = asyncHandler(async (req, res) => {
  const plan = await WorkflowPlan.findOne({ planId: String(req.params.id || ''), user: req.user._id }).lean();
  if (!plan) throw new ApiError(404, 'No active workflow plan found for this session.');
  return success(res, {
    planId: plan.planId,
    workflowType: plan.workflowType,
    status: plan.status,
    currentStep: plan.currentStepIndex + 1,
    totalSteps: plan.steps.length,
    steps: plan.steps.map(s => ({
      index: s.stepIndex,
      name: s.name,
      description: s.description,
      status: s.status,
      requiredFields: s.requiredFields,
      dependsOn: s.dependsOn,
    })),
    context: plan.context,
    proposalId: plan.proposalId,
    appointmentId: plan.appointmentId,
    error: plan.error,
    expiresAt: plan.expiresAt,
  });
});

/** POST /ai/workflow/cancel — cancel the active workflow plan. */
export const cancelWorkflow = asyncHandler(async (req, res) => {
  const plan = await WorkflowPlan.findOne({ user: req.user._id, status: { $in: ['planned', 'awaiting_input', 'awaiting_confirmation', 'running'] } });
  if (!plan) throw new ApiError(404, 'No active workflow plan to cancel.');
  if (['completed', 'failed', 'cancelled'].includes(plan.status)) {
    throw new ApiError(409, `Workflow is in terminal state: ${plan.status}`);
  }
  plan.status = 'cancelled';
  plan.completedAt = new Date();
  await plan.save();
  await transitionRun(plan.planId, 'cancelled').catch(() => null);
  return success(res, { message: 'Workflow cancelled.', planId: plan.planId });
});

const runPublic = (run, { full = false } = {}) => ({
  requestId: run.requestId,
  intent: run.intent,
  status: run.status,
  role: full ? run.role : undefined,
  proposalId: run.proposalId || undefined,
  appointmentId: run.appointmentId ? String(run.appointmentId) : undefined,
  events: (run.events || []).map((e) => ({ tool: e.tool, outcome: e.outcome, code: e.code || undefined })),
  result: run.result,
  errorCode: run.errorCode || undefined,
  createdAt: run.createdAt,
  completedAt: run.completedAt || undefined,
});

const paginate = (page, limit) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

/** GET /ai/runs — caller's own runs, newest first. */
export const listMyRuns = asyncHandler(async (req, res) => {
  const { pageNum, limitNum, skip } = paginate(req.query.page, req.query.limit);
  const query = { actor: req.user._id };
  if (req.query.status) query.status = String(req.query.status);
  if (req.query.intent) query.intent = String(req.query.intent);
  const [items, total] = await Promise.all([
    AgentRun.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    AgentRun.countDocuments(query),
  ]);
  return success(
    res,
    items.map((r) => runPublic(r)),
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  );
});

/** GET /ai/runs/:id — own run, or any run for admins. */
export const getRun = asyncHandler(async (req, res) => {
  const run = await AgentRun.findOne({ requestId: String(req.params.id || '') }).lean();
  if (!run) throw new ApiError(404, 'Agent run not found.');
  const isOwner = String(run.actor) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only view your own agent runs.');
  }
  return success(res, runPublic(run, { full: req.user.role === 'admin' }));
});

/** GET /ai/admin/runs — paginated runs with status/date filters (admin only). */
export const listAllRuns = asyncHandler(async (req, res) => {
  const { pageNum, limitNum, skip } = paginate(req.query.page, req.query.limit);
  const query = {};
  if (req.query.status) query.status = String(req.query.status);
  if (req.query.intent) query.intent = String(req.query.intent);
  if (req.query.from || req.query.to) {
    query.createdAt = {};
    if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
  }
  const [items, total] = await Promise.all([
    AgentRun.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('actor', 'name role')
      .lean(),
    AgentRun.countDocuments(query),
  ]);
  // Minimal safe summaries: actor identity + outcome, never transcripts.
  const data = items.map((r) => ({
    ...runPublic(r, { full: true }),
    actor: r.actor && typeof r.actor === 'object'
      ? { name: r.actor.name, role: r.actor.role }
      : undefined,
  }));
  return success(
    res,
    data,
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  );
});

/**
 * GET /ai/status — operational readiness for the agent (authenticated only).
 * Reports configuration STATUS, never secret values: provider name (not the
 * key), database connectivity, rate-limit scope, and retention windows.
 */
export const status = asyncHandler(async (_req, res) => {
  const provider = getProvider();
  return success(res, {
    chatEnabled: true,
    provider: provider.name,
    aiGenerated: provider.aiGenerated,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable',
    rateLimit: { scope: 'per-instance', chatPerMinute: 30, confirmPerMinute: 10 },
    proposalTtlMinutes: 10,
    runRetentionDays: 90,
  });
});

export const aiController = { chat, confirm, peek, listMyRuns, getRun, listAllRuns, snapshotMatches, status };
export default aiController;
