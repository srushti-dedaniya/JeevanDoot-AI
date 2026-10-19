/**
 * Workflow planning service (Phase 4).
 *
 * Provides structured, bounded multi-step workflow plans for healthcare
 * coordination tasks. Each plan has ordered steps with dependencies,
 * required fields, and proposed actions that require confirmation.
 *
 * Integrates with existing AgentRun and AgentProposal infrastructure.
 */

import ApiError from '../../utils/ApiError.js';
import mongoose from 'mongoose';
import { WorkflowPlan, WORKFLOW_STATUSES, WORKFLOW_STEP_STATUSES, MAX_WORKFLOW_STEPS, MAX_TOOL_CALLS_PER_STEP, WORKFLOW_TIMEOUT_MS } from '../../models/index.js';
import { callTool, resolveBookingDoctor, resolveBookingPatientId, assertSlotFree, resolveModifiableAppointment } from './tools.js';
import { issueProposal, peekProposal, consumeProposal, bindAppointment, markProposalFailed } from './proposals.js';
import { startRun, transitionRun, appendRunEvent, linkRunProposal } from './agentRuns.js';

const WORKFLOW_DEFINITIONS = {
  appointment_coordination: {
    name: 'Appointment Coordination',
    steps: [
      {
        name: 'identify_need',
        description: 'Determine if user wants to book, reschedule, or cancel',
        requiredFields: [],
        dependsOn: [],
      },
      {
        name: 'select_doctor',
        description: 'Identify or select a doctor/specialty',
        requiredFields: ['doctorId'],
        dependsOn: [0],
      },
      {
        name: 'select_datetime',
        description: 'Choose date and time slot',
        requiredFields: ['date', 'startTime'],
        dependsOn: [1],
      },
      {
        name: 'check_availability',
        description: 'Verify slot is available',
        requiredFields: [],
        dependsOn: [2],
      },
      {
        name: 'prepare_proposal',
        description: 'Create booking proposal for confirmation',
        requiredFields: [],
        dependsOn: [3],
      },
      {
        name: 'await_confirmation',
        description: 'Wait for user to confirm booking',
        requiredFields: [],
        dependsOn: [4],
      },
      {
        name: 'execute_booking',
        description: 'Create the appointment record',
        requiredFields: [],
        dependsOn: [5],
      },
    ],
  },
  reschedule_cancel: {
    name: 'Reschedule or Cancel Appointment',
    steps: [
      {
        name: 'identify_appointment',
        description: 'Find the appointment to modify',
        requiredFields: ['appointmentId', 'date'],
        dependsOn: [],
      },
      {
        name: 'verify_ownership',
        description: 'Confirm user owns this appointment',
        requiredFields: [],
        dependsOn: [0],
      },
      {
        name: 'get_new_details',
        description: 'Collect new date/time for reschedule',
        requiredFields: ['newDate', 'newStartTime'],
        dependsOn: [1],
      },
      {
        name: 'check_availability',
        description: 'Verify new slot is available',
        requiredFields: [],
        dependsOn: [2],
      },
      {
        name: 'prepare_proposal',
        description: 'Create reschedule/cancel proposal',
        requiredFields: [],
        dependsOn: [3],
      },
      {
        name: 'await_confirmation',
        description: 'Wait for user confirmation',
        requiredFields: [],
        dependsOn: [4],
      },
      {
        name: 'execute_change',
        description: 'Apply the reschedule or cancellation',
        requiredFields: [],
        dependsOn: [5],
      },
    ],
  },
  referral_coordination: {
    name: 'Referral Coordination',
    steps: [
      {
        name: 'gather_referral_details',
        description: 'Collect reason, destination, priority',
        requiredFields: ['reason', 'destination', 'priority'],
        dependsOn: [],
      },
      {
        name: 'verify_authorization',
        description: 'Check role permissions for referral operations',
        requiredFields: [],
        dependsOn: [0],
      },
      {
        name: 'prepare_proposal',
        description: 'Create referral proposal',
        requiredFields: [],
        dependsOn: [1],
      },
      {
        name: 'await_confirmation',
        description: 'Wait for user confirmation',
        requiredFields: [],
        dependsOn: [2],
      },
      {
        name: 'execute_referral',
        description: 'Submit the referral through authorized API',
        requiredFields: [],
        dependsOn: [3],
      },
    ],
  },
  followup_coordination: {
    name: 'Follow-up Coordination',
    steps: [
      {
        name: 'identify_followup_context',
        description: 'Determine eligible upcoming appointments or existing follow-ups',
        requiredFields: [],
        dependsOn: [],
      },
      {
        name: 'verify_followup_api',
        description: 'Check if dedicated follow-up API exists',
        requiredFields: [],
        dependsOn: [0],
      },
      {
        name: 'prepare_action',
        description: 'Prepare follow-up scheduling or reminder',
        requiredFields: ['date', 'startTime', 'reason'],
        dependsOn: [1],
      },
      {
        name: 'await_confirmation',
        description: 'Wait for user confirmation',
        requiredFields: [],
        dependsOn: [2],
      },
      {
        name: 'execute_followup',
        description: 'Create follow-up record or appointment',
        requiredFields: [],
        dependsOn: [3],
      },
    ],
  },
  role_aware_coordination: {
    name: 'Role-Aware Coordination',
    steps: [
      {
        name: 'identify_role_permissions',
        description: 'Determine what operations the role can perform',
        requiredFields: [],
        dependsOn: [],
      },
      {
        name: 'gather_task_details',
        description: 'Collect details for the authorized task',
        requiredFields: [],
        dependsOn: [0],
      },
      {
        name: 'verify_authorization',
        description: 'Confirm user can perform this task',
        requiredFields: [],
        dependsOn: [1],
      },
      {
        name: 'prepare_proposal',
        description: 'Create proposal for authorized action',
        requiredFields: [],
        dependsOn: [2],
      },
      {
        name: 'await_confirmation',
        description: 'Wait for user confirmation',
        requiredFields: [],
        dependsOn: [3],
      },
      {
        name: 'execute_task',
        description: 'Execute the authorized operation',
        requiredFields: [],
        dependsOn: [4],
      },
    ],
  },
};

