import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success, created, noContent } from '../utils/response.js';
import {
  User,
  Patient,
  Doctor,
  HealthCamp,
  Consultation,
} from '../models/index.js';

/**
 * GET /admin/dashboard
 * Role: admin
 */
export const getDashboard = asyncHandler(async (_req, res) => {
  const [users, patients, doctors, activeCamps, consultations] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Patient.countDocuments(),
    Doctor.countDocuments(),
    HealthCamp.countDocuments(),
    Consultation.countDocuments(),
  ]);

  return success(res, {
    stats: { users, patients, doctors, activeCamps, consultations },
  });
});

/**
 * GET /admin/users
 * Query: { role, search, page, limit }
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const query = {};
  const VALID_ROLES = ['admin', 'doctor', 'patient', 'ngo', 'government'];
  if (role && VALID_ROLES.includes(role.toLowerCase())) {
    query.role = role.toLowerCase();
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [items, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    User.countDocuments(query),
  ]);

  return success(
    res,
    items,
    { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  );
});

/**
 * GET /admin/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw new ApiError(404, 'User not found.');
  return success(res, user);
});

/**
 * PUT /admin/users/:id
 * Body: { name, phone, isActive, role }
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  const { password, ...updates } = req.body || {};
  Object.assign(user, updates);
  await user.save();
  return success(res, user);
});

/**
 * DELETE /admin/users/:id
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  // Remove the linked role profile if any.
  const linkedModels = { patient: Patient, doctor: Doctor };
  const Model = linkedModels[user.role];
  if (Model) await Model.findOneAndDelete({ user: user._id });

  return noContent(res);
});

/**
 * GET /admin/audit
 * Demo audit log of high-risk events (extend with a real AuditLog model later).
 */
export const getAuditLog = asyncHandler(async (_req, res) => {
  const entries = [
    {
      id: 'AUD-1001',
      type: 'critical-risk',
      actor: 'Dr. Anil Deshmukh',
      patient: 'JD-8F2KQ3',
      summary: 'Critical vitals flagged — emergency referral initiated',
      severity: 'critical',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    },
    {
      id: 'AUD-1002',
      type: 'duplicate-record',
      actor: 'System',
      patient: 'JD-5XA2MN',
      summary: 'Duplicate patient record merged automatically',
      severity: 'high',
      createdAt: new Date(Date.now() - 26 * 3600 * 1000),
    },
    {
      id: 'AUD-1003',
      type: 'unauthorized-access',
      actor: 'Unknown',
      patient: null,
      summary: 'Repeated failed login attempts blocked',
      severity: 'medium',
      createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    },
  ];

  return success(res, entries);
});

/**
 * GET /admin/surveillance
 * Disease cluster data for the surveillance map.
 */
export const getSurveillance = asyncHandler(async (_req, res) => {
  const clusters = [
    {
      id: 'CL-01',
      village: 'Amroli',
      disease: 'Acute Watery Diarrhoea',
      cases: 12,
      lat: 21.1929,
      lng: 81.2961,
      risk: 'high',
    },
    {
      id: 'CL-02',
      village: 'Palia',
      disease: 'Malaria',
      cases: 5,
      lat: 21.3116,
      lng: 81.2276,
      risk: 'moderate',
    },
    {
      id: 'CL-03',
      village: 'Devgram',
      disease: 'Dengue',
      cases: 8,
      lat: 21.4059,
      lng: 81.3832,
      risk: 'high',
    },
  ];

  return success(res, clusters);
});

export const adminController = {
  getDashboard,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAuditLog,
  getSurveillance,
};

export default adminController;
