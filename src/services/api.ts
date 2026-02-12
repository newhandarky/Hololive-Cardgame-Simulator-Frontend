import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface HealthResponse {
  status: string;
  message: string;
}

export interface ApiUser {
  id: number;
  lineUserId: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const healthCheck = async (): Promise<HealthResponse> => {
  const response = await api.get<HealthResponse>('/health');
  return response.data;
};

export const getUsers = async (): Promise<ApiUser[]> => {
  const response = await api.get<ApiUser[]>('/users');
  return response.data;
};

export const createTestUser = async (): Promise<ApiUser> => {
  const response = await api.post<ApiUser>('/users/test');
  return response.data;
};
