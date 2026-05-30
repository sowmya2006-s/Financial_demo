import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3005/api', // or relative if served from backend
});

// For testing purposes, we'll need an auth token or just bypass it for now.
// Assuming we have a token or the backend can accept requests.
// Wait, the backend requires auth. We need a login/signup flow or a mock token.
// The backend has /auth/register and /auth/login.
// Let's create an auth interceptor.

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
