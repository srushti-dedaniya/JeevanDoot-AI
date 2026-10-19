/**
 * AI orchestrator (Phase 2B): intent -> allow-listed tools -> UI actions.
 *
 * Flow: verified session user + validated classification ->
 *   server-checked tool calls (role, args, ownership) ->
 *   structured { message, toolCalls, actions, requiresConfirmation }.
 *
 * The orchestrator never invents doctors, dates, slots or records. Missing
 * details produce clarification messages. No chain-of-thought is returned.
 */

import { randomUUID } from 'node:crypto';
import { Doctor } from '../../models/index.js';
import { INTENTS } from './intent.js';
import { assertSlotFree, callTool, resolveBookingDoctor, resolveBookingPatientId, resolveModifiableAppointment, assertFutureDate, assertTimeSlot } from './tools.js';
import { issueProposal } from './proposals.js';

const SUGGESTED_SLOTS = ['09:00', '10:30', '12:00', '16:00'];

const doctorNameFilter = (name) => {
  const safe = String(name || '').slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '');
  if (safe.trim().length < 2) return null;
  return new RegExp(safe.trim(), 'i');
};

const toTaskItems = (kind, items) => {
  if (kind === 'appointments') {
    return items.map((a) => ({
      id: a.id,
      title: a.purpose && a.purpose !== 'general' ? `Follow-up: ${a.purpose}` : `Appointment${a.doctor?.name ? ` with ${a.doctor.name}` : ''}`,
      detail: a.doctor?.name ? `${a.doctor.name}${a.doctor.specialization ? ` · ${a.doctor.specialization}` : ''}` : '',
      due: [a.date, a.startTime].filter(Boolean).join(', '),
      status: a.status === 'upcoming' ? 'Upcoming' : a.status,
    }));
  }
  if (kind === 'referrals') {
    return items.map((r) => ({
      id: r.referralId,
      title: r.reason ? `Referral: ${r.reason}` : `Referral to ${r.destination || ''}`,
      detail: r.destination || '',
      due: r.createdAt ? `Raised ${String(r.createdAt).slice(0, 10)}` : '',
      status: r.status || 'pending',
    }));
  }
  return items.map((d) => ({
    id: d.id,
    title: d.name,
    detail: d.specialization || '',
    due: '',
    status: '',
  }));
};

const listingResponse = async ({ user, tool, kind, title, emptyMessage, checkable = false, requestId, provider, intent, entities }) => {
  const items = await callTool(tool, user, {});
  const ledger = [{ tool, ok: true }];
  if (items.length === 0) {
    return { intent, entities, message: emptyMessage, toolCalls: ledger, actions: [], requiresConfirmation: false, requestId, provider };
  }
  return {
    intent, entities,
    message: `Here ${items.length === 1 ? 'is' : 'are'} ${items.length} live record${items.length === 1 ? '' : 's'}.`,
    toolCalls: ledger,
    actions: [{ kind: 'task_list', title, items: toTaskItems(kind, items), ...(checkable ? { checkable: true } : {}) }],
    requiresConfirmation: false, requestId, provider,
  };
};

const resolveDoctorForBooking = async (entities) => {
  // Explicit directory selection is handled client-side; here resolve a name hint.
  if (!entities.doctorName) return { doctor: null, clarification: null };
  const filter = doctorNameFilter(entities.doctorName);
  if (!filter) return { doctor: null, clarification: 'Which doctor did you mean? Please use the directory list on the booking card.' };
  const matches = await Doctor.find({ name: filter }).select('name specialization').limit(5).lean();
  if (matches.length === 1) return { doctor: matches[0], clarification: null };
  if (matches.length > 1) {
    return {
      doctor: null,
      clarification: `I found several matches (${matches.map((m) => m.name).join(', ')}). Please pick one from the directory list on the booking card.`,
    };
  }
  return { doctor: null, clarification: `I could not find a doctor matching “${entities.doctorName}”. Please pick one from the directory list on the booking card.` };
};

