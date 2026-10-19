/**
 * aiAgentMock.js — Phase 1 demo data + deterministic response logic for JeevanDoot AI.
 *
 * UI-ONLY: no network calls, no LLM, no backend writes. Everything below is
 * simulated sample data so the Task Agent page can be demonstrated.
 *
 * Phase 2 integration points (replace these exports with real API calls):
 *  - getDemoReply()        -> POST /api/v1/ai/chat (agent chat endpoint)
 *  - APPOINTMENT_DRAFT     -> GET /api/v1/appointments/availability
 *  - REFERRAL_SAMPLES      -> GET /api/v1/referrals
 *  - FOLLOWUP_SAMPLES      -> GET /api/v1/patients?followUpDue=true (or similar)
 *  - confirm flow          -> POST /api/v1/appointments
 */

export const DEMO_REFERENCE_PREFIX = 'DEMO';

export const ACTION_STATUS_META = {
  suggested: { label: 'Suggested action', badge: 'secondary', icon: 'lightbulb' },
  awaiting: { label: 'Awaiting confirmation', badge: 'warning', icon: 'hourglass_top' },
  in_progress: { label: 'In progress', badge: 'tertiary', icon: 'progress_activity' },
  completed: { label: 'Completed (demo)', badge: 'success', icon: 'check_circle' },
  failed: { label: 'Failed / cancelled', badge: 'error', icon: 'error' },
  needs_info: { label: 'Needs more information', badge: 'neutral', icon: 'info' },
};

export const ACTIVITY_STEPS = [
  { id: 'received', label: 'Request received' },
  { id: 'intent', label: 'Intent identified' },
  { id: 'checked', label: 'Required information checked' },
  { id: 'confirmation', label: 'Confirmation requested' },
  { id: 'done', label: 'Demo action completed' },
];

/**
 * Suggested prompts per role. Patient users only see patient-safe actions —
 * no doctor-only or administrator-only tasks are suggested to them.
 */
export const SUGGESTIONS_BY_ROLE = {
  patient: [
    'Help me book a doctor appointment',
    'Show my upcoming appointments',
    'Find pending referrals',
    "Prepare today's follow-up list",
    'Explain the services available at a clinic',
  ],
  doctor: [
    "Prepare today's follow-up list",
    'Find pending referrals',
    'Show my upcoming appointments',
    'Help me book a doctor appointment',
    'Explain the services available at a clinic',
  ],
  admin: [
    'Find pending referrals',
    "Prepare today's follow-up list",
    'Explain the services available at a clinic',
    'Show my upcoming appointments',
    'Help me book a doctor appointment',
  ],
  ngo: [
    "Prepare today's follow-up list",
    'Explain the services available at a clinic',
    'Find pending referrals',
    'Show my upcoming appointments',
    'Help me book a doctor appointment',
  ],
  government: [
    'Explain the services available at a clinic',
    'Find pending referrals',
    "Prepare today's follow-up list",
    'Show my upcoming appointments',
    'Help me book a doctor appointment',
  ],
};

export const getSuggestionsForRole = (role) =>
  SUGGESTIONS_BY_ROLE[role] || SUGGESTIONS_BY_ROLE.patient;

export const APPOINTMENT_DRAFT = {
  clinic: 'Amroli PHC',
  doctor: 'Dr. Sharma (General Medicine)',
  date: 'Tomorrow',
  slots: ['10:30 AM', '12:00 PM', '4:00 PM'],
};

// Sample referral/follow-up rows. Deliberately generic — no real patient data.
export const REFERRAL_SAMPLES = [
  { id: 'REF-DEMO-101', title: 'Cardiology referral', destination: 'District Cardiology Center', status: 'Pending review', due: 'Due in 3 days' },
  { id: 'REF-DEMO-102', title: 'Orthopedic referral', destination: 'Dr. Rajeev (Orthopedic)', status: 'Accepted', due: 'Slot proposed for Friday' },
  { id: 'REF-DEMO-103', title: 'Lab workup referral', destination: 'Amroli General Hospital', status: 'Needs more information', due: 'Missing recent blood report' },
];

