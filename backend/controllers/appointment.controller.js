import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success, created, noContent } from '../utils/response.js';
import { Appointment } from '../models/index.js';
import { notificationService } from '../services/notification.service.js';

const APPOINTMENT_POPULATE = [
  { path: 'patient', select: 'patientId personalInfo' },
  { path: 'doctor', select: 'name specialization' },
];

/**
 * GET /appointments
 * Query: { patient, doctor, status, from, to, page, limit }
 */
export const getAppointments = asyncHandler(async (req, res) => {
  const { patient, doctor, status, from, to, page = 1, limit = 20 } = req.query;
  const query = {};
  if (patient) query.patient = patient;
  if (doctor) query.doctor = doctor;
  if (status) query.status = status;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [items, total] = await Promise.all([
    Appointment.find(query)
      .sort({ date: 1, startTime: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate(APPOINTMENT_POPULATE)
      .lean(),
    Appointment.countDocuments(query),
  ]);

  return success(
    res,
    items,
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  );
});

/**
 * GET /appointments/:id
 */
export const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate(APPOINTMENT_POPULATE)
    .lean();
  if (!appointment) throw new ApiError(404, 'Appointment not found.');
  return success(res, appointment);
});

/**
 * POST /appointments
 * Body: { patient, doctor, purpose, date, startTime, endTime?, notes? }
 */
export const createAppointment = asyncHandler(async (req, res) => {
  const { patient, doctor, date, startTime } = req.body || {};
  if (!patient || !doctor || !date || !startTime) {
    throw new ApiError(
      400,
      'Appointment requires patient, doctor, date and startTime.'
    );
  }

  const clash = await Appointment.findOne({ doctor, date, startTime, status: 'upcoming' });
  if (clash) {
    throw new ApiError(409, 'The doctor is already booked at this time.');
  }

  const appointment = await Appointment.create(req.body);
  const populated = await Appointment.findById(appointment._id).populate(APPOINTMENT_POPULATE);

  // Notify the linked patient user of the confirmation.
  try {
    const patientDoc = populated.patient;
    if (patientDoc?.user) {
      await notificationService.notify({
        userIds: patientDoc.user,
        title: 'Appointment confirmed',
        description: `Your appointment with ${populated.doctor?.name || 'the doctor'} is confirmed.`,
        type: 'appointment',
        link: '/patient/appointments',
      });
    }
  } catch (error) {
    console.warn('[appointment] notification skipped:', error.message);
  }

  return created(res, populated);
});

/**
 * PUT /appointments/:id
 */
export const updateAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    { ...(req.body || {}) },
    { new: true, runValidators: true }
  ).populate(APPOINTMENT_POPULATE);
  if (!appointment) throw new ApiError(404, 'Appointment not found.');
  return success(res, appointment);
});

/**
 * POST /appointments/:id/cancel
 * Body: { reason? }
 */
export const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new ApiError(404, 'Appointment not found.');
  if (appointment.status === 'cancelled') {
    throw new ApiError(409, 'Appointment is already cancelled.');
  }

  appointment.status = 'cancelled';
  appointment.cancelledAt = new Date();
  appointment.cancelledReason = req.body?.reason || '';
  await appointment.save();

  return success(res, appointment);
});

/**
 * DELETE /appointments/:id
 */
export const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findByIdAndDelete(req.params.id);
  if (!appointment) throw new ApiError(404, 'Appointment not found.');
  return noContent(res);
});

/**
 * GET /appointments/availability
 * Query: { doctor (ObjectId), date (YYYY-MM-DD) }
 * Returns only booked startTimes for a doctor on a specific date.
 * No patient information is exposed.
 */
export const getAppointmentAvailability = asyncHandler(async (req, res) => {
  const { doctor, date } = req.query;
  if (!doctor || !date) {
    throw new ApiError(400, 'Doctor ID and date (YYYY-MM-DD) are required.');
  }
  const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
  const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!OBJECT_ID_RE.test(doctor)) {
    throw new ApiError(400, 'Invalid doctor ID.');
  }
  if (!DATE_RE.test(date)) {
    throw new ApiError(400, 'Date must be YYYY-MM-DD.');
  }
  const today = new Date();
  const dayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (date < dayStr) {
    throw new ApiError(400, 'Date must not be in the past.');
  }
  const items = await Appointment.find({ doctor, status: 'upcoming' }).select('date startTime').lean();
  const day = String(date);
  const booked = items
    .filter((a) => a.date && new Date(a.date).toISOString().slice(0, 10) === day)
    .map((a) => a.startTime);
  return success(res, { doctor, date, booked });
});

export const appointmentController = {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  deleteAppointment,
  getAppointmentAvailability,
};

export default appointmentController;
