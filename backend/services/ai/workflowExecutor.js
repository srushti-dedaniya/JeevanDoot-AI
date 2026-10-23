/**
 * Workflow executor service (Phase 4).
 *
 * Executes workflow steps by coordinating tool calls, proposal preparation,
 * and confirmation handling. Integrates with existing orchestration layer.
 */

import ApiError from '../../utils/ApiError.js';
import { WorkflowPlan, WORKFLOW_STATUSES } from '../../models/index.js';
import {
  callTool,
  resolveBookingDoctor,
  resolveBookingPatientId,
  assertSlotFree,
  resolveModifiableAppointment,
} from './tools.js';
import {
  issueProposal,
  consumeProposal,
  bindAppointment,
  markProposalFailed,
} from './proposals.js';
import {
  startRun,
  transitionRun,
  appendRunEvent,
  linkRunProposal,
} from './agentRuns.js';
import { orchestrate } from './orchestrator.js';
import { INTENTS } from './intent.js';
import { snapshotMatches } from './utils.js';

export const executeWorkflowStep = async ({ plan, user, message = '' }) => {
  if (!plan) throw new ApiError(400, 'No workflow plan provided.');

  const currentStep = plan.steps[plan.currentStepIndex];
  if (!currentStep) throw new ApiError(400, 'No current step found.');

  const context = { ...plan.context };
  let toolCalls = [];
  let proposedAction = null;

  switch (plan.workflowType) {
    case 'appointment_coordination':
      return executeAppointmentCoordinationStep({ plan, user, currentStep, context, message, toolCalls, proposedAction });
    case 'reschedule_cancel':
      return executeRescheduleCancelStep({ plan, user, currentStep, context, message, toolCalls, proposedAction });
    case 'referral_coordination':
      return executeReferralCoordinationStep({ plan, user, currentStep, context, message, toolCalls, proposedAction });
    case 'followup_coordination':
      return executeFollowupCoordinationStep({ plan, user, currentStep, context, message, toolCalls, proposedAction });
    case 'role_aware_coordination':
      return executeRoleAwareCoordinationStep({ plan, user, currentStep, context, message, toolCalls, proposedAction });
    default:
      throw new ApiError(400, `Unknown workflow type: ${plan.workflowType}`);
  }
};

const executeAppointmentCoordinationStep = async ({ plan, user, currentStep, context, message, toolCalls }) => {
  switch (currentStep.name) {
    case 'identify_need':
      if (!context.actionType) {
        if (message) {
          const provider = await import('./provider.js').then(m => m.getProvider());
          const classification = await provider.classify({ message, history: [] });
          context.actionType = classification.intent === INTENTS.BOOK_APPOINTMENT ? 'book' :
                               classification.intent === INTENTS.RESCHEDULE_APPOINTMENT ? 'reschedule' :
                               classification.intent === INTENTS.CANCEL_APPOINTMENT ? 'cancel' : 'book';
        } else {
          context.actionType = 'book';
        }
      }
      break;

    case 'select_doctor':
      if (!context.doctorId) {
        const doctors = await callTool('listDoctors', user, {});
        if (doctors.length === 0) throw new ApiError(404, 'No doctors available.');
        toolCalls.push({ tool: 'listDoctors', ok: true });

        if (context.doctorName) {
          const doctor = doctors.find(d => d.name.toLowerCase().includes(context.doctorName.toLowerCase()));
          if (doctor) {
            context.doctorId = doctor.id;
            context.doctorLabel = `${doctor.name} (${doctor.specialization})`;
          } else {
            throw new ApiError(404, `Doctor "${context.doctorName}" not found.`);
          }
        }
      }
      break;

    case 'select_datetime':
      if (!context.date) {
        const today = new Date().toISOString().slice(0, 10);
        throw new ApiError(400, `Please provide a date (YYYY-MM-DD) from ${today} onwards.`);
      }
      if (!context.startTime) {
        if (context.doctorId && context.date) {
          const booked = await callTool('getAppointmentAvailability', user, { doctorId: context.doctorId, date: context.date });
          toolCalls.push({ tool: 'getAppointmentAvailability', ok: true });
          if (booked.length > 0) {
            context.bookedSlots = booked;
          }
        }
      }
      break;

    case 'check_availability':
      if (context.doctorId && context.date && context.startTime) {
        await assertSlotFree(context.doctorId, context.date, context.startTime);
        toolCalls.push({ tool: 'assertSlotFree', ok: true });
      }
      break;

    case 'prepare_proposal':
      if (context.actionType === 'book') {
        const { proposal, doctor } = await prepareBookingProposal({ user, context, requestId: plan.planId });
        proposedAction = {
          kind: 'appointment_proposal',
          status: 'awaiting',
          proposalId: proposal.proposalId,
          doctorId: context.doctorId,
          doctor: `${doctor.name} (${doctor.specialization || 'General Medicine'})`,
          date: context.date,
          slot: context.startTime,
          slots: ['09:00', '10:30', '12:00', '16:00'],
          bookedSlots: context.bookedSlots || [],
          expiresAt: proposal.expiresAt,
        };
        plan.proposalId = proposal.proposalId;
      }
      break;

    case 'await_confirmation':
      proposedAction = {
        kind: 'appointment_proposal',
        status: 'awaiting',
        proposalId: plan.proposalId,
        doctorId: context.doctorId,
        doctor: context.doctorLabel || '',
        date: context.date,
        slot: context.startTime,
        slots: ['09:00', '10:30', '12:00', '16:00'],
        bookedSlots: context.bookedSlots || [],
      };
      break;

    case 'execute_booking':
      if (plan.proposalId) {
        const { proposal, replay } = await consumeProposal(plan.proposalId, String(user._id));
        if (!replay) {
          const appointment = await confirmBooking({ user, proposal });
          await bindAppointment(plan.proposalId, appointment.id);
          plan.appointmentId = appointment.id;
          proposedAction = { kind: 'appointment_confirmed', appointment };
        } else {
          proposedAction = { kind: 'appointment_confirmed', appointment: replay.proposal.appointmentId, duplicate: true };
        }
      }
      break;
  }

  return { context, toolCalls, proposedAction };
};

