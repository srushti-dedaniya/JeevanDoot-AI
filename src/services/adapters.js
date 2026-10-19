const titleCase = (value) =>
  typeof value === 'string' && value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '';

const computeAge = (dateOfBirth) => {
  if (!dateOfBirth) return '';
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return '';
  const diff = Date.now() - dob.getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
};

const formatRelative = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const toPatientCard = (p) => {
  const info = p.personalInfo || {};
  const vitals = p.vitals || {};
  const queue = p.queue || {};
  return {
    id: p.patientId,
    patientId: p.patientId,
    userId: p.user && typeof p.user === 'object' ? p.user._id : p.user,
    name: info.fullName,
    age: computeAge(info.dateOfBirth),
    gender: titleCase(info.gender),
    email: info.email,
    phone: info.phone,
    address: info.address,
    village: info.village,
    complaint: queue.reason || '',
    risk: titleCase(queue.risk),
    status: titleCase(queue.status),
    lastCheckIn: formatRelative(queue.joinedAt),
    vitals: {
      bp: vitals.bp,
      temp: vitals.temp,
      weight: vitals.weight,
      pulse: vitals.pulse,
      bloodSugar: vitals.bloodSugar,
      bmi: vitals.bmi,
    },
    bloodGroup: p.bloodGroup,
    height: p.height,
    allergies: p.allergies || [],
    medicalHistory: p.medicalHistory || { diagnoses: [], surgeries: [], medications: [], chronic: [] },
    vaccinationHistory: p.vaccinationHistory || [],
    emergencyContact: p.emergencyContact || {},
    summary: [],
  };
};

export const toPatientProfile = (p) => {
  const card = toPatientCard(p);
  const info = p.personalInfo || {};
  const emergency = p.emergencyContact || {};
  return {
    ...card,
    name: info.fullName || card.name,
    dob: info.dateOfBirth ? new Date(info.dateOfBirth).toISOString().slice(0, 10) : '',
    age: card.age,
    gender: card.gender,
    address: info.address || '',
    emergencyContact: {
      name: emergency.name || '',
      relationship: emergency.relationship || '',
      phone: emergency.phone || '',
      alternate: emergency.alternate || '',
      address: emergency.address || '',
    },
    heightCm: p.height,
    weightKg: card.vitals.weight,
    bmi: card.vitals.bmi,
  };
};

export const toDoctorCard = (d) => {
  const rawId = d._id || d.id;
  return {
    id: rawId,
    _id: rawId,
    doctorId: d.doctorId || rawId,
    userId: d.user && typeof d.user === 'object' ? d.user._id : d.user,
    name: d.name,
    specialty: d.specialization || 'General Medicine',
    specialization: d.specialization || 'General Medicine',
    hospital: d.hospital,
    experience: d.experience,
    email: d.email,
    phone: d.phone,
    rating: d.rating,
    status: titleCase(d.availability?.status),
    availability: d.availability,
    patients: d.stats?.patients ?? 0,
    consultations: d.stats?.consultations ?? 0,
    followUps: d.stats?.followUps ?? 0,
    avgWait: d.stats?.avgWaitMinutes,
  };
};

export const toDoctorStats = (raw) => {
  const stats = raw.stats || raw;
  const queue = raw.queue || [];
  const doctor = raw.doctor || {};
  const urgent = queue.filter((q) => q.risk === 'critical' || q.risk === 'high').length;
  const consultations = stats.consultations ?? queue.length;
  const week = [12, 19, 15, 25, 22, 10, 8];
  return {
    totalPatients: stats.patients ?? 0,
    patientsToday: stats.queue ?? queue.length,
    urgentCases: urgent,
    avgResponse: stats.avgWaitMinutes
      ? `${stats.avgWaitMinutes}m`
      : doctor.stats?.avgWaitMinutes
        ? `${doctor.stats.avgWaitMinutes}m`
        : '14m',
    followUps: stats.followUps ?? 0,
    consultations:
      Array.isArray(stats.consultations) && stats.consultations.length === 7
        ? stats.consultations
        : week.map((v, i) => (i === new Date().getDay() ? consultations : v)),
    outcomes: [640, 210, 398],
  };
};

export const toAppointmentCard = (a) => {
  const doctor = a.doctor && typeof a.doctor === 'object' ? a.doctor : {};
  const patient = a.patient && typeof a.patient === 'object' ? a.patient : {};
  const dateObj = a.date ? new Date(a.date) : null;
  const dateStr = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toISOString().slice(0, 10) : '';
  return {
    id: a._id || a.id,
    doctor: doctor.name || '',
    specialization: doctor.specialization || '',
    hospital: '',
    date: dateStr,
    time: a.startTime || '',
    endTime: a.endTime || '',
    purpose: a.purpose || 'general',
    notes: a.notes || '',
    status: titleCase(a.status),
    patientId: patient.patientId,
    patientName: patient.personalInfo?.fullName,
  };
};

