import * as Linking from 'expo-linking';

const RESET_PASSWORD_PATH = 'reset-password';

// `giglanka://` is the scheme from app.json (what the emailed link's bridge
// page opens); createURL('/') is the Expo Go URL used in development, so the
// same path can be tested before any build exists.
const prefixes = [Linking.createURL('/'), 'giglanka://'];

// ResetPassword is registered only in AuthStack, which is mounted only while
// signed out - so this mapping can only land for a signed-out user. The
// signed-in case never reaches it; see useResetLinkRedirect.
export const linkingConfig = {
  prefixes,
  config: {
    screens: {
      ResetPassword: RESET_PASSWORD_PATH,
    },
  },
};

// Mirrors how React Navigation strips a prefix before matching a path, so the
// redirect hook agrees with the config above on what counts as a reset link.
export function isResetPasswordLink(url) {
  if (typeof url !== 'string') return false;

  const prefix = prefixes.find((candidate) => url.startsWith(candidate));
  if (prefix === undefined) return false;

  const path = url
    .slice(prefix.length)
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, '');
  return path === RESET_PASSWORD_PATH;
}

export function getResetToken(url) {
  const { token } = Linking.parse(url).queryParams ?? {};
  return typeof token === 'string' ? token : undefined;
}