const executeRescheduleCancelStep = async ({ plan, user, currentStep, context, message, toolCalls }) => {
  switch (currentStep.name) {
    case 'identify_appointment':
      if (!context.appointmentId && !context.date) {
        throw new ApiError(400, 'Please specify which appointment to modify (by date or ID).');
      }
      break;

    case 'verify_ownership':
      if (context.appointmentId) {
        const appointment = await resolveModifiableAppointment(user, { appointmentId: context.appointmentId });
        context.appointment = appointment;
        context.appointmentId = String(appointment._id);
      } else if (context.date) {
        const appointment = await resolveModifiableAppointment(user, { date: context.date });
        context.appointment = appointment;
        context.appointmentId = String(appointment._id);
      }
      break;

    case 'get_new_details':
      if (!context.newDate || !context.newStartTime) {
        throw new ApiError(400, 'Please provide the new date and time for rescheduling.');
      }
      break;

    case 'check_availability':
      if (context.appointment && context.newDate && context.newStartTime) {
        await assertSlotFree(String(context.appointment.doctor?._id || context.appointment.doctor), context.newDate, context.newStartTime, context.appointment._id);
        toolCalls.push({ tool: 'assertSlotFree', ok: true });
      }
      break;

    case 'prepare_proposal':
      if (context.actionType === 'reschedule' || context.actionType === 'cancel') {
        const { proposal } = context.actionType === 'reschedule'
          ? await prepareRescheduleProposal({ user, context: { appointmentId: context.appointmentId, newDate: context.newDate, newStartTime: context.newStartTime }, requestId: plan.planId })
          : await prepareCancelProposal({ user, context: { appointmentId: context.appointmentId }, requestId: plan.planId });
        plan.proposalId = proposal.proposalId;
      }
      break;

    case 'await_confirmation':
      proposedAction = {
        kind: context.actionType === 'reschedule' ? 'appointment_reschedule_proposal' : 'appointment_cancel_proposal',
        status: 'awaiting',
        proposalId: plan.proposalId,
        existing: context.appointment ? { id: String(context.appointment._id), date: context.appointment.date, startTime: context.appointment.startTime } : null,
        proposed: context.newDate ? { date: context.newDate, startTime: context.newStartTime } : null,
      };
      break;

    case 'execute_change':
      if (plan.proposalId) {
        const { proposal, replay } = await consumeProposal(plan.proposalId, String(user._id));
        if (!replay) {
          let result;
          if (context.actionType === 'reschedule') {
            result = await confirmReschedule({ user, proposal });
          } else {
            result = await confirmCancel({ user, proposal });
          }
          await bindAppointment(plan.proposalId, result.appointment.id);
          plan.appointmentId = result.appointment.id;
          proposedAction = { kind: 'appointment_updated', appointment: result.appointment };
        } else {
          proposedAction = { kind: 'appointment_updated', appointment: replay.proposal.appointmentId, duplicate: true };
        }
      }
      break;
  }

  return { context, toolCalls, proposedAction };
};