export const createWorkflowPlan = async ({
  user,
  workflowType,
  initialContext = {},
  requestId = '',
}) => {
  if (!WORKFLOW_DEFINITIONS[workflowType]) {
    throw new ApiError(400, `Unknown workflow type: ${workflowType}`);
  }

  const definition = WORKFLOW_DEFINITIONS[workflowType];
  const steps = definition.steps.map((step, index) => ({
    stepIndex: index,
    name: step.name,
    description: step.description,
    dependsOn: step.dependsOn || [],
    requiredFields: step.requiredFields || [],
    proposedAction: null,
    status: index === 0 ? 'pending' : 'pending',
    toolCalls: [],
    error: '',
    startedAt: null,
    completedAt: null,
  }));

  const plan = await WorkflowPlan.create({
    workflowType,
    user: user._id,
    role: user.role,
    status: 'planned',
    steps,
    currentStepIndex: 0,
    context: initialContext,
    expiresAt: new Date(Date.now() + WORKFLOW_TIMEOUT_MS),
  });

  const run = await startRun({ user, intent: workflowType.toUpperCase(), requestId: plan.planId });
  await linkRunProposal(run.requestId, plan.planId);

  return plan.toJSON();
};

export const getWorkflowPlan = async (planId, userId) => {
  const plan = await WorkflowPlan.findOne({ planId, user: userId }).lean();
  return plan || null;
};

export const getActiveWorkflowPlan = async (userId) => {
  const plan = await WorkflowPlan.findOne({
    user: userId,
    status: { $in: ['planned', 'awaiting_input', 'awaiting_confirmation', 'running'] },
  }).sort({ createdAt: -1 }).lean();
  return plan || null;
};

