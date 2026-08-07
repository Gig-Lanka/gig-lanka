// Real auth client — GL-74. Same five function signatures as
// ./mock/authApi.js so index.js can swap between them with no other code
// change. Errors propagate as-is: axios rejections already carry
// `error.response.data.error` in the same shape the mock fakes.

import client from './client';

async function register({ email, password, role }) {
  const response = await client.post('/auth/register', { email, password, role });
  return response.data.data;
}

async function login({ email, password }) {
  const response = await client.post('/auth/login', { email, password });
  return response.data.data;
}

async function refresh({ refreshToken }) {
  const response = await client.post('/auth/refresh', { refreshToken });
  return response.data.data;
}

async function logout({ refreshToken }) {
  const response = await client.post('/auth/logout', { refreshToken });
  return response.data.data;
}

async function getCurrentUser() {
  const response = await client.get('/auth/me');
  return response.data.data;
}

export default {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
};
