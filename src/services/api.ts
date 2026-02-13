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
  currentTurnPlayerId: number | null;
  turnNumber: number;
  players: LobbyPlayer[];
}

export interface LobbyEvent {
  type: string;
  match: LobbyMatch;
  gameState?: GameState;
}

export interface CardSummary {
  cardId: string;
  name: string;
  cardType: string;
  rarity?: string;
  imageUrl?: string;
}

export interface DeckCard {
  cardId: string;
  count: number;
}

export interface PlayerZoneState {
  userId: number;
  oshiCount: number;
  centerCount: number;
  collabCount: number;
  backCount: number;
  deckCount: number;
  archiveCount: number;
  holopowerCount: number;
  cheerDeckCount: number;
  lifeCount: number;
  handCount: number;
}

export interface GameState {
  matchId: number;
  roomCode: string;
  status: 'WAITING' | 'READY' | 'STARTED';
  currentTurnPlayerId: number | null;
  turnNumber: number;
  players: PlayerZoneState[];
}

export interface AdminCreateCardRequest {
  cardId: string;
  name: string;
  rarity?: string;
  imageUrl?: string;
  cardType: 'OSHI' | 'MEMBER' | 'SUPPORT' | 'CHEER';

  life?: number;
  mainColor?: string;
  subColor?: string;

  hp?: number;
  levelType?: 'DEBUT' | 'FIRST' | 'SECOND';
  bloomLevel?: number;
  passiveEffectJson?: string;
  triggerCondition?: string;

  limited?: boolean;
  conditionType?: string;
  conditionJson?: string;
  effectType?: string;
  effectJson?: string;
  targetType?: 'SELF' | 'ENEMY' | 'BOTH' | 'SELF_CENTER' | 'ENEMY_CENTER' | 'ANY_HOLOMEM';

  color?: string;
}

export const getAuthToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

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

export const endTurn = async (matchId: number): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/end-turn`);
  return response.data;
};

export const getMatchState = async (matchId: number): Promise<GameState> => {
  const response = await api.get<GameState>(`/matches/${matchId}/state`);
  return response.data;
};

export const getCards = async (params?: { type?: string; keyword?: string }): Promise<CardSummary[]> => {
  const response = await api.get<CardSummary[]>('/cards', { params });
  return response.data;
};

export const createAdminCard = async (payload: AdminCreateCardRequest): Promise<CardSummary> => {
  const response = await api.post<CardSummary>('/card-admin/cards', payload);
  return response.data;
};

export const getMyDeck = async (): Promise<DeckCard[]> => {
  const response = await api.get<DeckCard[]>('/decks/me');
  return response.data;
};

export const updateDeckCard = async (cardId: string, count: number): Promise<DeckCard> => {
  const response = await api.put<DeckCard>(`/decks/me/cards/${cardId}`, { count });
  return response.data;
};

export const getWsBaseUrl = (): string => {
  return API_BASE_URL.replace(/^http/i, 'ws').replace(/\/api\/?$/, '');
};

export const getMatchWsUrl = (matchId: number): string => {
  const token = getAuthToken();
  const base = `${getWsBaseUrl()}/ws/matches/${matchId}`;
  if (!token) {
    return base;
  }
  return `${base}?token=${encodeURIComponent(token)}`;
};
