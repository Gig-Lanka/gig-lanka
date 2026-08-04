// Real auth client — not implemented yet. Filled in by GL-74 (Axios client
// + interceptors). Same five function signatures as ./mock/authApi.js so
// index.js can swap between them with no other code change.

function notImplemented() {
  return Promise.reject(new Error('Real auth API not implemented yet — see GL-74.'));
}

export default {
  register: notImplemented,
  login: notImplemented,
  refresh: notImplemented,
  logout: notImplemented,
  getCurrentUser: notImplemented,
};
