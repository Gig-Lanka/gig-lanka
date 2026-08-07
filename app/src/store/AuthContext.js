import { createContext, useCallback, useMemo, useState } from 'react';

import { authApi } from '../api';
import secureStorage from './secureStorage';

export const AUTH_STATUS = {
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
};

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(AUTH_STATUS.UNAUTHENTICATED);

  const register = useCallback(async ({ email, password, role }) => {
    const result = await authApi.register({ email, password, role });
    await secureStorage.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    setUser(result.user);
    setStatus(AUTH_STATUS.AUTHENTICATED);
    return result.user;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const result = await authApi.login({ email, password });
    await secureStorage.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    setUser(result.user);
    setStatus(AUTH_STATUS.AUTHENTICATED);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const { accessToken, refreshToken } = await secureStorage.getTokens();
    try {
      await authApi.logout({ accessToken, refreshToken });
    } finally {
      await secureStorage.clearTokens();
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
