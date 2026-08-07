import axios from 'axios';

import { API_BASE_URL } from '../constants/config';
import secureStorage from '../store/secureStorage';

const client = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

client.interceptors.request.use(async (config) => {
  const { accessToken } = await secureStorage.getTokens();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export default client;
