// Mock implementation of the auth endpoints in docs/api-contract.md.
// Resolves with the same shape the real client will hand back (the envelope's
// `data`), and rejects with an axios-shaped error (`error.response.status` /
// `error.response.data`) so swapping in the real client (GL-74) is a change
// of import target, not a change to any calling code's error handling.

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

const ACCESS_TOKEN_TTL_MS = 20 * 1000;
const REFRESH_TOKEN_TTL_MS = 5 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['seeker', 'business'];

const users = [
  {
    id: '64f1a2b3c4d5e6f7a8b9c0d1',
    email: 'seeker@giglanka.test',
    password: 'Password123!',
    role: 'seeker',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '64f1a2b3c4d5e6f7a8b9c0d2',
    email: 'business@giglanka.test',
    password: 'Password123!',
    role: 'business',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '64f1a2b3c4d5e6f7a8b9c0d3',
    email: 'admin@giglanka.test',
    password: 'Password123!',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const accessTokens = new Map();
const refreshTokens = new Map();

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomToken() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function randomObjectId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function apiError(status, code, message, errors) {
  const error = new Error(message);
  error.response = {
    status,
    data: {
      success: false,
      error: errors ? { code, message, errors } : { code, message },
    },
  };
  return error;
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function validateRegisterInput({ email, password, role }) {
  const errors = [];
  if (!email || !EMAIL_RE.test(email)) {
    errors.push({ field: 'email', message: 'must be a valid email address' });
  }
  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: 'must be at least 8 characters' });
  }
  if (!role || !ROLES.includes(role)) {
    errors.push({ field: 'role', message: "must be 'seeker' or 'business'" });
  }
  return errors;
}

function issueSession(user) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  accessTokens.set(accessToken, { userId: user.id, expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS });
  refreshTokens.set(refreshToken, {
    userId: user.id,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });
  return { user: toPublicUser(user), accessToken, refreshToken };
}

function requireValidAccessToken(accessToken) {
  if (!accessToken || !accessTokens.has(accessToken)) {
    throw apiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
  }
  const record = accessTokens.get(accessToken);
  if (record.expiresAt < Date.now()) {
    accessTokens.delete(accessToken);
    throw apiError(401, 'TOKEN_EXPIRED', 'Access token has expired. Please refresh your session.');
  }
  return record.userId;
}

async function register({ email, password, role }) {
  await delay();

  const validationErrors = validateRegisterInput({ email, password, role });
  if (validationErrors.length > 0) {
    throw apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', validationErrors);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw apiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
  }

  const user = {
    id: randomObjectId(),
    email: normalizedEmail,
    password,
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);

  return issueSession(user);
}

async function login({ email, password }) {
  await delay();

  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = users.find((candidate) => candidate.email === normalizedEmail);
  if (!user || user.password !== password) {
    throw apiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  return issueSession(user);
}

async function refresh({ refreshToken }) {
  await delay();

  const record = refreshTokens.get(refreshToken);
  if (!record) {
    throw apiError(401, 'TOKEN_INVALID', 'Refresh token is invalid.');
  }
  refreshTokens.delete(refreshToken);

  if (record.expiresAt < Date.now()) {
    throw apiError(401, 'TOKEN_EXPIRED', 'Refresh token has expired. Please log in again.');
  }

  const user = users.find((candidate) => candidate.id === record.userId);
  if (!user) {
    throw apiError(401, 'TOKEN_INVALID', 'Refresh token is invalid.');
  }

  const accessToken = randomToken();
  const newRefreshToken = randomToken();
  accessTokens.set(accessToken, { userId: user.id, expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS });
  refreshTokens.set(newRefreshToken, {
    userId: user.id,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout({ accessToken, refreshToken }) {
  await delay();

  requireValidAccessToken(accessToken);

  accessTokens.delete(accessToken);
  if (refreshToken) {
    refreshTokens.delete(refreshToken);
  }

  return null;
}

async function getCurrentUser({ accessToken }) {
  await delay();

  const userId = requireValidAccessToken(accessToken);
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw apiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
  }

  return { user: toPublicUser(user) };
}

export default {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
};