const bookingResponse = async ({ user, entities, requestId, provider }) => {
  const intent = INTENTS.BOOK_APPOINTMENT;
  if (user.role !== 'patient') {
    return {
      intent, entities,
      message: 'In-agent appointment booking is available for patient accounts in this phase, using your own patient record. Doctors and admins can book via the appointment and follow-up pages.',
      toolCalls: [], actions: [], requiresConfirmation: false, requestId, provider,
    };
  }

  const ledger = [];
  const needCard = async (note, extra = {}) => {
    const doctors = await callTool('listDoctors', user, {});
    ledger.push({ tool: 'listDoctors', ok: true });
    let bookedSlots = [];
    if (extra.doctorId && extra.date) {
      bookedSlots = await callTool('getAppointmentAvailability', user, { doctorId: extra.doctorId, date: extra.date });
      ledger.push({ tool: 'getAppointmentAvailability', ok: true });
    }
    return {
      intent, entities, message: note, toolCalls: ledger,
      actions: [{
        kind: 'appointment_proposal',
        status: 'needs_info',
        doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialization: d.specialization })),
        doctorId: extra.doctorId || '',
        doctor: extra.doctorLabel || '',
        date: extra.date || '',
        slot: entities.startTime || '',
        slots: SUGGESTED_SLOTS,
        bookedSlots,
      }],
      requiresConfirmation: false, requestId, provider,
    };
  };

  // Resolve doctor: explicit entity hint first, else ask via directory card.
  let doctorId = null;
  let doctorLabel = '';
  if (entities.doctorName) {
    const { doctor, clarification } = await resolveDoctorForBooking(entities);
    if (clarification) {
      const doctors = await callTool('listDoctors', user, {});
      ledger.push({ tool: 'listDoctors', ok: true });
      return {
        intent, entities, message: clarification, toolCalls: ledger,
        actions: [{
          kind: 'appointment_proposal', status: 'needs_info',
          doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialization: d.specialization })),
          doctorId: '', doctor: '', date: entities.date || '', slot: entities.startTime || '',
          slots: SUGGESTED_SLOTS, bookedSlots: [],
        }],
        requiresConfirmation: false, requestId, provider,
      };
    }
    doctorId = String(doctor._id);
    doctorLabel = `${doctor.name} (${doctor.specialization || 'General Medicine'})`;
  }

  if (!doctorId || !entities.date) {
    const missing = [!doctorId ? 'a doctor' : null, !entities.date ? 'a date' : null].filter(Boolean).join(' and ');
    return needCard(`To draft your booking I still need ${missing}. Pick from the directory list below — confirming later creates a real appointment.`, { doctorId, date: entities.date || '' });
  }
  if (!entities.startTime) {
    const booked = await callTool('getAppointmentAvailability', user, { doctorId, date: entities.date });
    ledger.push({ tool: 'getAppointmentAvailability', ok: true });
    const bookedNote = booked.length ? ` Already booked that day: ${booked.join(', ')}.` : ' Nothing is booked with this doctor that day yet.';
    const doctors = await callTool('listDoctors', user, {});
    ledger.push({ tool: 'listDoctors', ok: true });
    return {
      intent, entities,
      message: `Which time works for you?${entities.dayPart ? ` You mentioned the ${entities.dayPart} — please pick an exact slot.` : ''}${bookedNote}`,
      toolCalls: ledger,
      actions: [{
        kind: 'appointment_proposal', status: 'needs_info',
        doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialization: d.specialization })),
        doctorId, doctor: doctorLabel, date: entities.date, slot: '',
        slots: SUGGESTED_SLOTS, bookedSlots: booked,
      }],
      requiresConfirmation: false, requestId, provider,
    };
  }

  // Stage A — prepare: validate everything, check clash, issue proposal. No DB write.
  // Ownership is session-derived: patientId is resolved from the session now
  // and re-verified from the session at confirm time.
  const doctor = await resolveBookingDoctor(doctorId);
  await assertSlotFree(doctorId, entities.date, entities.startTime);
  const patientId = await resolveBookingPatientId(user);
  const proposal = await issueProposal({
    userId: String(user._id),
    role: user.role,
    actionType: 'book',
    patientId,
    doctorId,
    date: entities.date,
    startTime: entities.startTime,
    requestId,
  });
  ledger.push({ tool: 'prepareAppointment', ok: true });
  const doctors = await callTool('listDoctors', user, {});
  return {
    intent, entities,
    message: `Please review this booking and confirm. Confirming creates a real appointment with ${doctor.name} on ${entities.date} at ${entities.startTime}.`,
    toolCalls: ledger,
    actions: [{
      kind: 'appointment_proposal', status: 'awaiting', proposalId: proposal.proposalId,
      doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialization: d.specialization })),
      doctorId, doctor: `${doctor.name} (${doctor.specialization || 'General Medicine'})`,
      date: entities.date, slot: entities.startTime, slots: SUGGESTED_SLOTS, bookedSlots: [],
      expiresAt: proposal.expiresAt,
    }],
    requiresConfirmation: true, requestId, provider,
  };
};

const CLINIC_INFO_MESSAGE =
  'JeevanDoot coordination portal (general information, not clinical advice): this platform supports appointment booking, prescriptions, referrals, follow-up scheduling, health camps and record viewing through the role dashboards. For clinic-specific services and timings, please check with the clinic directly or your dashboard. This assistant does not replace a qualified clinician.';

