import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success, created, noContent } from '../utils/response.js';
import { escalationService } from '../services/index.js';
import { ROLES } from '../models/User.js';
import { OBJECT_ID_RE } from '../utils/validation.js';

const validateObjectId = (id, field = 'ID') => {
  if (!OBJECT_ID_RE.test(id)) {
    throw new ApiError(400, `Invalid ${field}.`);
  }
};

export const listEscalations = asyncHandler(async (req, res) => {
  const { patientId, status, page = 1, limit = 20 } = req.query;

  if (patientId) validateObjectId(patientId, 'patient ID');

  const createdBy = req.user.role === 'patient' ? req.user._id : (patientId ? null : req.user._id);
  const reviewedBy = req.user.role === 'doctor' ? req.user._id : null;

  const result = await escalationService.listEscalations({
    patientId: req.user.role === 'patient' ? (await import('../models/index.js')).Patient.findOne({ user: req.user._id }).lean().then(p => p?._id) : patientId,
    createdBy,
    reviewedBy,
    status,
    page,
    limit,
  });

  return success(res, result.items, result.meta);
});

export const createEscalation = asyncHandler(async (req, res) => {
  const {
    patientId,
    type,
    sourceEvent,
    reason,
    evidence,
    priority = 'medium',
  } = req.body || {};

  if (!patientId || !type || !reason) {
    throw new ApiError(400, 'patientId, type, and reason are required.');
  }
  validateObjectId(patientId, 'patient ID');

  const { escalation, duplicate } = await escalationService.createEscalation({
    patientId,
    createdBy: req.user._id,
    type,
    sourceEvent,
    reason,
    evidence,
    priority,
  });

  if (duplicate) {
    return success(res, escalation, { duplicate: true });
  }
  return created(res, escalation);
});

export const getEscalation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'escalation ID');

  const escalation = await escalationService.getEscalationById(id);
  if (!escalation) throw new ApiError(404, 'Escalation not found.');

  const authorized = await escalationService.validateAuthorization(escalation, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to view this escalation.');

  return success(res, escalation);
});

export const acknowledgeEscalation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'escalation ID');

  const escalation = await escalationService.getEscalationById(id);
  if (!escalation) throw new ApiError(404, 'Escalation not found.');

  const authorized = await escalationService.validateAuthorization(escalation, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to modify this escalation.');

  const updated = await escalationService.acknowledgeEscalation(id, req.user._id);
  return success(res, updated);
});

export const startProgress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'escalation ID');

  const escalation = await escalationService.getEscalationById(id);
  if (!escalation) throw new ApiError(404, 'Escalation not found.');

  const authorized = await escalationService.validateAuthorization(escalation, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to modify this escalation.');

  const updated = await escalationService.startProgress(id, req.user._id);
  return success(res, updated);
});

export const resolveEscalation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body || {};
  validateObjectId(id, 'escalation ID');

  const escalation = await escalationService.getEscalationById(id);
  if (!escalation) throw new ApiError(404, 'Escalation not found.');

  const authorized = await escalationService.validateAuthorization(escalation, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to resolve this escalation.');

  if (!resolution) throw new ApiError(400, 'Resolution reason is required.');

  const updated = await escalationService.resolveEscalation(id, req.user._id, resolution);
  return success(res, updated);
});

export const dismissEscalation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { dismissalReason } = req.body || {};
  validateObjectId(id, 'escalation ID');

  const escalation = await escalationService.getEscalationById(id);
  if (!escalation) throw new ApiError(404, 'Escalation not found.');

  const authorized = await escalationService.validateAuthorization(escalation, req.user);
  if (!authorized) throw new ApiError(403, 'You are not authorized to dismiss this escalation.');

  if (!dismissalReason) throw new ApiError(400, 'Dismissal reason is required.');

  const updated = await escalationService.dismissEscalation(id, req.user._id, dismissalReason);
  return success(res, updated);
});

export const generateFromContinuity = asyncHandler(async (req, res) => {
  const { patientId } = req.body || {};
  if (!patientId) throw new ApiError(400, 'patientId is required.');
  validateObjectId(patientId, 'patient ID');

  const { evaluateContinuityRules } = await import('../services/continuity.service.js');
  const insights = await evaluateContinuityRules(patientId);

  const results = await escalationService.generateFromContinuityInsights(patientId, req.user._id, insights);
  return success(res, { patientId, generated: results.length, results });
});

export const escalationController = {
  listEscalations,
  createEscalation,
  getEscalation,
  acknowledgeEscalation,
  startProgress,
  resolveEscalation,
  dismissEscalation,
  generateFromContinuity,
};

export default escalationController;