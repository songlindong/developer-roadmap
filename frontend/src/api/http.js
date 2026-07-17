import axios from 'axios';

const ACCESS_TOKEN_KEY = 'roadmap_access_token';
const ADMIN_TOKEN_KEY = 'roadmap_admin_token';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 8000,
});

http.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const adminToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);

  if (accessToken || adminToken) {
    nextConfig.headers = {
      ...nextConfig.headers,
      ...(accessToken ? { 'X-Access-Token': accessToken } : {}),
      ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
    };
  }

  return nextConfig;
});

export default http;