const executeReferralCoordinationStep = async ({ plan, user, currentStep, context, message, toolCalls }) => {
  switch (currentStep.name) {
    case 'gather_referral_details':
      if (!context.reason || !context.destination || !context.priority) {
        throw new ApiError(400, 'Please provide referral reason, destination facility, and priority.');
      }
      break;

    case 'verify_authorization':
      if (user.role === 'patient' || user.role === 'ngo') {
        throw new ApiError(403, 'Referral creation is not permitted for your role.');
      }
      break;

    case 'prepare_proposal':
      // Referral creation would be implemented here
      // For now, we create a proposal-like structure
      plan.proposalId = `REF-${Date.now()}`;
      proposedAction = {
        kind: 'referral_proposal',
        status: 'awaiting',
        proposalId: plan.proposalId,
        reason: context.reason,
        destination: context.destination,
        priority: context.priority,
      };
      break;

    case 'await_confirmation':
      proposedAction = {
        kind: 'referral_proposal',
        status: 'awaiting',
        proposalId: plan.proposalId,
        reason: context.reason,
        destination: context.destination,
        priority: context.priority,
      };
      break;

    case 'execute_referral':
      proposedAction = { kind: 'referral_created', referralId: plan.proposalId };
      break;
  }

  return { context, toolCalls, proposedAction };
};

const executeFollowupCoordinationStep = async ({ plan, user, currentStep, context, message, toolCalls }) => {
  switch (currentStep.name) {
    case 'identify_followup_context':
      const appointments = await callTool('listUpcomingAppointments', user, {});
      toolCalls.push({ tool: 'listUpcomingAppointments', ok: true });
      context.upcomingAppointments = appointments;
      break;

    case 'verify_followup_api':
      context.hasFollowupApi = false;
      break;

    case 'prepare_action':
      if (!context.date || !context.startTime || !context.reason) {
        throw new ApiError(400, 'Please provide follow-up date, time, and reason.');
      }
      break;

    case 'await_confirmation':
      proposedAction = {
        kind: 'followup_proposal',
        status: 'awaiting',
        date: context.date,
        startTime: context.startTime,
        reason: context.reason,
      };
      break;

    case 'execute_followup':
      const appointment = await Appointment.create({
        patient: context.patientId,
        doctor: context.doctorId,
        date: context.date,
        startTime: context.startTime,
        purpose: context.reason,
        status: 'upcoming',
      });
      proposedAction = { kind: 'followup_created', appointment };
      break;
  }

  return { context, toolCalls, proposedAction };
};

const executeRoleAwareCoordinationStep = async ({ plan, user, currentStep, context, message, toolCalls }) => {
  const allowedActions = getAllowedActionsForRole(user.role);

  switch (currentStep.name) {
    case 'identify_role_permissions':
      context.allowedActions = allowedActions;
      break;

    case 'gather_task_details':
      if (!context.taskType || !allowedActions.includes(context.taskType)) {
        throw new ApiError(400, `Task type "${context.taskType}" not allowed for role ${user.role}.`);
      }
      break;

    case 'verify_authorization':
      if (!allowedActions.includes(context.taskType)) {
        throw new ApiError(403, `Action "${context.taskType}" not permitted for role ${user.role}.`);
      }
      break;

    case 'prepare_proposal':
      plan.proposalId = `WFP-${Date.now()}`;
      proposedAction = {
        kind: 'role_action_proposal',
        status: 'awaiting',
        taskType: context.taskType,
        details: context.taskDetails,
      };
      break;

    case 'await_confirmation':
      proposedAction = {
        kind: 'role_action_proposal',
        status: 'awaiting',
        proposalId: plan.proposalId,
        taskType: context.taskType,
        details: context.taskDetails,
      };
      break;

    case 'execute_task':
      proposedAction = { kind: 'role_action_completed', taskType: context.taskType };
      break;
  }

  return { context, toolCalls, proposedAction };
};

const getAllowedActionsForRole = (role) => {
  const actions = {
    patient: ['view_appointments', 'book_appointment', 'reschedule_own', 'cancel_own', 'view_referrals', 'view_followups'],
    doctor: ['view_own_schedule', 'view_patient_appointments', 'create_referral', 'schedule_followup', 'write_prescription'],
    admin: ['view_all_appointments', 'manage_doctors', 'view_audit', 'manage_settings'],
    ngo: ['view_camps', 'manage_donations', 'view_impact'],
    government: ['view_surveillance', 'view_schemes', 'view_queries', 'view_analytics'],
  };
  return actions[role] || [];
};

