/**
 * aiAgentService.js — Phase 2A real-mode data layer for JeevanDoot AI.
 *
 * Uses the existing shared `api` client (JWT Bearer, VITE_API_BASE_URL,
 * 401 session handling) — no new transport, no secrets in frontend code.
 *
 * Rules enforced here:
 *  - Real mode NEVER falls back to mock data on failure (errors propagate).
 *  - Identity always comes from the authenticated session (/patients/me,
 *    /doctors/me). The frontend never picks an arbitrary patient ID.
 *  - No tokens or health details are logged.
 *  - Duplicate submissions are guarded with in-flight request deduplication.
 */

import { api, isMockMode } from './api';
import { classifyAgentError } from './aiAgentHelpers';

/** 'demo' when VITE_ENABLE_MOCK_API !== 'false', otherwise 'real'. */
export const getAiMode = () => (isMockMode() ? 'demo' : 'real');
export const isRealMode = () => getAiMode() === 'real';

// Session-scoped identity cache (avoids duplicate /me requests per page view).
let identityCache = null;
let identityPromise = null;

export const clearAgentIdentityCache = () => {
  identityCache = null;
  identityPromise = null;
};

/**
 * Resolves the caller's own domain identity from the session.
 * Patient -> { kind: 'patient', id (ObjectId), patientId }
 * Doctor  -> { kind: 'doctor', id (ObjectId) }
 * Others  -> { kind: <role>, id: null }
 */
export const resolveOwnIdentity = async (role) => {
  if (identityCache && identityCache.role === role) return identityCache;
  if (identityPromise) return identityPromise;
  identityPromise = (async () => {
    try {
      if (role === 'patient') {
        const { data } = await api.get('/patients/me');
        identityCache = { role, kind: 'patient', id: data?._id || null, patientId: data?.patientId || null };
      } else if (role === 'doctor') {
        const { data } = await api.get('/doctors/me');
        identityCache = { role, kind: 'doctor', id: data?._id || data?.id || null };
      } else {
        identityCache = { role, kind: role, id: null };
      }
      return identityCache;
    } finally {
      identityPromise = null;
    }
  })();
  return identityPromise;
};

/** Real upcoming appointments visible to this role (own scope for patient/doctor). */
export const getUpcomingAppointments = async (role) => {
  if (role === 'patient') {
    const { data } = await api.get('/patients/me/appointments', { status: 'upcoming', limit: 50 });
    return data || [];
  }
  if (role === 'doctor') {
    const me = await resolveOwnIdentity('doctor');
    if (!me?.id) throw Object.assign(new Error('Doctor profile not found.'), { status: 404 });
    const { data } = await api.get('/appointments', { doctor: me.id, status: 'upcoming', limit: 50 });
    return data || [];
  }
  if (role === 'admin' || role === 'government') {
    const { data } = await api.get('/appointments', { status: 'upcoming', limit: 50 });
    return data || [];
  }
  // NGO has no appointment read permission on the backend (403 by design).
  throw Object.assign(new Error('Your role does not have permission to view appointments.'), { status: 403 });
};

/** Real referral list visible to this role (own scope for patient/doctor). */
export const getReferrals = async (role) => {
  if (role === 'ngo') {
    throw Object.assign(new Error('Your role does not have permission to view referrals.'), { status: 403 });
  }
  const { data } = await api.get('/referrals', { limit: 100 });
  const items = data || [];
  if (role === 'patient') {
    const me = await resolveOwnIdentity('patient');
    if (!me?.patientId) throw Object.assign(new Error('Patient profile not found.'), { status: 404 });
    return items.filter((r) => r.patient?.patientId === me.patientId);
  }
  if (role === 'doctor') {
    const me = await resolveOwnIdentity('doctor');
    if (!me?.id) throw Object.assign(new Error('Doctor profile not found.'), { status: 404 });
    return items.filter((r) => (r.doctor?._id || r.doctor) === me.id);
  }
  return items;
};

/**
 * Follow-ups: the backend has NO dedicated follow-up endpoint (documented gap).
 * Honest proxy: upcoming appointments, which is also how FollowUpScheduling
 * works (it books appointments with a follow-up purpose). The UI labels this.
 */
export const getFollowUps = (role) => getUpcomingAppointments(role);

