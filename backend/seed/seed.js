import connectDB from '../config/db.js';
import {
  User,
  Patient,
  Doctor,
  NGO,
  Government,
  Appointment,
  Prescription,
  Consultation,
  MedicalReport,
  Notification,
  Settings,
  Referral,
  HealthCamp,
} from '../models/index.js';

const PASSWORD = 'Password@123'; // shared demo password

const users = [
  { role: 'admin', name: 'Admin Miller', email: 'admin@jeevandoot.org' },
  { role: 'doctor', name: 'Dr. Rajesh Sharma', email: 'doctor@jeevandoot.org' },
  { role: 'patient', name: 'Gopal Prasad', email: 'patient@jeevandoot.org' },
  { role: 'ngo', name: 'Seva Foundation', email: 'ngo@jeevandoot.org' },
  { role: 'government', name: 'District Health Office', email: 'govt@jeevandoot.org' },
];

const patients = [
  {
    name: 'Gopal Prasad',
    patientId: 'JD-1209',
    village: 'Amroli',
    gender: 'male',
    risk: 'moderate',
    status: 'inReview',
  },
  {
    name: 'Arjun Singh',
    patientId: 'JD-8F2KQ3',
    village: 'Palia',
    gender: 'male',
    risk: 'high',
    status: 'waiting',
  },
  {
    name: 'Meera Sharma',
    patientId: 'JD-5XA2MN',
    village: 'Devgram',
    gender: 'female',
    risk: 'low',
    status: 'completed',
  },
  {
    name: 'Lakshmi Verma',
    patientId: 'JD-7K4PQ9',
    village: 'Dhamtari Rural',
    gender: 'female',
    risk: 'critical',
    status: 'waiting',
  },
];

const doctors = [
  { name: 'Dr. Rajesh Sharma', specialization: 'General Medicine', hospital: 'Amroli PHC', experience: 12, status: 'online' },
  { name: 'Dr. Anil Deshmukh', specialization: 'Cardiology', hospital: 'Dhamtari District Hospital', experience: 18, status: 'online' },
  { name: 'Dr. Kavita Nair', specialization: 'Pediatrics', hospital: 'Kanker CHC', experience: 9, status: 'offline' },
];

