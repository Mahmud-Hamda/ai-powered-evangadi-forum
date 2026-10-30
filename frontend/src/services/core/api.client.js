import axios from 'axios';
import { rememberAuthReturnTo } from '../../lib/utils.js';

/**
 * Shared axios instance for `/api/*` calls.
 * Base URL is `VITE_API_BASE_URL`, or `http://localhost:3777` in local dev.
 * Request interceptor adds `Authorization: Bearer <token>` when localStorage has a JWT.
 * Response interceptor sends the browser to `/auth` on 401 (except login/register).
 *
 * @type {import('axios').AxiosInstance}
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3777',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Attaches the stored JWT to every outgoing request.
 *
 * @param {import('axios').InternalAxiosRequestConfig} config - The request axios is about to send.
 * @returns {import('axios').InternalAxiosRequestConfig} The same config, possibly with Authorization.
 */
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

/**
 * On 401, clears the stored session and opens `/auth`, except login and register
 * so those forms can show their own error. The current path is kept for after sign-in.
 */
apiClient.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    const isAuthEndpoint =
      error.config?.url?.includes('/api/auth/login') ||
      error.config?.url?.includes('/api/auth/register');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      rememberAuthReturnTo(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  },
);

export { apiClient };