import axios from 'axios';

// Uses Vercel env var in production, localhost in development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

console.log('🚀 API baseURL =', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('← API error:', err.config?.method?.toUpperCase(), err.config?.baseURL + err.config?.url, '→', err.response?.status);
    return Promise.reject(err);
  }
);

export default api;