export const advanceWorkflowStep = async (planId, userId, stepData = {}) => {
  const plan = await WorkflowPlan.findOne({ planId, user: userId });
  if (!plan) throw new ApiError(404, 'Workflow plan not found.');

  if (!WORKFLOW_STATUSES.includes(plan.status) || ['completed', 'failed', 'cancelled'].includes(plan.status)) {
    throw new ApiError(409, `Workflow is in terminal state: ${plan.status}`);
  }

  const currentStep = plan.steps[plan.currentStepIndex];
  if (!currentStep) {
    throw new ApiError(400, 'No current step found.');
  }

  // Merge step data into plan context
  plan.context = { ...plan.context, ...stepData };
  currentStep.context = { ...plan.context };

  const missingFields = currentStep.requiredFields.filter((f) => !currentStep.context[f]);
  if (missingFields.length > 0) {
    currentStep.status = 'awaiting_input';
    plan.status = 'awaiting_input';
    await plan.save();
    return plan.toJSON();
  }

  currentStep.status = 'running';
  currentStep.startedAt = new Date();
  plan.status = 'running';
  await plan.save();

  return plan.toJSON();
};

export const completeWorkflowStep = async (planId, userId, stepResult = {}) => {
  const plan = await WorkflowPlan.findOne({ planId, user: userId });
  if (!plan) throw new ApiError(404, 'Workflow plan not found.');

  const currentStep = plan.steps[plan.currentStepIndex];
  if (!currentStep) throw new ApiError(400, 'No current step found.');

  currentStep.status = 'completed';
  currentStep.completedAt = new Date();
  currentStep.toolCalls = stepResult.toolCalls || [];
  currentStep.proposedAction = stepResult.proposedAction || null;

  if (stepResult.proposalId) {
    plan.proposalId = stepResult.proposalId;
  }
  if (stepResult.appointmentId) {
    if (mongoose.isValidObjectId(stepResult.appointmentId)) {
      plan.appointmentId = stepResult.appointmentId;
    }
  }
  if (stepResult.context) {
    plan.context = { ...plan.context, ...stepResult.context };
  }

  const nextIndex = plan.currentStepIndex + 1;
  if (nextIndex >= plan.steps.length) {
    plan.status = 'completed';
    plan.completedAt = new Date();
    if (plan.proposalId) {
      await transitionRun(plan.planId, 'completed').catch(() => null);
    }
  } else {
    plan.currentStepIndex = nextIndex;
    const nextStep = plan.steps[nextIndex];
    const missingFields = nextStep.requiredFields.filter((f) => !plan.context[f]);
    if (missingFields.length > 0) {
      plan.status = 'awaiting_input';
      nextStep.status = 'awaiting_input';
    } else {
      nextStep.status = 'pending';
      plan.status = 'planned';
    }
  }

  await plan.save();
  return plan.toJSON();
};

export const failWorkflowStep = async (planId, userId, error, errorCode = '') => {
  const plan = await WorkflowPlan.findOne({ planId, user: userId });
  if (!plan) throw new ApiError(404, 'Workflow plan not found.');

  const currentStep = plan.steps[plan.currentStepIndex];
  if (currentStep) {
    currentStep.status = 'failed';
    currentStep.error = error.message || String(error);
    currentStep.completedAt = new Date();
  }

  plan.status = 'failed';
  plan.error = error.message || String(error);
  plan.completedAt = new Date();

  await plan.save();

  await transitionRun(plan.planId, 'failed', { errorCode: errorCode || error.statusCode || 'error' }).catch(() => null);
  await appendRunEvent(plan.planId, { tool: 'workflow', outcome: 'error', code: errorCode || 'error' }).catch(() => null);

  return plan.toJSON();
};

