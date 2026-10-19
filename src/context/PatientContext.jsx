import { createContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'jd_patient_profile';

export const DEFAULT_PATIENT = {
  patientId: 'PT-1001',
  id: 'PT-1001',
  name: 'Meera Sharma',
  email: 'meera.sharma@example.com',
  phone: '+91 98765 43210',
  dob: '1963-04-18',
  age: 62,
  gender: 'Female',
  address: '12 Gandhi Nagar, Amroli, Chhattisgarh',
  village: 'Amroli',
  bloodGroup: 'B+',
  heightCm: 162,
  weightKg: 58,
  bmi: 22.1,
  emergencyContact: {
    name: 'Rohan Sharma',
    relationship: 'Son',
    phone: '+91 98765 43210',
    alternate: '+91 91234 56780',
    address: '12 Gandhi Nagar, Amroli',
  },
};

const loadPatient = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_PATIENT,
        ...parsed,
        emergencyContact: {
          ...DEFAULT_PATIENT.emergencyContact,
          ...(parsed.emergencyContact || {}),
        },
      };
    }
  } catch {
    /* ignore storage errors */
  }
  return DEFAULT_PATIENT;
};

const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const [patient, setPatient] = useState(loadPatient);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patient));
    } catch {
      /* ignore storage errors */
    }
  }, [patient]);

  const updateProfile = (patch) =>
    setPatient((prev) => ({
      ...prev,
      ...patch,
      emergencyContact: {
        ...prev.emergencyContact,
        ...(patch.emergencyContact || {}),
      },
    }));

  const value = useMemo(() => ({ patient, updateProfile }), [patient]);

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export default PatientContext;
