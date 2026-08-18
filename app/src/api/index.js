// Resolves each API module to its mock or real implementation based on
// USE_MOCK. Switching implementations is done entirely via the
// EXPO_PUBLIC_USE_MOCK env var - no code here needs to change.

import { USE_MOCK } from '../constants/config';
import authApiMock from './mock/authApi';
import authApiReal from './authApi';
import profileApiReal from './profileApi';
import uploadApiReal from './uploadApi';

export const authApi = USE_MOCK ? authApiMock : authApiReal;

// No mock adapter exists for the profile or upload endpoints - GL-145 and
// GL-152 ship the real clients only, so these calls reach the server even
// when USE_MOCK is set. Run the E2 screens against a running API, or add a
// mock module here.
export const profileApi = profileApiReal;
export const uploadApi = uploadApiReal;
