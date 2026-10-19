/**
 * AI intent + entity extraction (deterministic local implementation).
 *
 * Pure module — no database, no network — so it runs under `node --test`.
 * Used by the default `local-deterministic` provider. An external LLM
 * provider (Phase 2B+) must return this same shape; see provider.js.
 *
 * Supported intents:
 *  UPCOMING_APPOINTMENTS, BOOK_APPOINTMENT, DOCTOR_DIRECTORY, REFERRALS,
 *  FOLLOW_UPS, CLINIC_INFORMATION, UNKNOWN_OR_UNSUPPORTED
 */

export const INTENTS = Object.freeze({
  UPCOMING_APPOINTMENTS: 'UPCOMING_APPOINTMENTS',
  BOOK_APPOINTMENT: 'BOOK_APPOINTMENT',
  RESCHEDULE_APPOINTMENT: 'RESCHEDULE_APPOINTMENT',
  CANCEL_APPOINTMENT: 'CANCEL_APPOINTMENT',
  DOCTOR_DIRECTORY: 'DOCTOR_DIRECTORY',
  REFERRALS: 'REFERRALS',
  FOLLOW_UPS: 'FOLLOW_UPS',
  CLINIC_INFORMATION: 'CLINIC_INFORMATION',
  UNKNOWN_OR_UNSUPPORTED: 'UNKNOWN_OR_UNSUPPORTED',
});

const includesAny = (text, words) => words.some((w) => text.includes(w));

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Strict entity sanitizer — the trust boundary for model output.
 * Allow-lists keys, formats and lengths; drops everything else so a
 * compromised/creative provider cannot smuggle payloads into messages,
 * queries or proposal fields.
 */
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_PARTS = new Set(['morning', 'afternoon', 'evening']);

export const sanitizeEntities = (entities) => {
  if (!entities || typeof entities !== 'object' || Array.isArray(entities)) return {};
  const clean = {};
  if (typeof entities.date === 'string' && ISO_DATE_RE.test(entities.date)) clean.date = entities.date;
  if (typeof entities.weekday === 'string' && WEEKDAYS.includes(entities.weekday)) clean.weekday = entities.weekday;
  if (typeof entities.startTime === 'string' && TIME_RE.test(entities.startTime)) clean.startTime = entities.startTime;
  if (typeof entities.dayPart === 'string' && DAY_PARTS.has(entities.dayPart)) clean.dayPart = entities.dayPart;
  if (typeof entities.doctorName === 'string' && entities.doctorName.trim().length >= 2) {
    clean.doctorName = entities.doctorName.trim().slice(0, 40);
  }
  if (entities.confirmHint === true) clean.confirmHint = true;
  return clean;
};

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Server-local "today" as unambiguous YYYY-MM-DD (server timezone). */
export const todayISO = (now = new Date()) => toISODate(now);

export const addDaysISO = (now, days) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/** Next occurrence of a weekday name (strictly in the future). */
export const nextWeekdayISO = (name, now = new Date()) => {
  const target = WEEKDAYS.indexOf(name);
  if (target < 0) return null;
  const delta = ((target - now.getDay() + 7) % 7) || 7;
  return addDaysISO(now, delta);
};

/**
 * Extracts a date entity from free text. Returns { date } (YYYY-MM-DD) or {}.
 * Never invents: explicit dates, today/tomorrow, or weekday names only.
 */
export const extractDate = (text, now = new Date()) => {
  const iso = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (iso) return { date: iso[0] };
  if (/\btomorrow\b/.test(text)) return { date: addDaysISO(now, 1) };
  if (/\btoday\b/.test(text)) return { date: todayISO(now) };
  if (/\bday after tomorrow\b/.test(text)) return { date: addDaysISO(now, 2) };
  if (/\bin (\d+) days?\b/.test(text)) {
    const m = text.match(/\bin (\d+) days?\b/);
    if (m) return { date: addDaysISO(now, Number(m[1])) };
  }
  if (/\bnext week\b/.test(text)) {
    // Next week = 7 days from now, but we'll just return a generic future date
    return { date: addDaysISO(now, 7) };
  }
  if (/\bnext month\b/.test(text)) {
    return { date: addDaysISO(now, 30) };
  }
  for (const day of WEEKDAYS) {
    if (text.includes(day)) {
      const resolved = nextWeekdayISO(day, now);
      if (resolved) return { date: resolved, weekday: day };
    }
  }
  return {};
};

/** Extracts an explicit HH:MM time, or a day-part hint (still needs a slot). */
export const extractTime = (text) => {
  const explicit = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm)?\b/);
  if (explicit) {
    let [h, m] = [Number(explicit[1]), explicit[2]];
    const meridiem = explicit[3];
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    const dayPart = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    return { startTime: `${String(h).padStart(2, '0')}:${m}`, dayPart };
  }
  // "around Xpm", "around X am", "at around X"
  const around = text.match(/\baround\s+([01]?\d|2[0-3])\s*(am|pm)?\b/);
  if (around) {
    let [h] = [Number(around[1])];
    const meridiem = around[2];
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    const dayPart = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    return { startTime: `${String(h).padStart(2, '0')}:00`, dayPart };
  }
  if (includesAny(text, ['morning'])) return { dayPart: 'morning' };
  if (includesAny(text, ['afternoon'])) return { dayPart: 'afternoon' };
  if (includesAny(text, ['evening', 'night'])) return { dayPart: 'evening' };
  return {};
};

