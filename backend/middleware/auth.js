import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { User } from '../models/User.js';
import env from '../config/env.js';

const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.query && req.query.token) return String(req.query.token).trim();
  return null;
};

/**
 * Verifies the JWT and attaches the authenticated user to req.user.
 * Optionally requires a role; pass a single role string or array.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(401, 'Authentication required. Please log in.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired token. Please log in again.');
  }

  const user = await User.findById(payload.sub).lean();
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Account not found or has been deactivated.');
  }

  req.user = user;
  req.tokenPayload = payload;
  return next();
});

export const authorize = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required.');
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        'You do not have permission to perform this action.'
      );
    }
    return next();
  });

export default authenticate;