export const toPrescriptionCard = (rx) => {
  const doctor = rx.doctor && typeof rx.doctor === 'object' ? rx.doctor : {};
  const patient = rx.patient && typeof rx.patient === 'object' ? rx.patient : {};
  return {
    id: rx._id || rx.id,
    prescriptionId: rx.prescriptionId || rx._id,
    doctor: doctor.name || '',
    specialization: doctor.specialization || '',
    hospital: '',
    date: formatDate(rx.issuedAt || rx.createdAt),
    issuedAt: rx.issuedAt || rx.createdAt,
    diagnosis: rx.diagnosis || '',
    advice: rx.advice || '',
    status: titleCase(rx.status),
    patientId: patient.patientId,
    patientName: patient.personalInfo?.fullName,
    medicines: (rx.medicines || []).map((m) => ({
      id: m._id || `${rx._id}-${m.medicineName}`,
      name: m.medicineName || m.name,
      medicineName: m.medicineName || m.name,
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      duration: m.durationDays ? `${m.durationDays} days` : m.duration || '',
      durationDays: m.durationDays,
      schedule: m.schedule || { morning: false, afternoon: false, night: false },
      notes: m.notes || '',
    })),
  };
};

export const toConsultationCard = (c) => {
  const doctor = c.doctor && typeof c.doctor === 'object' ? c.doctor : {};
  const patient = c.patient && typeof c.patient === 'object' ? c.patient : {};
  return {
    id: c._id || c.id,
    consultationId: c.sessionId || c.id,
    sessionId: c.sessionId || c.id,
    patientId: patient.patientId,
    patientName: patient.personalInfo?.fullName || patient.name || '',
    patientAge: patient.personalInfo?.dateOfBirth
      ? computeAge(patient.personalInfo.dateOfBirth)
      : '',
    patientGender: titleCase(patient.personalInfo?.gender),
    patientVillage: patient.personalInfo?.village || '',
    doctorId: doctor._id,
    doctorName: doctor.name || '',
    specialization: doctor.specialization || '',
    date: c.startedAt || c.createdAt || '',
    duration: c.durationMinutes ? c.durationMinutes * 60 : 0,
    status: titleCase(c.status),
    complaint: c.complaint || '',
    diagnosis: c.diagnosis || '',
    vitals: c.vitals || {},
    medicines: (c.medicines || []).map((m) => ({
      id: m._id || m.medicineName,
      medicineName: m.medicineName || m.name,
      name: m.medicineName || m.name,
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      duration: m.duration || '',
    })),
    scribeSections: c.scribeSections || [],
    advice: c.advice || '',
    notes: c.notes || '',
    transcript: c.transcript || '',
  };
};

export const toReportCard = (r) => {
  const doctor = r.doctor && typeof r.doctor === 'object' ? r.doctor : {};
  const patient = r.patient && typeof r.patient === 'object' ? r.patient : {};
  const typeLabels = { laboratory: 'Blood Test', radiology: 'X-Ray', pathology: 'Blood Test', diagnostic: 'ECG' };
  return {
    id: r._id || r.id,
    reportId: r.reportId || r._id,
    type: typeLabels[r.type] || r.type || 'Blood Test',
    title: r.title || '',
    date: r.date || r.createdAt || '',
    facility: r.facility || '',
    doctor: doctor.name || '',
    patientId: patient.patientId,
    patientName: patient.personalInfo?.fullName,
    status: r.impression ? 'Completed' : 'Pending',
    fields: (r.fields || []).map((f) => ({
      name: f.name,
      value: f.value,
      unit: f.unit || '',
      reference: f.reference || '',
      flag: titleCase(f.flag) || 'Normal',
    })),
    findings: r.findings || [],
    impression: r.impression || '',
  };
};

export const toNotification = (n) => ({
  id: n._id || n.id,
  type: n.type || 'system',
  title: n.title || '',
  message: n.description || '',
  read: Boolean(n.read),
  time: formatRelative(n.createdAt),
  link: n.link || '',
  createdAt: n.createdAt,
});

export const toReferral = (r) => {
  const patient = r.patient && typeof r.patient === 'object' ? r.patient : {};
  return {
    id: r._id || r.id,
    referralId: r.referralId || r._id,
    patientId: patient.patientId,
    patientName: patient.personalInfo?.fullName,
    destination: r.destination,
    priority: titleCase(r.priority),
    reason: r.reason || '',
    notes: r.notes || '',
    status: titleCase(r.status),
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
    responseNotes: r.responseNotes,
  };
};

export { formatDate, formatDateTime, formatRelative, titleCase, computeAge };
