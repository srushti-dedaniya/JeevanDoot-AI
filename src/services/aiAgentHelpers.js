/**
 * aiAgentHelpers.js — pure, dependency-free helpers for the JeevanDoot AI agent.
 *
 * Kept free of Vite (`import.meta`) and browser globals so it runs under
 * `node --test` (see `npm run test:ai`). The real-mode service
 * (`aiAgentService.js`) and the UI import from here.
 */

export const INTENTS = Object.freeze({
  BOOK: 'book',
  UPCOMING: 'upcoming',
  REFERRALS: 'referrals',
  FOLLOWUPS: 'followups',
  SERVICES: 'services',
  ERROR: 'error',
  UNKNOWN: 'unknown',
});

const includesAny = (text, words) => words.some((w) => text.includes(w));

/** Local keyword intent matcher (Phase 2A). Phase 2B replaces this with a real classifier. */
export const matchIntent = (message) => {
  const text = (message || '').toLowerCase().trim();
  if (!text) return INTENTS.UNKNOWN;
  if (includesAny(text, ['error', 'fail', 'something went wrong'])) return INTENTS.ERROR;
  if (includesAny(text, ['book', 'new appointment', 'schedule', 'appointment tomorrow'])) return INTENTS.BOOK;
  if (includesAny(text, ['upcoming'])) return INTENTS.UPCOMING;
  if (includesAny(text, ['referral'])) return INTENTS.REFERRALS;
  if (includesAny(text, ['follow'])) return INTENTS.FOLLOWUPS;
  if (includesAny(text, ['service', 'clinic', 'facility', 'offer'])) return INTENTS.SERVICES;
  return INTENTS.UNKNOWN;
};

/**
 * Maps a thrown request error to a UI-safe descriptor.
 * Never includes tokens or health details — only status-derived codes.
 */
export const classifyAgentError = (err) => {
  if (!err || typeof err !== 'object') {
    return { code: 'server', message: 'Something went wrong. Please try again.' };
  }
  // Network failure: fetch rejects with a TypeError (no response received).
  if (err instanceof TypeError || err.code === 'ERR_NETWORK' || /failed to fetch|networkerror|load failed/i.test(err.message || '')) {
    return { code: 'network', message: 'Network error — the server could not be reached. Check your connection and retry.' };
  }
  const status = Number(err.status);
  if (status === 401) {
    return { code: 'auth', message: 'Your session has expired. Please log in again.' };
  }
  if (status === 403) {
    return { code: 'forbidden', message: 'Your role does not have permission for this action.' };
  }
  if (status === 404) {
    return { code: 'not_found', message: err.message || 'The requested record was not found.' };
  }
  if (status === 409) {
    return { code: 'conflict', message: err.message || 'This slot is already booked. Please pick another time.' };
  }
  if (status >= 400 && status < 500) {
    return { code: 'validation', message: err.message || 'Some details were invalid. Please review and try again.' };
  }
  return { code: 'server', message: err.message || 'Server error. Please try again in a moment.' };
};

const doctorName = (a) => (a.doctor && typeof a.doctor === 'object' ? a.doctor.name : '') || 'Doctor';

export const formatDue = (date, startTime) => {
  if (!date) return startTime || '';
  const d = new Date(date);
  const day = Number.isNaN(d.getTime()) ? String(date) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return startTime ? `${day}, ${startTime}` : day;
};

/** Raw GET /patients/me/appointments or GET /appointments items -> tasklist rows. */
export const mapAppointmentsToTasks = (items) =>
  (items || []).map((a) => ({
    id: a._id || a.id,
    title: a.purpose && a.purpose !== 'general' ? `Follow-up: ${a.purpose}` : `Appointment with ${doctorName(a)}`,
    detail: `${doctorName(a)}${a.doctor?.specialization ? ` · ${a.doctor.specialization}` : ''}`,
    due: formatDue(a.date, a.startTime),
    status: a.status === 'upcoming' ? 'Upcoming' : a.status === 'cancelled' ? 'Cancelled' : 'Completed',
  }));

/** Raw GET /referrals items -> tasklist rows. */
export const mapReferralsToTasks = (items) =>
  (items || []).map((r) => ({
    id: r.referralId || r._id || r.id,
    title: r.reason ? `Referral: ${r.reason}` : `Referral to ${r.destination || ''}`,
    detail: r.destination || '',
    due: r.createdAt ? `Raised ${formatDue(r.createdAt)}` : '',
    status: r.status || 'pending',
  }));