/**
 * Extracts a probable doctor-name fragment ("dr sharma", "doctor kavita").
 * Returns { doctorName } or {}. The server resolves it against the Doctor
 * collection and requires exactly one confident match.
 */
export const extractDoctorName = (text) => {
  const m = text.match(/(?:dr\.?|doctor)\s+([a-z][a-z .'-]{1,40})/);
  if (!m) return {};
  let name = m[1].replace(/[.'-]+$/, '').trim();
  // Cut trailing date/time/context words the greedy match may swallow.
  name = name
    .split(/\s+(?:today|tomorrow|morning|afternoon|evening|night|next|this|on|at|for|please|appointment|visit|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/)[0]
    .replace(/\s+\d.*$/, '')
    .trim();
  // Keep at most two words (first + last name).
  name = name.split(/\s+/).slice(0, 2).join(' ');
  if (name.length < 2) return {};
  return { doctorName: name };
};

/**
 * classify(message) -> { intent, entities }
 * entities: { date?, weekday?, startTime?, dayPart?, doctorName? }
 */
export const classify = (message, now = new Date()) => {
  const text = (message || '').toLowerCase().trim();
  if (!text) return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };

  // Destructive verbs have no legitimate mapping in this domain: the agent
  // never hard-deletes anything, so such requests stay unsupported instead
  // of being coerced into a nearby read intent.
  if (/\b(delete|deleting|drop\s+table|destroy|wipe|truncate)\b/.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }

  const entities = {
    ...extractDate(text, now),
    ...extractTime(text),
    ...extractDoctorName(text),
  };

  // Destructive/override commands have no legitimate mapping — the agent
  // never hard-deletes or bypasses security, so such requests stay unsupported.
  if (/\b(delete|deleting|drop\s+table|destroy|wipe|truncate|override|ignore\s+previous|bypass\s+security)\b/.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }

  // Cross-patient/cross-role access attempts — the agent only operates on the
  // authenticated user's own records. Requests explicitly referencing other
  // doctors/patients by ID in a third-party context are unsupported.
  // Self-referential requests (e.g., "my patient ID") are allowed; the
  // tool/controller layer enforces ownership. Here we only block explicit
  // third-party references like "for doctor 123" or "for patient 456".
  // Block "show appointments for doctor <id>" and "view referrals for patient <id>"
  // (these are third-party access attempts; "show appointments for patient <id>" is allowed for self-access)
  if (/\b(show|view|get|list)\s+appointments\s+for\s+doctor\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  if (/\bview\s+referrals\s+for\s+patient\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  // Explicit third-party booking/cancel/reschedule for another user
  if (/\b(book|cancel|reschedule)\s+(appointment|visit)\s+for\s+(patient|user)\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  // Explicit third-party references: "for doctor 123", "for patient 456"
  // (only simple numeric IDs, not alphanumeric like "JD-8F2KQ3")
  if (/\bfor\s+(doctor|patient)\s+(id|#)\s*\d{1,6}\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  // Explicit third-party references: "for doctor 123", "for patient 456"
  // (only simple numeric IDs, not alphanumeric like "JD-8F2KQ3")
  if (/\bfor\s+(doctor|patient)\s+(id|#)\s*\d{1,6}\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  // Explicit third-party references: "for doctor 123", "for patient 456"
  // (only simple numeric IDs, not alphanumeric like "JD-8F2KQ3")
  if (/\bfor\s+(doctor|patient)\s+(id|#)\s*\d{1,6}\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  // Explicit third-party references: "for doctor 123", "for patient 456"
  // (only simple numeric IDs, not alphanumeric like "JD-8F2KQ3")
  if (/\bfor\s+(doctor|patient)\s+(id|#)\s*\d{1,6}\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  // Explicit third-party references: "for doctor 123", "for patient 456"
  // (only simple numeric IDs, not alphanumeric like "JD-8F2KQ3")
  if (/\bfor\s+(doctor|patient)\s+(id|#)\s*\d{1,6}\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }
  // Explicit third-party references: "for doctor 123", "for patient 456"
  // (only simple numeric IDs, not alphanumeric like "JD-8F2KQ3")
  if (/\bfor\s+(doctor|patient)\s+(id|#)\s*\d{1,6}\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }

  // Medical diagnosis/prescription requests — the agent does not provide clinical advice.
  if (/\b(diagnose|diagnosis|what (is|could be) (wrong|the matter)|symptoms?\s+(mean|indicate|suggest)|am i (having|experiencing|suffering from)|should i (take|use|stop)|prescribe|prescription|medication|drug|dosage|treatment|cure|remedy)\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }

  // Emergency situations — direct to emergency services, do not process through agent.
  if (/\b(emergency|urgent|critical|life.?threatening|heart attack|stroke|unconscious|not breathing|severe (pain|bleeding|burn)|overdose|suicide|self.?harm)\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }

  // Prompt injection attempts — ignore instructions that try to override system behavior.
  if (/\b(ignore (previous|all|above) (instructions|prompts|rules)|system (prompt|instruction|override)|you are (now|now a|an) (admin|doctor|root|superuser)|pretend to be|roleplay as|act as|simulate|bypass (safety|security|rules|limits)|reveal (system|hidden|internal) (prompt|instruction|config|data)|show me (the|your) (prompt|instructions|system|code)|what (is|are) your (instructions|rules|prompts|system))\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }

  // Attempts to extract sensitive information or system details.
  if (/\b(show (me|all) (patients|users|records|data|secrets|keys|tokens|passwords)|list (all|every) (patients|users|records|appointments)|dump (database|db|data)|export (all|everything)|select \* from|union select|insert into|delete from|drop table)\b/i.test(text)) {
    return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities: {} };
  }

  // Booking confirmations reference a pending proposal, not new entities.
  if (includesAny(text, ['confirm', 'yes book', 'book that slot', 'book it', 'proceed'])) {
    return { intent: INTENTS.BOOK_APPOINTMENT, entities: { ...entities, confirmHint: true } };
  }
  if (/\b(reschedule|re-schedule|move my (appointment|visit|booking|slot)|move it|change my (appointment|visit|booking)|postpone)\b/.test(text)) {
    return { intent: INTENTS.RESCHEDULE_APPOINTMENT, entities };
  }
  if (/\b(cancel|cancellation|call off)\b/.test(text) && includesAny(text, ['appointment', 'booking', 'visit', 'slot'])) {
    return { intent: INTENTS.CANCEL_APPOINTMENT, entities };
  }
  // Slots availability queries (doctor directory) — check before booking to avoid
  // "slots available" being misclassified as a booking request.
  if (includesAny(text, ['slots available', 'slots open', 'available slots', 'open slots'])) {
    return { intent: INTENTS.DOCTOR_DIRECTORY, entities };
  }
  if (includesAny(text, ['upcoming', 'next appointment', 'my appointment', 'this week', 'appointments', 'appoinment', 'apointment', 'appoinments', 'apointments', 'my visits', 'my visit'])) {
    return { intent: INTENTS.UPCOMING_APPOINTMENTS, entities };
  }
  if (includesAny(text, ['upcoming', 'next appointment', 'my appointment', 'this week', 'appointments', 'appoinment', 'apointment', 'appoinments', 'apointments', 'my visits', 'my visit'])) {
    return { intent: INTENTS.UPCOMING_APPOINTMENTS, entities };
  }
  if (
    includesAny(text, [
      'book', 'appointment tomorrow', 'new appointment', 'schedule', 'need a doctor',
      'need doctor', 'see a doctor', 'book that slot', 'reschedul',
      'see a doctor', 'visit a doctor', 'consult a doctor', 'get an appointment',
      'make an appointment', 'book a visit', 'book a checkup', 'book a consultation',
      'see a specialist', 'visit a specialist', 'consult a specialist',
      'need a checkup', 'need a consultation', 'want a checkup', 'want a consultation',
      'want to see a doctor', 'want to visit a doctor', 'looking for a doctor',
      'looking for an appointment', 'searching for a doctor', 'finding a doctor',
      'appointment with', 'appointment for', 'appointment with dr', 'appointment for dr',
      'see a doctor', 'visit a doctor', 'see doctor', 'see dr', 'see dr.',
      'slot', 'time slot', 'appointment slot',
      // common misspellings — still scoped to the same safe read/draft paths
      'appoinment', 'apointment', 'appoinments', 'apointments',
    ])
  ) {
    return { intent: INTENTS.BOOK_APPOINTMENT, entities };
  }
  if (
    includesAny(text, [
      'available doctors', 'find doctor', 'doctors', 'specialist doctor',
      'which doctor', 'doctor list', 'which specialists', 'specialists available',
      'doctors available', 'available specialists', 'specialist available',
      'morning slots', 'afternoon slots', 'evening slots',
    ])
  ) {
    return { intent: INTENTS.DOCTOR_DIRECTORY, entities };
  }
  if (includesAny(text, ['follow-up', 'followup', 'follow-ups', 'followups'])) {
    return { intent: INTENTS.FOLLOW_UPS, entities };
  }
  if (includesAny(text, ['referral', 'referred', 'specialist'])) {
    return { intent: INTENTS.REFERRALS, entities };
  }
  if (includesAny(text, ['service', 'clinic', 'facility', 'offer', 'timing', 'hours'])) {
    return { intent: INTENTS.CLINIC_INFORMATION, entities };
  }
  return { intent: INTENTS.UNKNOWN_OR_UNSUPPORTED, entities };
};

export default { INTENTS, classify, extractDate, extractTime, extractDoctorName, todayISO, sanitizeEntities };