const prepareBookingProposal = async ({ user, context, requestId }) => {
  const { doctorId, date, startTime } = context;
  const doctor = await resolveBookingDoctor(doctorId);
  await assertSlotFree(doctorId, date, startTime);
  const patientId = await resolveBookingPatientId(user);

  const { issueProposal } = await import('./proposals.js');
  const proposal = await issueProposal({
    userId: String(user._id),
    role: user.role,
    actionType: 'book',
    patientId,
    doctorId,
    date,
    startTime,
    requestId,
  });

  return { proposal, doctor };
};

const prepareRescheduleProposal = async ({ user, context, requestId }) => {
  const { appointmentId, newDate, newStartTime } = context;
  const appointment = await resolveModifiableAppointment(user, { appointmentId });
  await assertSlotFree(String(appointment.doctor?._id || appointment.doctor), newDate, newStartTime, appointment._id);

  const { issueProposal } = await import('./proposals.js');
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
    requestId,
  });

  return { proposal, appointment };
};

const prepareCancelProposal = async ({ user, context, requestId }) => {
  const { appointmentId } = context;
  const appointment = await resolveModifiableAppointment(user, { appointmentId });

  const { issueProposal } = await import('./proposals.js');
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
    requestId,
  });

  return { proposal, appointment };
};

const confirmBooking = async ({ user, proposal }) => {
  const patientId = await resolveBookingPatientId(user);
  if (patientId !== String(proposal.patient)) {
    throw new ApiError(403, 'This confirmation does not belong to your patient record.');
  }
  await resolveBookingDoctor(String(proposal.doctor));
  await assertSlotFree(String(proposal.doctor), proposal.date, proposal.startTime);

  let appointment;
  try {
    appointment = await (await import('../../models/index.js')).Appointment.create({
      patient: proposal.patient,
      doctor: proposal.doctor,
      purpose: proposal.purpose || 'general',
      date: proposal.date,
      startTime: proposal.startTime,
      notes: proposal.notes || '',
    });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, 'The doctor is already booked at this time.');
    throw error;
  }

  return { id: String(appointment._id), status: appointment.status, date: appointment.date, startTime: appointment.startTime };
};

const confirmReschedule = async ({ user, proposal }) => {
  const appointment = await (await import('../../models/index.js')).Appointment.findById(proposal.appointment)
    .populate('doctor', 'name specialization')
    .populate('patient', 'patientId')
    .lean();
  if (!appointment) throw new ApiError(404, 'The appointment no longer exists.');

  await resolveModifiableAppointment(user, { appointmentId: String(appointment._id) });

  if (!snapshotMatches(proposal, appointment)) {
    throw new ApiError(409, 'The appointment changed since this proposal was prepared. Please start again.');
  }

  await assertSlotFree(String(proposal.doctor), proposal.date, proposal.startTime, appointment._id);

  const updated = await (await import('../../models/index.js')).Appointment.findOneAndUpdate(
    { _id: appointment._id, status: 'upcoming', date: appointment.date, startTime: proposal.snapshot?.startTime || appointment.startTime },
    { $set: { date: proposal.date, startTime: proposal.startTime } },
    { new: true, runValidators: true }
  )
    .populate('doctor', 'name specialization')
    .populate('patient', 'patientId')
    .lean();
  if (!updated) throw new ApiError(409, 'The appointment changed since this proposal was prepared. Please start again.');

  return { id: String(updated._id), status: updated.status, date: updated.date, startTime: updated.startTime };
};

const confirmCancel = async ({ user, proposal }) => {
  const appointment = await (await import('../../models/index.js')).Appointment.findById(proposal.appointment).lean();
  if (!appointment) throw new ApiError(404, 'The appointment no longer exists.');

  await resolveModifiableAppointment(user, { appointmentId: String(appointment._id) });

  if (!snapshotMatches(proposal, appointment)) {
    throw new ApiError(409, 'The appointment changed since this proposal was prepared. Please start again.');
  }

  const updated = await (await import('../../models/index.js')).Appointment.findOneAndUpdate(
    { _id: appointment._id, status: 'upcoming' },
    { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledReason: proposal.reason || 'Cancelled via JeevanDoot AI' } },
    { new: true }
  ).lean();
  if (!updated) throw new ApiError(409, 'The appointment was already cancelled.');

  return { id: String(updated._id), status: updated.status };
};

export default { executeWorkflowStep };