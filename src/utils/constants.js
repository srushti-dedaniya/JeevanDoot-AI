export const APP_NAME = 'JeevanDoot';
export const APP_TAGLINE = 'Rural Community Care';

export const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  PATIENT: 'patient',
  NGO: 'ngo',
  GOVERNMENT: 'government',
};

export const ROLE_LABELS = {
  admin: 'Admin',
  doctor: 'Doctor',
  patient: 'Patient',
  ngo: 'NGO',
  government: 'Government',
};

export const ROLE_META = {
  doctor: {
    label: 'Doctor',
    icon: 'stethoscope',
    description: 'Consultations, prescriptions & referrals',
    color: 'bg-primary-fixed text-on-primary-fixed-variant',
  },
  patient: {
    label: 'Patient',
    icon: 'personal_injury',
    description: 'Appointments & health records',
    color: 'bg-secondary-container text-on-secondary-container',
  },
  ngo: {
    label: 'NGO',
    icon: 'volunteer_activism',
    description: 'Camps & community outreach',
    color: 'bg-tertiary-fixed-dim text-tertiary',
  },
  government: {
    label: 'Government',
    icon: 'account_balance',
    description: 'Surveillance & public policy',
    color: 'bg-primary-fixed text-on-primary-fixed-variant',
  },
  admin: {
    label: 'Admin',
    icon: 'admin_panel_settings',
    description: 'Platform administration',
    color: 'bg-error-container text-on-error-container',
  },
};

export const REGISTRATION_ROLES = ['doctor', 'patient', 'ngo', 'government'];

export const ROLE_PORTAL = {
  admin: '/admin/dashboard',
  doctor: '/doctor/dashboard',
  patient: '/patient/dashboard',
  ngo: '/ngo/dashboard',
  government: '/government/dashboard',
};

export const RISK_LEVELS = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const RISK_STYLES = {
  Low: 'bg-primary-fixed text-on-primary-fixed-variant',
  Moderate: 'bg-secondary-container text-on-secondary-container',
  High: 'bg-tertiary-fixed-dim text-tertiary',
  Critical: 'bg-error-container text-on-error-container',
};

export const QUEUE_STATUS = {
  WAITING: 'Waiting',
  IN_REVIEW: 'In Review',
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
};

export const VISIT_PURPOSES = [
  'General Checkup',
  'Prenatal Checkup',
  'Postnatal Checkup',
  'Vaccination',
  'Fever / Illness',
  'Chronic Condition Monitoring',
  'Follow-up',
  'Screening Camp',
];

export const DEFAULT_VILLAGES = [
  'Amroli',
  'Palia',
  'Devgram',
  'Kanker East',
  'Dhamtari Rural',
  'Lormi Block',
  'Bijapur Sector 2',
];

export const MEDICATION_SUGGESTIONS = [
  'Paracetamol',
  'Cetirizine',
  'ORS',
  'Amoxicillin',
  'Ibuprofen',
  'Metformin',
  'Amlodipine',
  'Azithromycin',
];

export const REFERRAL_DESTINATIONS = [
  { value: 'agh', label: 'Amroli General Hospital (Primary Care Facility)' },
  { value: 'dcc', label: 'District Cardiology Center (Specialist Hospital)' },
  { value: 'drr', label: 'Dr. Rajeev (Orthopedic Specialist)' },
];

export const COMMON_MEDICINE_SCHEDULES = ['Morning', 'Afternoon', 'Night'];

export const DEFAULT_PER_PAGE = 10;

export const DATE_RANGES = ['Last 24 Hours', 'Last 30 Days', 'Last 6 Months', 'Year to Date'];
