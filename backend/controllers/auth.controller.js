import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { success, noContent } from '../utils/response.js';
import { User, ROLES } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { NGO } from '../models/NGO.js';
import { Government } from '../models/Government.js';
import { authService } from '../services/auth.service.js';

const isValidRole = (role) =>
  Object.values(ROLES).includes(role);

const isPublicRole = (role) =>
  [ROLES.DOCTOR, ROLES.PATIENT, ROLES.NGO, ROLES.GOVERNMENT].includes(role);

const createRoleProfile = async (role, user, body) => {
  if (role === ROLES.DOCTOR) {
    const existing = await Doctor.findOne({ user: user._id });
    if (!existing) {
      await Doctor.create({
        user: user._id,
        name: user.name,
        email: user.email,
        specialization: body.specialization || 'General Medicine',
        hospital: body.hospital || '',
        experience: body.experience || 0,
        phone: user.phone || '',
        availability: { status: 'online' },
      });
    }
  } else if (role === ROLES.PATIENT) {
    const existing = await Patient.findOne({ user: user._id });
    if (!existing) {
      const patientId = `JD-${Date.now().toString(36).toUpperCase()}`;
      await Patient.create({
        user: user._id,
        patientId,
        personalInfo: {
          fullName: user.name,
          email: user.email,
          phone: user.phone || '',
          address: body.address || '',
          village: body.village || '',
          dateOfBirth: body.dateOfBirth || null,
          gender: body.gender || '',
        },
        emergencyContact: {
          name: body.emergencyContactName || '',
          relationship: body.emergencyContactRelationship || '',
          phone: body.emergencyContactPhone || '',
        },
        queue: { status: 'completed' },
      });
    }
  } else if (role === ROLES.NGO) {
    const existing = await NGO.findOne({ user: user._id });
    if (!existing) {
      await NGO.create({
        user: user._id,
        organization: body.organization || user.name,
        email: user.email,
        phone: user.phone || '',
        workerId: body.workerId || '',
        designation: body.designation || '',
        region: body.region || '',
      });
    }
  } else if (role === ROLES.GOVERNMENT) {
    const existing = await Government.findOne({ user: user._id });
    if (!existing) {
      await Government.create({
        user: user._id,
        designation: body.designation || 'Health Official',
        department: body.department || 'Health',
        district: body.district || '',
        region: body.region || '',
        email: user.email,
        phone: user.phone || '',
      });
    }
  }
};

/**
 * POST /auth/login
 * Body: { role, email, password }
 */
export const login = asyncHandler(async (req, res) => {
  const { role, email, password } = req.body || {};

  if (!role || !isValidRole(role)) {
    throw new ApiError(400, 'A valid role is required.');
  }
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase(), role }).select('+password');
  if (!user) {
    throw new ApiError(404, 'No account found with this email. Please register first.');
  }
  if (!(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid password.');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Contact support.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = authService.signAccessToken(user);
  const payload = authService.toAuthUser(user);
  return success(res, { token, user: payload }, { role }, 200);
});

/**
 * POST /auth/register
 * Body: { role, name, email, password, phone?, profile? }
 * Public registration is limited to non-admin roles.
 */
export const register = asyncHandler(async (req, res) => {
  const { role, name, email, password, phone, profile } = req.body || {};

  if (!role || !isPublicRole(role)) {
    throw new ApiError(
      400,
      'Public registration is only available for doctor, patient, ngo or government accounts.'
    );
  }
  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email and password are required.');
  }
  if (String(password).length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long.');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const user = await User.create({
    role,
    name,
    email: email.toLowerCase(),
    password,
    phone: phone || '',
  });

  await createRoleProfile(role, user, req.body);

  const token = authService.signAccessToken(user);
  const payload = authService.toAuthUser(user);
  return success(res, { token, user: payload }, { role }, 201);
});

/**
 * POST /auth/logout
 * Stateless JWT — client discards the token. Kept for API symmetry.
 */
export const logout = asyncHandler(async (_req, res) => noContent(res));

/**
 * GET /auth/verify
 * Query: { token }
 */
export const verifyToken = asyncHandler(async (req, res) => {
  const { token } = req.query || {};
  if (!token) {
    throw new ApiError(400, 'Token is required.');
  }

  const payload = authService.verifyAccessToken(String(token));
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Token is not associated with an active account.');
  }

  return success(res, {
    valid: true,
    user: authService.toAuthUser(user),
  });
});

/**
 * POST /auth/request-access
 * Body: { role, name, email, reason }
 * Stub for admin-approval flows; returns a receipt without creating a user.
 */
export const requestAccess = asyncHandler(async (req, res) => {
  const { role, name, email, reason } = req.body || {};
  if (!role || !name || !email) {
    throw new ApiError(400, 'Role, name and email are required.');
  }

  return success(
    res,
    {
      requestId: `REQ-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
    },
    { message: 'Access request submitted for review.' },
    202
  );
});

export const authController = { login, register, logout, verifyToken, requestAccess };
export default authController;
