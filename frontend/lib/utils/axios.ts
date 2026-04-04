import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Cache token in memory to avoid localStorage blocking
let cachedToken: string | null = null;
let tokenLastChecked = 0;
const TOKEN_CACHE_DURATION = 5000; // 5 seconds

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased from 10s to 30s
});

// Request interceptor - Add token to requests (OPTIMIZED)
axiosInstance.interceptors.request.use(
  (config) => {
    const now = Date.now();
    // Only read from sessionStorage if cache is stale
    if (!cachedToken || now - tokenLastChecked > TOKEN_CACHE_DURATION) {
      cachedToken = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      tokenLastChecked = now;
    }
    if (cachedToken) {
      config.headers.Authorization = `Bearer ${cachedToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If token expired
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token, refreshToken: newRefreshToken } = response.data.data;
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Export function to clear token cache (call this on logout)
export const clearTokenCache = () => {
  cachedToken = null;
  tokenLastChecked = 0;
};

export default axiosInstance;
