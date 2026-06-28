import axios from 'axios';

const ADMIN_TOKEN_KEY = 'roadmap_admin_token';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 8000,
});

http.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY);

  if (token) {
    nextConfig.headers = {
      ...nextConfig.headers,
      'X-Admin-Token': token,
    };
  }

  return nextConfig;
});

export default http;
