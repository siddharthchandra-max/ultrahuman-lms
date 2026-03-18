import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: baseURL ? `${baseURL}/api` : '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('uh_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('uh_token');
      localStorage.removeItem('uh_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export function formatINR(num) {
  if (!num) return '-';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
}

export function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