/** Doctors the caller may book with (backend permits all roles incl. patient). */
export const getBookableDoctors = async () => {
  const { data } = await api.get('/doctors', { limit: 100 });
  return (data || []).map((d) => ({
    id: d._id || d.id,
    name: d.name,
    specialization: d.specialization || 'General Medicine',
  }));
};

/** Booked startTimes for a doctor on a YYYY-MM-DD date (conflict preview). */
export const getBookedSlots = async (doctorId, yyyyMmDd) => {
  const { data } = await api.get('/appointments/availability', { doctor: doctorId, date: yyyyMmDd });
  return data?.booked || [];
};

// In-flight guard against duplicate booking submissions.
let bookingInFlight = false;

/**
 * Creates a REAL appointment. Resolves success only on backend 201.
 * Throws 400/404/409 honestly — never simulates success.
 */
export const createAppointmentReal = async ({ role, doctorId, date, startTime, purpose = 'general', notes = '' }) => {
  if (bookingInFlight) {
    throw Object.assign(new Error('A booking request is already in progress. Please wait.'), { status: 429 });
  }
  if (!doctorId || !date || !startTime) {
    throw Object.assign(new Error('Doctor, date and time slot are required.'), { status: 400 });
  }
  bookingInFlight = true;
  try {
    // Phase 2A: the agent books the caller's OWN patient record only.
    // Doctor/admin booking for other patients stays in the dedicated
    // FollowUpScheduling / appointment pages (needs explicit patient context).
    if (role !== 'patient') {
      throw Object.assign(new Error('In-agent appointment booking is available for patient accounts in this phase. Doctors and admins can book via the appointment pages.'), { status: 403 });
    }
    const me = await resolveOwnIdentity('patient');
    if (!me?.id) throw Object.assign(new Error('Patient profile not found.'), { status: 404 });
    const patientObjectId = me.id;
    const { data } = await api.post('/appointments', {
      patient: patientObjectId,
      doctor: doctorId,
      purpose,
      date,
      startTime,
      notes,
    });
    return data;
  } finally {
    bookingInFlight = false;
  }
};

/** Reschedule is backend-supported (PUT /appointments/:id, patient/doctor/admin). */
export const rescheduleAppointmentReal = async (id, { date, startTime }) => {
  if (!id) throw Object.assign(new Error('Appointment id is required.'), { status: 400 });
  const { data } = await api.put(`/appointments/${id}`, {
    ...(date ? { date } : {}),
    ...(startTime ? { startTime } : {}),
  });
  return data;
};

/** Cancel is backend-supported (POST /appointments/:id/cancel). */
export const cancelAppointmentReal = async (id, reason = '') => {
  if (!id) throw Object.assign(new Error('Appointment id is required.'), { status: 400 });
  const { data } = await api.post(`/appointments/${id}/cancel`, { reason });
  return data;
};

/**
 * Phase 2B orchestrator transport. Sends the user message + bounded history
 * to POST /ai/chat; the server derives identity/role from the JWT session.
 * Returns { intent, entities, message, toolCalls, actions,
 *   requiresConfirmation, requestId, provider }.
 */
export const sendAgentChat = async (message, history = []) => {
  const { data } = await api.post('/ai/chat', {
    message,
    history: (history || []).slice(-10).map((m) => ({
      from: m.from === 'assistant' ? 'assistant' : 'user',
      text: String(m.text || '').slice(0, 2000),
    })),
  });
  return data;
};

/**
 * Stage B confirmation, bound server-side to the session user + proposal.
 * Resolves only on a confirmed backend booking (or idempotent replay).
 * Returns { appointment: { id, status, ... }, duplicate, requestId }.
 */
export const confirmAgentProposal = async (proposalId) => {
  if (!proposalId) throw Object.assign(new Error('A booking proposal is required before confirming.'), { status: 400 });
  const { data } = await api.post('/ai/confirm', { proposalId });
  return data;
};

/** Caller's own agent runs (paginated server-side). */
export const getAgentRuns = async (params = {}) => {
  const { data, meta } = await api.get('/ai/runs', { limit: 20, ...params });
  return { runs: data || [], meta };
};

/** One agent run (own, or any for admins). */
export const getAgentRun = async (requestId) => {
  const { data } = await api.get(`/ai/runs/${requestId}`);
  return data;
};

/** All agent runs with filters (admin only). */
export const getAllAgentRuns = async (params = {}) => {
  const { data, meta } = await api.get('/ai/admin/runs', { limit: 20, ...params });
  return { runs: data || [], meta };
};

export { classifyAgentError };
