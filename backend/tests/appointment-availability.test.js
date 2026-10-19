/**
 * Appointment availability endpoint security tests.
 * Uses a throwaway `jeevandoot_ai_test` database and skips honestly when
 * MongoDB is unreachable.
 */
/* global process */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User, Doctor, Patient, Appointment } from '../models/index.js';
import { appointmentController } from '../controllers/appointment.controller.js';
import ApiError from '../utils/ApiError.js';

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevandoot_ai_test';
let db = false;

const mockReq = (query, user) => ({ query, user });
const mockRes = () => {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

before(async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    }
    db = true;
  } catch {
    console.log('# SKIP appointment-availability: MongoDB unreachable at ' + URI);
  }
});

after(async () => {
  if (!db) return;
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!db) return;
  await Appointment.deleteMany({});
  await Doctor.deleteMany({});
  await Patient.deleteMany({});
  await User.deleteMany({ email: /avail-test-.*@test\.local/ });
});

describe('GET /appointments/availability controller logic', () => {
  const mkUser = async (email, role) => {
    const existing = await User.findOne({ email });
    if (existing) return existing;
    return User.create({ name: 'Avail Test', email, password: 'Password@123', role });
  };

  it('validates doctor ID format', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient@test.local', 'patient');
    const req = mockReq({ doctor: 'not-an-id', date: '2030-01-15' }, user);
    const res = mockRes();
    try {
      await appointmentController.getAppointmentAvailability(req, res);
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /Invalid doctor/);
    }
  });

  it('validates date format', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient2@test.local', 'patient');
    const req = mockReq({ doctor: new mongoose.Types.ObjectId().toString(), date: 'not-a-date' }, user);
    const res = mockRes();
    try {
      await appointmentController.getAppointmentAvailability(req, res);
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /YYYY-MM-DD/);
    }
  });

  it('rejects past dates', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient3@test.local', 'patient');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const req = mockReq({ doctor: new mongoose.Types.ObjectId().toString(), date: dateStr }, user);
    const res = mockRes();
    try {
      await appointmentController.getAppointmentAvailability(req, res);
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /past/);
    }
  });

  it('requires doctor and date query params', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient4@test.local', 'patient');
    const req = mockReq({ doctor: new mongoose.Types.ObjectId().toString() }, user); // missing date
    const res = mockRes();
    try {
      await appointmentController.getAppointmentAvailability(req, res);
      assert.fail('Should have thrown 400');
    } catch (e) {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /required/);
    }
  });

  it('returns only booked startTimes, no patient data', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient5@test.local', 'patient');
    const doctorUser = await mkUser('avail-test-doc@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test', specialization: 'Cardiology' });
    const patientUser = await mkUser('avail-test-patient6@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-15',
      startTime: '10:30',
      status: 'upcoming',
    });
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-15',
      startTime: '14:00',
      status: 'upcoming',
    });

    const req = mockReq({ doctor: String(doctor._id), date: '2030-01-15' }, user);
    const res = mockRes();
    await appointmentController.getAppointmentAvailability(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.booked.sort(), ['10:30', '14:00']);
    // Ensure no patient data is exposed
    const json = JSON.stringify(res.body);
    assert.ok(!json.includes('patient'));
    assert.ok(!json.includes('patientId'));
    assert.ok(!json.includes('personalInfo'));
  });

  it('filters by date correctly', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient7@test.local', 'patient');
    const doctorUser = await mkUser('avail-test-doc2@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test2' });
    const patientUser = await mkUser('avail-test-patient8@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-15',
      startTime: '10:30',
      status: 'upcoming',
    });
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-16',
      startTime: '10:30',
      status: 'upcoming',
    });

    const req = mockReq({ doctor: String(doctor._id), date: '2030-01-15' }, user);
    const res = mockRes();
    await appointmentController.getAppointmentAvailability(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.booked, ['10:30']);
  });

  it('excludes cancelled appointments', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient9@test.local', 'patient');
    const doctorUser = await mkUser('avail-test-doc3@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test3' });
    const patientUser = await mkUser('avail-test-patient10@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id });

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-15',
      startTime: '10:30',
      status: 'upcoming',
    });
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-15',
      startTime: '11:00',
      status: 'cancelled',
    });

    const req = mockReq({ doctor: String(doctor._id), date: '2030-01-15' }, user);
    const res = mockRes();
    await appointmentController.getAppointmentAvailability(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.booked, ['10:30']);
  });

  it('returns empty array when no appointments', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient11@test.local', 'patient');
    const doctorUser = await mkUser('avail-test-doc4@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test4' });

    const req = mockReq({ doctor: String(doctor._id), date: '2030-01-15' }, user);
    const res = mockRes();
    await appointmentController.getAppointmentAvailability(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.booked, []);
  });
});

describe('Appointment list endpoint does not leak patient data to unauthorized roles via availability', () => {
  const mkUser = async (email, role) => {
    const existing = await User.findOne({ email });
    if (existing) return existing;
    return User.create({ name: 'Avail Test', email, password: 'Password@123', role });
  };

  it('availability endpoint never returns patientId or personalInfo', async (t) => {
    if (!db) return t.skip();
    const user = await mkUser('avail-test-patient10@test.local', 'patient');
    const doctorUser = await mkUser('avail-test-doc4@test.local', 'doctor');
    const doctor = await Doctor.create({ user: doctorUser._id, name: 'Dr. Test4' });
    const patientUser = await mkUser('avail-test-patient11@test.local', 'patient');
    const patient = await Patient.create({ user: patientUser._id, personalInfo: { fullName: 'Secret Name' } });

    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      date: '2030-01-15',
      startTime: '10:30',
      status: 'upcoming',
    });

    const req = mockReq({ doctor: String(doctor._id), date: '2030-01-15' }, user);
    const res = mockRes();
    await appointmentController.getAppointmentAvailability(req, res);

    const json = JSON.stringify(res.body);
    assert.ok(!json.includes('Secret Name'));
    assert.ok(!json.includes('patientId'));
    assert.ok(!json.includes('personalInfo'));
  });
});