export const cancelWorkflow = async (planId, userId) => {
  const plan = await WorkflowPlan.findOne({ planId, user: userId });
  if (!plan) throw new ApiError(404, 'Workflow plan not found.');

  if (['completed', 'failed', 'cancelled'].includes(plan.status)) {
    throw new ApiError(409, `Workflow is in terminal state: ${plan.status}`);
  }

  plan.status = 'cancelled';
  plan.completedAt = new Date();
  await plan.save();

  await transitionRun(plan.planId, 'cancelled').catch(() => null);
  return plan.toJSON();
};

export const buildWorkflowContextForPrompt = (plan) => {
  if (!plan) return '';
  const currentStep = plan.steps[plan.currentStepIndex];
  return {
    workflowType: plan.workflowType,
    currentStep: currentStep ? {
      index: plan.currentStepIndex,
      name: currentStep.name,
      description: currentStep.description,
      requiredFields: currentStep.requiredFields,
      context: plan.context,
    } : null,
    completedSteps: plan.steps.slice(0, plan.currentStepIndex).map((s) => ({
      name: s.name,
      status: s.status,
      proposedAction: s.proposedAction,
    })),
    totalSteps: plan.steps.length,
  };
};

export const prepareAppointmentBookingProposal = async ({ user, context, requestId }) => {
  const { doctorId, date, startTime } = context;
  if (!doctorId || !date || !startTime) {
    throw new ApiError(400, 'Missing required fields for booking proposal.');
  }

  const doctor = await resolveBookingDoctor(doctorId);
  await assertSlotFree(doctorId, date, startTime);
  const patientId = await resolveBookingPatientId(user);

  const proposal = await issueProposal({
    userId: String(user._id),
    role: user.role,
    actionType: 'book',
    patientId,
    doctorId,
    date,
    startTime,
    requestId: requestId || plan?.planId,
  });

  return { proposal, doctor };
};

export const prepareRescheduleProposal = async ({ user, context, requestId }) => {
  const { appointmentId, newDate, newStartTime } = context;
  if (!appointmentId || !newDate || !newStartTime) {
    throw new ApiError(400, 'Missing required fields for reschedule proposal.');
  }

  const appointment = await resolveModifiableAppointment(user, { appointmentId });
  await assertSlotFree(String(appointment.doctor?._id || appointment.doctor), newDate, newStartTime, appointment._id);

  const proposal = await issueProposal({
    userId: String(user._id),
    role: user.role,
    actionType: 'reschedule',
    patientId: String(appointment.patient?._id || appointment.patient),
    doctorId: String(appointment.doctor?._id || appointment.doctor),
    appointment: appointmentId,
    date: newDate,
    startTime: newStartTime,
    snapshot: {
      status: appointment.status,
      date: appointment.date,
      startTime: appointment.startTime,
    },
    requestId: requestId || plan?.planId,
  });

  return { proposal, appointment };
};

export const prepareCancelProposal = async ({ user, context, requestId }) => {
  const { appointmentId } = context;
  if (!appointmentId) {
    throw new ApiError(400, 'Missing appointmentId for cancel proposal.');
  }

  const appointment = await resolveModifiableAppointment(user, { appointmentId });

  const proposal = await issueProposal({
    userId: String(user._id),
    role: user.role,
    actionType: 'cancel',
    patientId: String(appointment.patient?._id || appointment.patient),
    doctorId: String(appointment.doctor?._id || appointment.doctor),
    appointment: appointmentId,
    snapshot: {
      status: appointment.status,
      date: appointment.date,
      startTime: appointment.startTime,
    },
    requestId: requestId || plan?.planId,
  });

  return { proposal, appointment };
};

export default {
  createWorkflowPlan,
  getWorkflowPlan,
  getActiveWorkflowPlan,
  advanceWorkflowStep,
  completeWorkflowStep,
  failWorkflowStep,
  cancelWorkflow,
  buildWorkflowContextForPrompt,
  prepareAppointmentBookingProposal,
  prepareRescheduleProposal,
  prepareCancelProposal,
};