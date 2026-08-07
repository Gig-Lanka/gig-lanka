import { createContext, useCallback, useMemo, useState } from 'react';

import { authApi } from '../api';

export const AUTH_STATUS = {
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
};

const AuthContext = createContext(undefined);

// Held outside React state so tokens are never rendered, logged, or visible
// in devtools. Not persisted yet — session restore across app restarts is
// GL-73/session-bootstrap's job.
let tokens = { accessToken: null, refreshToken: null };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(AUTH_STATUS.UNAUTHENTICATED);

  const register = useCallback(async ({ email, password, role }) => {
    const result = await authApi.register({ email, password, role });
    tokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
    setUser(result.user);
    setStatus(AUTH_STATUS.AUTHENTICATED);
    return result.user;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const result = await authApi.login({ email, password });
    tokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
    setUser(result.user);
    setStatus(AUTH_STATUS.AUTHENTICATED);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } finally {
      tokens = { accessToken: null, refreshToken: null };
      setUser(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, register, login, logout }),
    [user, status, register, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