const run = async (reset = false) => {
  await connectDB();

  if (reset) {
    console.log('[seed] Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Doctor.deleteMany({}),
      NGO.deleteMany({}),
      Government.deleteMany({}),
      Appointment.deleteMany({}),
      Prescription.deleteMany({}),
      Consultation.deleteMany({}),
      MedicalReport.deleteMany({}),
      Notification.deleteMany({}),
      Settings.deleteMany({}),
      Referral.deleteMany({}),
      HealthCamp.deleteMany({}),
    ]);
  }

  const userDocs = [];
  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      userDocs.push(existing);
      continue;
    }
    const created = await User.create({ ...u, password: PASSWORD });
    userDocs.push(created);
  }

  const byRole = userDocs.reduce((acc, u) => {
    acc[u.role] = u;
    return acc;
  }, {});

  // --- Doctor profiles ---
  const doctorDocs = [];
  for (let i = 0; i < doctors.length; i += 1) {
    const d = doctors[i];
    const user = i === 0 ? byRole.doctor : await User.create({
      role: 'doctor',
      name: d.name,
      email: `${d.name.toLowerCase().replace(/[^a-z]+/g, '.')}@jeevandoot.org`,
      password: PASSWORD,
    });
    const doctor = await Doctor.create({
      user: user._id,
      name: d.name,
      specialization: d.specialization,
      hospital: d.hospital,
      experience: d.experience,
      email: user.email,
      availability: { status: d.status },
      stats: { patients: 45 + i * 12, consultations: 120 + i * 40, followUps: 8 + i * 3 },
    });
    doctorDocs.push(doctor);
  }
  const [drSharma, drDeshmukh, drNair] = doctorDocs;

  // --- Patient profiles (linked users) ---
  const patientDocs = [];
  for (let i = 0; i < patients.length; i += 1) {
    const p = patients[i];
    const user =
      i === 0
        ? byRole.patient
        : await User.create({
            role: 'patient',
            name: p.name,
            email: `${p.name.toLowerCase().replace(/[^a-z]+/g, '.')}@jeevandoot.org`,
            password: PASSWORD,
          });

    const patient = await Patient.create({
      user: user._id,
      patientId: p.patientId,
      personalInfo: {
        fullName: p.name,
        dateOfBirth: new Date('1978-05-12'),
        gender: p.gender,
        email: user.email,
        phone: `+91-9${Math.floor(Math.random() * 9e8)}`,
        address: `${p.village}, Dhamtari District`,
        village: p.village,
      },
      emergencyContact: {
        name: 'Family Member',
        relationship: 'Spouse',
        phone: '+91-9999990001',
      },
      vitals: { bp: '128/84', temp: '98.6°F', weight: 62, pulse: 76, bmi: 23.4 },
      bloodGroup: 'B+',
      height: 168,
      allergies: [{ name: 'Penicillin', severity: 'high', reaction: 'Rash' }],
      medicalHistory: {
        diagnoses: ['Hypertension'],
        surgeries: [],
        medications: ['Amlodipine 5mg'],
        chronic: ['Hypertension'],
      },
      vaccinationHistory: ['COVID-19 (2 doses)', 'Tetanus (booster)'],
      queue: { risk: p.risk, status: p.status, reason: 'Routine check-up', joinedAt: new Date() },
    });
    patientDocs.push(patient);
  }
  const [gopal, arjun, meera, lakshmi] = patientDocs;

  // --- NGO profile ---
  const ngo = await NGO.create({
    user: byRole.ngo._id,
    organization: 'Seva Foundation',
    workerId: 'NGW-001',
    designation: 'Field Coordinator',
    region: 'Dhamtari Block',
    email: byRole.ngo.email,
  });

  // --- Government profile ---
  await Government.create({
    user: byRole.government._id,
    designation: 'District Health Officer',
    department: 'Health',
    district: 'Dhamtari',
    email: byRole.government.email,
  });

  // --- Appointments ---
  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  };
  const nextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  };

  await Appointment.create([
    {
      patient: gopal._id,
      doctor: drSharma._id,
      purpose: 'follow-up',
      date: tomorrow(),
      startTime: '10:00',
      endTime: '10:30',
      status: 'upcoming',
    },
    {
      patient: meera._id,
      doctor: drSharma._id,
      purpose: 'general',
      date: nextWeek(),
      startTime: '11:00',
      endTime: '11:30',
      status: 'upcoming',
    },
    {
      patient: arjun._id,
      doctor: drDeshmukh._id,
      purpose: 'referral-review',
      date: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      startTime: '09:00',
      endTime: '09:30',
      status: 'completed',
    },
  ]);

  // --- Prescriptions ---
  await Prescription.create([
    {
      patient: gopal._id,
      doctor: drSharma._id,
      diagnosis: 'Hypertension',
      advice: 'Low-salt diet, daily 30 min walk, follow up in 15 days.',
      medicines: [
        { medicineName: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily', durationDays: 15, schedule: { morning: true } },
        { medicineName: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Twice daily', durationDays: 5, schedule: { morning: true, night: true } },
      ],
      status: 'active',
    },
    {
      patient: meera._id,
      doctor: drSharma._id,
      diagnosis: 'Acute upper respiratory infection',
      advice: 'Rest, fluids, steam inhalation.',
      medicines: [
        { medicineName: 'Azithromycin 500mg', dosage: '1 tablet', frequency: 'Once daily', durationDays: 3, schedule: { morning: true } },
      ],
      status: 'completed',
    },
  ]);

  // --- Consultations ---
  await Consultation.create({
    patient: meera._id,
    doctor: drSharma._id,
    status: 'completed',
    complaint: 'Fever and sore throat for 3 days',
    diagnosis: 'Acute upper respiratory infection',
    vitals: { bp: '118/76', temp: '100.2°F', pulse: 88, spo2: 98 },
    medicines: [{ medicineName: 'Azithromycin 500mg', dosage: '1 tablet', frequency: 'Once daily', duration: '3 days' }],
    notes: 'Patient responded well. Advised hydration and rest.',
    advice: 'Complete the antibiotic course.',
    transcript: 'AI-transcribed consultation summary.',
    scribeSections: [
      { id: 'chiefComplaint', title: 'Chief Complaint', content: 'Fever and sore throat for 3 days.' },
      { id: 'assessment', title: 'Assessment', content: 'Acute upper respiratory infection.' },
      { id: 'plan', title: 'Plan', content: 'Antibiotics + symptomatic care.' },
    ],
    startedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    endedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 20 * 60000),
    durationMinutes: 20,
  });

  // --- Medical reports ---
  await MedicalReport.create([
    {
      patient: gopal._id,
      doctor: drSharma._id,
      title: 'Complete Blood Count',
      type: 'laboratory',
      facility: 'Amroli PHC Laboratory',
      fields: [
        { name: 'Hemoglobin', value: '13.8', unit: 'g/dL', reference: '13.0–17.0', flag: 'normal' },
        { name: 'WBC Count', value: '11,200', unit: '/μL', reference: '4,000–11,000', flag: 'high' },
        { name: 'Platelets', value: '2.4', unit: 'lakh/μL', reference: '1.5–4.5', flag: 'normal' },
      ],
      findings: ['Mild leukocytosis.'],
      impression: 'Suggestive of mild infection. Clinical correlation advised.',
    },
    {
      patient: lakshmi._id,
      doctor: drDeshmukh._id,
      title: 'Lipid Profile',
      type: 'laboratory',
      facility: 'Dhamtari District Hospital',
      fields: [
        { name: 'Total Cholesterol', value: '248', unit: 'mg/dL', reference: '<200', flag: 'critical' },
        { name: 'LDL', value: '168', unit: 'mg/dL', reference: '<100', flag: 'high' },
      ],
      findings: ['Raised LDL and total cholesterol.'],
      impression: 'Dyslipidemia. Dietary and pharmacological intervention advised.',
    },
  ]);

  // --- Referrals ---
  await Referral.create([
    {
      patient: arjun._id,
      doctor: drSharma._id,
      destination: 'dcc',
      priority: 'high',
      reason: 'Suspected MI — needs cardiac evaluation',
      notes: 'Chest pain with ECG changes. Urgent review requested.',
      status: 'sent',
    },
    {
      patient: lakshmi._id,
      doctor: drDeshmukh._id,
      destination: 'agh',
      priority: 'urgent',
      reason: 'Critical lipid profile, cardiac workup required',
      status: 'accepted',
    },
  ]);

  // --- Health camps ---
  await HealthCamp.create([
    {
      ngo: ngo._id,
      name: 'Amroli Eye Checkup Camp',
      location: 'Amroli PHC',
      village: 'Amroli',
      doctor: 'Dr. Kavita Nair',
      date: new Date('2026-10-27'),
      status: 'planned',
      beneficiaries: 0,
      services: ['primaryCare', 'awareness'],
    },
    {
      ngo: ngo._id,
      name: 'Devgram Nutrition Camp',
      location: 'Devgram Community Hall',
      village: 'Devgram',
      doctor: 'Dr. Rajesh Sharma',
      date: new Date('2026-07-20'),
      status: 'completed',
      beneficiaries: 214,
      services: ['primaryCare', 'vaccination', 'followUp'],
    },
    {
      ngo: ngo._id,
      name: 'Palia Vaccination Drive',
      location: 'Palia School',
      village: 'Palia',
      doctor: 'Dr. Kavita Nair',
      date: new Date('2026-08-02'),
      status: 'completed',
      beneficiaries: 168,
      services: ['vaccination'],
    },
    {
      ngo: ngo._id,
      name: 'Dhamtari Rural Screening',
      location: 'Dhamtari Rural PHC',
      village: 'Dhamtari Rural',
      doctor: 'Dr. Anil Deshmukh',
      date: new Date('2026-09-14'),
      status: 'active',
      beneficiaries: 96,
      services: ['primaryCare', 'awareness'],
    },
  ]);

  // --- Notifications ---
  await Notification.create([
    {
      user: byRole.doctor._id,
      title: 'New patient in queue',
      description: 'Arjun Singh (JD-8F2KQ3) added to your queue.',
      type: 'consultation',
      read: false,
    },
    {
      user: byRole.patient._id,
      title: 'Appointment confirmed',
      description: 'Your appointment with Dr. Rajesh Sharma is confirmed.',
      type: 'appointment',
      read: false,
    },
    {
      user: byRole.patient._id,
      title: 'New prescription available',
      description: 'Prescription issued by Dr. Rajesh Sharma.',
      type: 'prescription',
      read: true,
    },
    {
      user: byRole.ngo._id,
      title: 'New health camp scheduled',
      description: 'Amroli Eye Checkup Camp scheduled for 27 October.',
      type: 'camp',
      read: false,
    },
  ]);

  // --- Settings ---
  await Settings.create({
    user: byRole.patient._id,
    language: 'en',
    theme: 'light',
    notifications: { email: true, sms: true, app: true },
  });

  console.log('[seed] Done. Demo accounts (password: Password@123):');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(10)} ${u.email}`);
  }
  process.exit(0);
};

const reset = process.argv.includes('--reset');
run(reset).catch((error) => {
  console.error('[seed] Failed:', error);
  process.exit(1);
});
