import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { AUTH_EVENT } from '../services/api';

export const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem('jd_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EVENT, onExpired);
  }, []);

  const login = useCallback(async (role, email, password) => {
    const { token, user: profile } = await authService.login(role, {
      email,
      password,
    });
    const authedUser = { ...profile, role, token, loggedInAt: new Date().toISOString() };
    setUser(authedUser);
    localStorage.setItem('jd_user', JSON.stringify(authedUser));
    return authedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* session is local; always clear below */
    }
    setUser(null);
    localStorage.removeItem('jd_user');
  }, []);

  const register = useCallback(async (profile) => {
    const { token, user: created } = await authService.register(profile);
    const authedUser = { ...created, token, loggedInAt: new Date().toISOString() };
    setUser(authedUser);
    localStorage.setItem('jd_user', JSON.stringify(authedUser));
    return authedUser;
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), login, register, logout }),
    [user, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