const GUIDANCE_MESSAGE =
  'I can help with your upcoming appointments, booking a visit, rescheduling or cancelling a visit, finding doctors, referrals and follow-ups. Try “Show my next appointments”, “Reschedule my appointment on Friday”, “Cancel my visit tomorrow” or “I need a doctor tomorrow afternoon”.';

/** Split "reschedule X to Y" style requests into { targetDate, newDate }. */
const splitRescheduleDates = (message, entities) => {
  const text = (message || '').toLowerCase();
  const isoDates = [...text.matchAll(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g)].map((m) => m[0]);
  const toMatch = text.match(/\bto\s+(20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))\b/);
  if (toMatch) {
    const rest = isoDates.filter((d) => d !== toMatch[1]);
    return { targetDate: rest[0] || null, newDate: toMatch[1] };
  }
  if (isoDates.length >= 2) {
    return { targetDate: isoDates[0], newDate: isoDates[isoDates.length - 1] };
  }
  return { targetDate: entities.date || null, newDate: null };
};

const appointmentSummary = (a) => ({
  id: String(a._id),
  doctor: a.doctor && typeof a.doctor === 'object' ? a.doctor.name : '',
  date: a.date ? new Date(a.date).toISOString().slice(0, 10) : '',
  startTime: a.startTime || '',
  status: a.status,
});

const MODIFY_ROLES = ['patient', 'doctor', 'admin'];

const rescheduleResponse = async ({ user, entities, message, requestId, provider }) => {
  const intent = INTENTS.RESCHEDULE_APPOINTMENT;
  if (!MODIFY_ROLES.includes(user.role)) {
    return { intent, entities, message: 'Rescheduling through the assistant is not permitted for your role.', toolCalls: [], actions: [], requiresConfirmation: false, requestId, provider };
  }
  const { targetDate, newDate } = splitRescheduleDates(message, entities);
  if (!targetDate) {
    return { intent, entities, message: 'Which appointment should I reschedule? Tell me its current date (e.g. “reschedule my appointment on 2026-11-02”).', toolCalls: [], actions: [], requiresConfirmation: false, requestId, provider };
  }
  // Throws 404/409/403 honestly when not found, ambiguous, or not permitted.
  const appointment = await resolveModifiableAppointment(user, { date: targetDate });
  const ledger = [{ tool: 'resolveAppointment', ok: true }];
  const finalDate = newDate || entities.date;
  if (!finalDate || !entities.startTime) {
    const missing = [!finalDate ? 'a new date' : null, !entities.startTime ? 'a new time (HH:MM)' : null].filter(Boolean).join(' and ');
    return {
      intent, entities,
      message: `I found your appointment on ${targetDate} at ${appointment.startTime}. To reschedule I still need ${missing}.`,
      toolCalls: ledger,
      actions: [{
        kind: 'appointment_reschedule_proposal', status: 'needs_info',
        existing: appointmentSummary(appointment),
        proposed: { date: finalDate || '', startTime: entities.startTime || '' },
        slots: SUGGESTED_SLOTS,
      }],
      requiresConfirmation: false, requestId, provider,
    };
  }
  assertFutureDate(finalDate);
  assertTimeSlot(entities.startTime);
  await assertSlotFree(appointment.doctor?._id || appointment.doctor, finalDate, entities.startTime, appointment._id);
  const proposal = await issueProposal({
    userId: String(user._id),
    role: user.role,
    actionType: 'reschedule',
    patientId: String(appointment.patient?._id || appointment.patient),
    doctorId: String(appointment.doctor?._id || appointment.doctor),
    appointment: String(appointment._id),
    date: finalDate,
    startTime: entities.startTime,
    snapshot: {
      status: appointment.status,
      date: appointment.date,
      startTime: appointment.startTime,
    },
    requestId,
  });
  ledger.push({ tool: 'prepareReschedule', ok: true });
  return {
    intent, entities,
    message: `Please review and confirm: move your appointment from ${targetDate} at ${appointment.startTime} to ${finalDate} at ${entities.startTime}.`,
    toolCalls: ledger,
    actions: [{
      kind: 'appointment_reschedule_proposal', status: 'awaiting', proposalId: proposal.proposalId,
      existing: appointmentSummary(appointment),
      proposed: { date: finalDate, startTime: entities.startTime },
      slots: SUGGESTED_SLOTS,
      expiresAt: proposal.expiresAt,
    }],
    requiresConfirmation: true, requestId, provider,
  };
};

