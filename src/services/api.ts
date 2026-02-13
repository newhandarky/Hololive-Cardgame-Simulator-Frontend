import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090/api';
const AUTH_TOKEN_KEY = 'authToken';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
if (savedToken) {
  api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

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

export interface LineLoginRequest {
  idToken: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface LineLoginResponse {
  token: string;
  userId: number;
  displayName: string;
}

export interface LobbyPlayer {
  userId: number;
  ready: boolean;
}

export interface LobbyMatch {
  matchId: number;
  roomCode: string;
  status: 'WAITING' | 'READY' | 'STARTED';
  players: LobbyPlayer[];
}

export interface LobbyEvent {
  type: string;
  match: LobbyMatch;
}

export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
  delete api.defaults.headers.common.Authorization;
};

export const loginWithLine = async (payload: LineLoginRequest): Promise<LineLoginResponse> => {
  const response = await api.post<LineLoginResponse>('/auth/line-login', payload);
  setAuthToken(response.data.token);
  return response.data;
};

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

export const createMatch = async (): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>('/matches/create');
  return response.data;
};

export const joinMatch = async (roomCode: string): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>('/matches/join', { roomCode });
  return response.data;
};

export const getMatch = async (matchId: number): Promise<LobbyMatch> => {
  const response = await api.get<LobbyMatch>(`/matches/${matchId}`);
  return response.data;
};

export const setMatchReady = async (matchId: number, ready: boolean): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/ready`, { ready });
  return response.data;
};

export const startMatch = async (matchId: number): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/start`);
  return response.data;
};

export const getWsBaseUrl = (): string => {
  return API_BASE_URL.replace(/^http/i, 'ws').replace(/\/api\/?$/, '');
};
