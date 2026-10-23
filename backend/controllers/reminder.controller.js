import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success, created, noContent } from '../utils/response.js';
import { reminderService } from '../services/index.js';
import { ROLES } from '../models/User.js';
import { OBJECT_ID_RE } from '../utils/validation.js';

const validateObjectId = (id, field = 'ID') => {
  if (!OBJECT_ID_RE.test(id)) {
    throw new ApiError(400, `Invalid ${field}.`);
  }
};

export const listReminders = asyncHandler(async (req, res) => {
  const { patientId, status, page = 1, limit = 20 } = req.query;

  if (patientId) validateObjectId(patientId, 'patient ID');

  const createdBy = req.user.role === 'patient' ? req.user._id : (patientId ? null : req.user._id);

  const result = await reminderService.listReminders({
    patientId: req.user.role === 'patient' ? (await import('../models/index.js')).Patient.findOne({ user: req.user._id }).lean().then(p => p?._id) : patientId,
    createdBy,
    status,
    page,
    limit,
  });

  return success(res, result.items, result.meta);
});

export const createReminder = asyncHandler(async (req, res) => {
  const {
    patientId,
    type,
    sourceEvent,
    recipientOverride,
    channel = 'in_app',
    priority = 'medium',
    scheduledFor,
  } = req.body || {};

  if (!patientId || !type) {
    throw new ApiError(400, 'patientId and type are required.');
  }
  validateObjectId(patientId, 'patient ID');

  const { reminder, duplicate } = await reminderService.createDraft({
    patientId,
    createdBy: req.user._id,
    type,
    sourceEvent,
    recipientOverride,
    channel,
    priority,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
  });

  if (duplicate) {
    return success(res, reminder, { duplicate: true });
  }
  return created(res, reminder);
});

export const getReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'reminder ID');

  const reminder = await reminderService.getReminderById(id);
  if (!reminder) throw new ApiError(404, 'Reminder not found.');

  const authorized = await reminderService.validateAuthorization(reminder, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to view this reminder.');

  return success(res, reminder);
});

export const submitForApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'reminder ID');

  const reminder = await reminderService.getReminderById(id);
  if (!reminder) throw new ApiError(404, 'Reminder not found.');

  const authorized = await reminderService.validateAuthorization(reminder, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to modify this reminder.');

  const updated = await reminderService.transitionStatus(id, 'pending_approval', req.user._id);
  return success(res, updated);
});

export const approveReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'reminder ID');

  const reminder = await reminderService.getReminderById(id);
  if (!reminder) throw new ApiError(404, 'Reminder not found.');

  const authorized = await reminderService.validateAuthorization(reminder, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to approve this reminder.');

  if (req.user.role === 'patient' && String(reminder.createdBy) === String(req.user._id)) {
    throw new ApiError(403, 'Patients cannot approve their own reminders without a doctor or admin.');
  }

  const updated = await reminderService.transitionStatus(id, 'approved', req.user._id);
  return success(res, updated);
});

export const cancelReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'reminder ID');

  const reminder = await reminderService.getReminderById(id);
  if (!reminder) throw new ApiError(404, 'Reminder not found.');

  const authorized = await reminderService.validateAuthorization(reminder, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to cancel this reminder.');

  const updated = await reminderService.cancelReminder(id, req.user._id);
  return success(res, updated);
});

export const sendReminder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'reminder ID');

  const reminder = await reminderService.getReminderById(id);
  if (!reminder) throw new ApiError(404, 'Reminder not found.');

  const authorized = await reminderService.validateAuthorization(reminder, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to send this reminder.');

  if (reminder.status !== 'approved') {
    throw new ApiError(400, 'Only approved reminders can be sent.');
  }

  const updated = await reminderService.sendReminder(id, req.user._id);
  return success(res, updated);
});

export const generateFromContinuity = asyncHandler(async (req, res) => {
  const { patientId } = req.body || {};
  if (!patientId) throw new ApiError(400, 'patientId is required.');
  validateObjectId(patientId, 'patient ID');

  const { evaluateContinuityRules } = await import('../services/continuity.service.js');
  const insights = await evaluateContinuityRules(patientId);

  const results = await reminderService.generateFromContinuityInsights(patientId, req.user._id, insights);
  return success(res, { patientId, generated: results.length, results });
});

export const reminderController = {
  listReminders,
  createReminder,
  getReminder,
  submitForApproval,
  approveReminder,
  cancelReminder,
  sendReminder,
  generateFromContinuity,
};

export default reminderController;