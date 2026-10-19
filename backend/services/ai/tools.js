/**
 * Allow-listed AI tool registry (Phase 2B).
 *
 * The orchestrator may ONLY invoke tools registered here, and only for
 * roles listed on each tool. Every call enforces, in order:
 *   1. tool exists (unknown names rejected — prompt injection cannot add tools)
 *   2. authenticated role is permitted
 *   3. arguments match a strict schema (no raw queries/filters/URLs/code)
 *   4. record ownership derived from the server-side session (never client input)
 *   5. existing business rules reused (e.g. appointment clash check)
 *   6. minimal fields returned (no excess PHI)
 */

import mongoose from 'mongoose';
import ApiError from '../../utils/ApiError.js';
import { Appointment, Doctor, Patient, Referral } from '../../models/index.js';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const assertObjectId = (value, field) => {
  if (typeof value !== 'string' || !OBJECT_ID_RE.test(value)) {
    throw new ApiError(400, `Invalid ${field}.`);
  }
  return value;
};

const assertDate = (value) => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new ApiError(400, 'Date must be YYYY-MM-DD.');
  }
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (value < day) throw new ApiError(400, 'Date must not be in the past.');
  return value;
};

const assertTime = (value) => {
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    throw new ApiError(400, 'Time must be HH:MM (24-hour).');
  }
  return value;
};

const doctorPublic = (d) => ({
  id: String(d._id),
  name: d.name,
  specialization: d.specialization || 'General Medicine',
});

const appointmentPublic = (a) => ({
  id: String(a._id),
  purpose: a.purpose,
  date: a.date ? new Date(a.date).toISOString().slice(0, 10) : null,
  startTime: a.startTime,
  status: a.status,
  doctor: a.doctor && typeof a.doctor === 'object'
    ? { name: a.doctor.name, specialization: a.doctor.specialization }
    : undefined,
  patient: a.patient && typeof a.patient === 'object'
    ? { patientId: a.patient.patientId }
    : undefined,
});

const referralPublic = (r) => ({
  referralId: r.referralId,
  destination: r.destination,
  priority: r.priority,
  reason: r.reason,
  status: r.status,
  createdAt: r.createdAt,
});

/** Own Patient document for the session user (patient role), else null. */
const ownPatient = (user) =>
  user.role === 'patient' ? Patient.findOne({ user: user._id }).lean() : Promise.resolve(null);

/** Own Doctor document for the session user (doctor role), else null. */
const ownDoctor = (user) =>
  user.role === 'doctor' ? Doctor.findOne({ user: user._id }).lean() : Promise.resolve(null);

const tools = {
  listUpcomingAppointments: {
    roles: ['patient', 'doctor', 'admin', 'government'],
    args: {},
    async run(user) {
      if (user.role === 'patient') {
        const me = await ownPatient(user);
        if (!me) throw new ApiError(404, 'Patient profile not found.');
        const items = await Appointment.find({ patient: me._id, status: 'upcoming' })
          .sort({ date: 1, startTime: 1 }).limit(50)
          .populate('doctor', 'name specialization').lean();
        return items.map(appointmentPublic);
      }
      if (user.role === 'doctor') {
        const me = await ownDoctor(user);
        if (!me) throw new ApiError(404, 'Doctor profile not found.');
        const items = await Appointment.find({ doctor: me._id, status: 'upcoming' })
          .sort({ date: 1, startTime: 1 }).limit(50)
          .populate('patient', 'patientId').lean();
        return items.map(appointmentPublic);
      }
      const items = await Appointment.find({ status: 'upcoming' })
        .sort({ date: 1, startTime: 1 }).limit(50)
        .populate('doctor', 'name specialization').lean();
      return items.map(appointmentPublic);
    },
  },

  listDoctors: {
    roles: ['patient', 'doctor', 'admin', 'ngo', 'government'],
    args: {},
    async run() {
      const items = await Doctor.find({}).select('name specialization').limit(100).lean();
      return items.map(doctorPublic);
    },
  },

  getAppointmentAvailability: {
    // Returns already-booked startTimes for a doctor+date (preview, not slots).
    roles: ['patient', 'doctor', 'admin', 'government'],
    args: { doctorId: assertObjectId, date: assertDate },
    async run(_user, { doctorId, date }) {
      const items = await Appointment.find({ doctor: doctorId, status: 'upcoming' }).select('date startTime').lean();
      const day = String(date);
      return items
        .filter((a) => a.date && new Date(a.date).toISOString().slice(0, 10) === day)
        .map((a) => a.startTime);
    },
  },

  listAuthorizedReferrals: {
    roles: ['patient', 'doctor', 'admin', 'government'],
    args: {},
    async run(user) {
      const items = await Referral.find({})
        .sort({ createdAt: -1 }).limit(100)
        .populate('patient', 'patientId')
        .populate('doctor', 'name').lean();
      if (user.role === 'patient') {
        const me = await ownPatient(user);
        if (!me) throw new ApiError(404, 'Patient profile not found.');
        return items.filter((r) => r.patient?.patientId === me.patientId).map(referralPublic);
      }
      if (user.role === 'doctor') {
        const me = await ownDoctor(user);
        if (!me) throw new ApiError(404, 'Doctor profile not found.');
        return items
          .filter((r) => String(r.doctor?._id || r.doctor) === String(me._id))
          .map(referralPublic);
      }
      return items.map(referralPublic);
    },
  },

  listAuthorizedFollowUps: {
    // No dedicated follow-up store exists; same honest proxy as Phase 2A:
    // upcoming appointments (the basis of the FollowUpScheduling page).
    roles: ['patient', 'doctor', 'admin', 'government'],
    args: {},
    async run(user, _args, ctx) {
      return ctx.call('listUpcomingAppointments', user, {});
    },
  },
};

