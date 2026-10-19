import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET);

/**
 * Builds the serialized user object returned to the client after
 * login/register/verify. Matches the frontend `{ user: {...} }` shape.
 */
export const toAuthUser = (user, lastLoginAt = user.lastLoginAt) => ({
  id: user._id.toString(),
  role: user.role,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  avatar: user.avatar || '',
  loggedInAt: lastLoginAt || new Date().toISOString(),
});

export const authService = {
  signAccessToken,
  verifyAccessToken,
  toAuthUser,
};

export default authService;