export const FOLLOWUP_SAMPLES = [
  { id: 'FU-DEMO-201', title: 'Blood pressure re-check', detail: 'Sample patient A · Hypertension', due: 'Today, 11:00 AM' },
  { id: 'FU-DEMO-202', title: 'Postnatal visit', detail: 'Sample patient B · Day-7 check', due: 'Today, 2:30 PM' },
  { id: 'FU-DEMO-203', title: 'Diabetes medication review', detail: 'Sample patient C · HbA1c due', due: 'Tomorrow, 10:00 AM' },
];

export const UPCOMING_SAMPLES = [
  { id: 'APT-DEMO-301', title: 'General checkup', detail: 'Amroli PHC · Dr. Sharma', due: 'Tomorrow, 10:30 AM' },
  { id: 'APT-DEMO-302', title: 'Dental screening', detail: 'Palia Health Camp', due: 'Friday, 9:00 AM' },
];

export const CLINIC_SERVICES_TEXT =
  'Sample clinic services (demo data): general checkups, prenatal and postnatal care, vaccinations, fever and illness care, chronic-condition monitoring, follow-up visits, and screening camps. Timings and availability shown here are samples only.';

const includesAny = (text, words) => words.some((w) => text.includes(w));

/**
 * Deterministic demo responder. Returns { text, card } where card is an
 * optional action-card payload ({ type: 'appointment' | 'tasklist', ... }).
 * Returns { error: true } for the testable error state.
 */
export const getDemoReply = (message) => {
  const text = (message || '').toLowerCase().trim();

  if (!text) {
    return { text: 'Please type a message so I can help coordinate your healthcare task (demo).' };
  }

  if (includesAny(text, ['error', 'fail', 'something went wrong'])) {
    return { error: true };
  }

  if (includesAny(text, ['book', 'appointment tomorrow', 'new appointment', 'schedule'])) {
    return {
      text: 'I can help you find an available appointment. Here is a sample slot for tomorrow — please review and confirm. Demo only: confirming will not create a real appointment.',
      card: {
        type: 'appointment',
        status: 'awaiting',
        clinic: APPOINTMENT_DRAFT.clinic,
        doctor: APPOINTMENT_DRAFT.doctor,
        date: APPOINTMENT_DRAFT.date,
        slot: APPOINTMENT_DRAFT.slots[0],
        slots: APPOINTMENT_DRAFT.slots,
      },
    };
  }

  if (includesAny(text, ['upcoming'])) {
    return {
      text: 'Here are sample upcoming appointments from the demo schedule. These are not your real records.',
      card: { type: 'tasklist', status: 'suggested', title: 'Upcoming appointments (demo)', items: UPCOMING_SAMPLES },
    };
  }

  if (includesAny(text, ['referral'])) {
    return {
      text: 'I found 3 sample referrals in demo data. One needs more information before it can proceed.',
      card: { type: 'tasklist', status: 'suggested', title: 'Pending referrals (demo)', items: REFERRAL_SAMPLES },
    };
  }

  if (includesAny(text, ['follow'])) {
    return {
      text: "Here is today's sample follow-up list. You can tick items off as you complete them — demo state only, nothing is saved.",
      card: { type: 'tasklist', status: 'suggested', title: "Today's follow-up list (demo)", items: FOLLOWUP_SAMPLES, checkable: true },
    };
  }

  if (includesAny(text, ['service', 'clinic', 'facility', 'offer'])) {
    return { text: CLINIC_SERVICES_TEXT };
  }

  return {
    text: 'Thanks — in this demo I can help with sample appointment booking, upcoming visits, pending referrals, follow-up lists, and clinic service information. Try one of the suggested prompts above. (Demo response — no real AI or backend connected.)',
  };
};

/** Builds the visible activity-timeline state for a given conversation stage. */
export const getActivityState = (stage) => {
  const order = ['received', 'intent', 'checked', 'confirmation', 'done'];
  const activeIndex = order.indexOf(stage);
  return ACTIVITY_STEPS.map((step, i) => ({
    ...step,
    state: i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo',
  }));
};