export const TOOL_NAMES = Object.freeze(Object.keys(tools));

export const isToolAllowedForRole = (name, role) =>
  Boolean(typeof name === 'string' && Object.hasOwn(tools, name) && tools[name].roles.includes(role));

/**
 * Executes an allow-listed tool after validating name, role and arguments.
 * ctx.call enables controlled tool-to-tool reuse (follow-ups -> upcoming).
 */
export const callTool = async (name, user, rawArgs = {}) => {
  // Object.hasOwn (not truthiness): inherited properties such as
  // '__proto__' must never resolve as tools.
  const tool = typeof name === 'string' && Object.hasOwn(tools, name) ? tools[name] : undefined;
  if (!tool) throw new ApiError(400, `Unknown tool: ${String(name).slice(0, 40)}`);
  if (!user?.role || !tool.roles.includes(user.role)) {
    throw new ApiError(403, 'This action is not permitted for your role.');
  }
  const args = {};
  for (const [field, check] of Object.entries(tool.args)) {
    args[field] = check(rawArgs[field], field);
  }
  const ctx = { call: (n, u, a) => callTool(n, u, a) };
  const result = await tool.run(user, args, ctx);
  return result;
};

/** Confirms a session-owned patient ObjectId string (ownership, not input). */
export const resolveBookingPatientId = async (user) => {
  if (user.role !== 'patient') {
    throw new ApiError(403, 'In-agent booking is available for patient accounts in this phase.');
  }
  const me = await ownPatient(user);
  if (!me) throw new ApiError(404, 'Patient profile not found.');
  return String(me._id);
};

/** Validates a doctor ObjectId against the directory (must exist). */
export const resolveBookingDoctor = async (doctorId) => {
  assertObjectId(doctorId, 'doctor');
  if (!mongoose.isValidObjectId(doctorId)) throw new ApiError(400, 'Invalid doctor.');
  const doctor = await Doctor.findById(doctorId).select('name specialization').lean();
  if (!doctor) throw new ApiError(404, 'Selected doctor was not found.');
  return doctor;
};

/** Reuses the appointment clash rule from the appointment controller. */
export const assertSlotFree = async (doctorId, date, startTime, excludeId = null) => {
  const clash = await Appointment.findOne({
    doctor: doctorId,
    date: new Date(date),
    startTime,
    status: 'upcoming',
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
  if (clash) throw new ApiError(409, 'The doctor is already booked at this time.');
};

/**
 * Resolves an appointment the session user is allowed to modify.
 * ref: { appointmentId? } (strict ObjectId) or { date } (YYYY-MM-DD matched
 * against the caller's own upcoming appointments).
 * Ownership: patient -> own patient record; doctor -> own schedule;
 * admin -> any (mirrors existing route permissions).
 * Only `upcoming` appointments are modifiable.
 */
export const resolveModifiableAppointment = async (user, ref = {}) => {
  let appointment = null;
  if (ref.appointmentId) {
    assertObjectId(ref.appointmentId, 'appointment');
    appointment = await Appointment.findById(ref.appointmentId)
      .populate('doctor', 'name specialization')
      .populate('patient', 'patientId')
      .lean();
    if (!appointment) throw new ApiError(404, 'Appointment not found.');
  } else if (ref.date) {
    assertDate(ref.date);
    // Day is for identification only (not required to be future here — the
    // caller may refer to an existing booking by its date).
    const upcoming = await callTool('listUpcomingAppointments', user, {});
    const day = String(ref.date);
    const matches = upcoming.filter((a) => a.date && new Date(a.date).toISOString().slice(0, 10) === day);
    if (matches.length === 0) {
      throw new ApiError(404, 'No upcoming appointment found on that date.');
    }
    if (matches.length > 1) {
      throw new ApiError(
        409,
        `Found ${matches.length} upcoming appointments on ${day}. Please specify which one (e.g. by time).`,
        { options: matches.map((a) => ({ id: a.id, startTime: a.startTime })) }
      );
    }
    appointment = await Appointment.findById(matches[0].id)
      .populate('doctor', 'name specialization')
      .populate('patient', 'patientId')
      .lean();
    if (!appointment) throw new ApiError(404, 'Appointment not found.');
  } else {
    throw new ApiError(400, 'Identify the appointment by date first (e.g. “my appointment tomorrow”).');
  }

  if (appointment.status !== 'upcoming') {
    throw new ApiError(409, `Only upcoming appointments can be changed (current status: ${appointment.status}).`);
  }

  if (user.role === 'patient') {
    const me = await ownPatient(user);
    if (!me || String(appointment.patient?._id || appointment.patient) !== String(me._id)) {
      throw new ApiError(403, 'You can only change your own appointments.');
    }
  } else if (user.role === 'doctor') {
    const me = await ownDoctor(user);
    if (!me || String(appointment.doctor?._id || appointment.doctor) !== String(me._id)) {
      throw new ApiError(403, 'You can only change appointments in your own schedule.');
    }
  } else if (user.role !== 'admin') {
    throw new ApiError(403, 'This action is not permitted for your role.');
  }
  return appointment;
};

export const assertDateFormat = (value) => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new ApiError(400, 'Date must be YYYY-MM-DD.');
  }
  return value;
};

export const assertFutureDate = (value) => {
  assertDateFormat(value);
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (value < day) throw new ApiError(400, 'Date must not be in the past.');
  return value;
};

export const assertTimeSlot = (value) => assertTime(value);

export default { callTool, isToolAllowedForRole, TOOL_NAMES, resolveBookingPatientId, resolveBookingDoctor, assertSlotFree, resolveModifiableAppointment, assertDateFormat, assertFutureDate, assertTimeSlot };