const cancelResponse = async ({ user, entities, requestId, provider }) => {
  const intent = INTENTS.CANCEL_APPOINTMENT;
  if (!MODIFY_ROLES.includes(user.role)) {
    return { intent, entities, message: 'Cancellation through the assistant is not permitted for your role.', toolCalls: [], actions: [], requiresConfirmation: false, requestId, provider };
  }
  if (!entities.date) {
    return { intent, entities, message: 'Which appointment should I cancel? Tell me its date (e.g. “cancel my appointment on 2026-11-02”). Nothing is cancelled until you confirm the exact proposal.', toolCalls: [], actions: [], requiresConfirmation: false, requestId, provider };
  }
  const appointment = await resolveModifiableAppointment(user, { date: entities.date });
  const ledger = [{ tool: 'resolveAppointment', ok: true }];
  const proposal = await issueProposal({
    userId: String(user._id),
    role: user.role,
    actionType: 'cancel',
    patientId: String(appointment.patient?._id || appointment.patient),
    doctorId: String(appointment.doctor?._id || appointment.doctor),
    appointment: String(appointment._id),
    snapshot: {
      status: appointment.status,
      date: appointment.date,
      startTime: appointment.startTime,
    },
    requestId,
  });
  ledger.push({ tool: 'prepareCancel', ok: true });
  return {
    intent, entities,
    message: `Please confirm: cancel your appointment on ${appointmentSummary(appointment).date} at ${appointment.startTime}${appointment.doctor?.name ? ` with ${appointment.doctor.name}` : ''}? This cannot be undone from the assistant.`,
    toolCalls: ledger,
    actions: [{
      kind: 'appointment_cancel_proposal', status: 'awaiting', proposalId: proposal.proposalId,
      existing: appointmentSummary(appointment),
      expiresAt: proposal.expiresAt,
    }],
    requiresConfirmation: true, requestId, provider,
  };
};

/**
 * Orchestrates one chat turn. Throws ApiError (401/403/404/409/429) for the
 * controller to render honestly; never returns mock or invented records.
 */
export const orchestrate = async ({ user, classification, providerName, message = '' }) => {
  const requestId = randomUUID();
  const provider = { name: providerName, aiGenerated: providerName !== 'local-deterministic' };
  const { intent, entities } = classification;
  const base = { intent, entities, requestId, provider };

  switch (intent) {
    case INTENTS.UPCOMING_APPOINTMENTS:
      return listingResponse({
        user, tool: 'listUpcomingAppointments', kind: 'appointments',
        title: 'Upcoming appointments (live)', emptyMessage: 'You have no upcoming appointments in the live records.',
        ...base,
      });
    case INTENTS.DOCTOR_DIRECTORY: {
      const items = await callTool('listDoctors', user, {});
      if (items.length === 0) {
        return { ...base, message: 'No doctors are currently listed in the system.', toolCalls: [{ tool: 'listDoctors', ok: true }], actions: [], requiresConfirmation: false };
      }
      return {
        ...base,
        message: `I found ${items.length} doctor${items.length === 1 ? '' : 's'} in the live directory.`,
        toolCalls: [{ tool: 'listDoctors', ok: true }],
        actions: [{ kind: 'task_list', title: 'Doctors (live)', items: toTaskItems('doctors', items) }],
        requiresConfirmation: false,
      };
    }
    case INTENTS.REFERRALS:
      return listingResponse({
        user, tool: 'listAuthorizedReferrals', kind: 'referrals',
        title: 'Referrals (live)', emptyMessage: 'No referrals found in the live records for your account.',
        ...base,
      });
    case INTENTS.FOLLOW_UPS:
      return listingResponse({
        user, tool: 'listAuthorizedFollowUps', kind: 'appointments',
        title: 'Follow-up list (from live bookings)', emptyMessage: 'No follow-up appointments found in the live records.',
        checkable: true, ...base,
      });
    case INTENTS.BOOK_APPOINTMENT:
      return bookingResponse({ user, entities, requestId, provider });
    case INTENTS.RESCHEDULE_APPOINTMENT:
      return rescheduleResponse({ user, entities, message, requestId, provider });
    case INTENTS.CANCEL_APPOINTMENT:
      return cancelResponse({ user, entities, requestId, provider });
    case INTENTS.CLINIC_INFORMATION:
      return { ...base, message: CLINIC_INFO_MESSAGE, toolCalls: [], actions: [], requiresConfirmation: false };
    case INTENTS.UNKNOWN_OR_UNSUPPORTED:
    default:
      return { ...base, message: GUIDANCE_MESSAGE, toolCalls: [], actions: [], requiresConfirmation: false };
  }
};

export default { orchestrate };
