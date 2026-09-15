import axios from 'axios';

// HARDCODED — no env vars, no fallbacks, no ambiguity
const API_URL = 'https://garage-inventory-backend.onrender.com/api';

console.log('🚀 API baseURL =', API_URL);
console.log('🚀 import.meta.env.VITE_API_URL =', import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  console.log('→ REQUEST:', config.method.toUpperCase(), config.baseURL + config.url);
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('← ERROR:', (err.config?.baseURL || '') + (err.config?.url || ''), '→ status', err.response?.status);
    return Promise.reject(err);
  }
);

export default api;