import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  apiRequest,
  clearStoredAuth,
  getPortalRoleFromPath,
  getStoredUser,
  getToken,
  setStoredAuth
} from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const activeRole = getPortalRoleFromPath(location.pathname);
  const [user, setUser] = useState(() => getStoredUser(activeRole));
  const [loading, setLoading] = useState(Boolean(getToken(activeRole)));

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      const token = getToken(activeRole);
      setUser(getStoredUser(activeRole));

      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await apiRequest('/auth/me', { authRole: activeRole });
        if (data.user.role !== activeRole) {
          throw new Error('Stored login belongs to a different portal.');
        }
        if (mounted) {
          setUser(data.user);
          setStoredAuth(token, data.user);
        }
      } catch {
        clearStoredAuth(activeRole);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadUser();
    return () => {
      mounted = false;
    };
  }, [activeRole]);

  async function login(email, password, expectedRole) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (expectedRole && data.user.role !== expectedRole) {
      throw new Error(`This account belongs to the ${data.user.role} portal.`);
    }
    setStoredAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setStoredAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearStoredAuth(activeRole);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, register, activeRole }),
    [user, loading, activeRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
