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
  cardNo?: string;
  expansionCode?: string;
  mainColor?: string;
  levelType?: string;
  life?: number;
  hp?: number;
  tags?: string[];
  selectedVariantId?: number;
  variantCount?: number;
}

export interface CardSearchParams {
  keyword?: string;
  type?: string;
  rarity?: string;
  color?: string;
  levelType?: string;
  expansionCode?: string;
  tags?: string[];
  hasImage?: boolean;
  sort?: 'cardNo' | 'newest' | 'rarity' | 'name' | 'cardId';
}

export interface OshiSkillDetail {
  skillType: string;
  skillName: string;
  description?: string;
  holopowerCost?: number;
  effectJson?: string;
}

export interface MemberArtDetail {
  orderIndex: number;
  name: string;
  description?: string;
  costCheerJson?: string;
  effectJson?: string;
}

export interface CardDetail {
  cardId: string;
  name: string;
  cardType: string;
  rarity?: string;
  imageUrl?: string;
  cardNo?: string;
  expansionCode?: string;
  sourceUrl?: string;
  tags: string[];
  selectedVariantId?: number;
  variants: CardVariant[];
  mainColor?: string;
  subColor?: string;
  life?: number;
  hp?: number;
  levelType?: string;
  bloomLevel?: number;
  passiveEffectJson?: string;
  triggerCondition?: string;
  supportLimited?: boolean;
  supportConditionType?: string;
  supportConditionJson?: string;
  supportEffectType?: string;
  supportEffectJson?: string;
  supportTargetType?: string;
  cheerColor?: string;
  oshiSkills: OshiSkillDetail[];
  memberArts: MemberArtDetail[];
}

export interface CardVariant {
  id: number;
  variantCode: string;
  variantName?: string;
  imageUrl: string;
  isDefault: boolean;
}

export interface DeckCard {
  cardId: string;
  count: number;
}

export interface DeckSummary {
  id: number;
  name: string;
  format: string;
  active: boolean;
  version: number;
  totalCards: number;
  distinctCards: number;
  updatedAt: string;
}

export interface DeckDetail extends DeckSummary {
  cards: DeckCard[];
}

export interface DeckValidationError {
  code: string;
  message: string;
}

export interface DeckValidation {
  valid: boolean;
  totalCount: number;
  oshiCount: number;
  mainDeckCount: number;
  cheerDeckCount: number;
  errors: DeckValidationError[];
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
  boardZones: BoardZoneState[];
  handCards: ZoneCardInstance[];
}

export type MatchPhase = 'RESET' | 'MAIN' | 'PERFORMANCE' | 'END';

export interface ZoneCardInstance {
  cardInstanceId: number;
  cardId: string;
  zone: string;
  positionIndex: number;
  ownerUserId: number;
  faceDown: boolean;
  stackDepth?: number;
  stackCardInstanceIds?: number[];
  currentHp?: number | null;
  maxHp?: number | null;
  damageTaken?: number | null;
  cheerCount?: number | null;
  cheerColorCounts?: Record<string, number> | null;
  attachedSupportCount?: number | null;
}

export interface BoardZoneState {
  slotIndex: number;
  zone: string;
  cards: ZoneCardInstance[];
}

export interface RecentMatchAction {
  actionId: number;
  userId: number;
  actionType: string;
  turnNumber: number;
  actionOrder: number;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface PendingDecisionCandidate {
  cardInstanceId: number;
  cardId: string;
  name?: string;
  cardType?: string;
  levelType?: string;
  zone?: string;
  imageUrl?: string;
  currentHp?: number | null;
  maxHp?: number | null;
  damageTaken?: number | null;
  cheerCount?: number | null;
  cheerColorCounts?: Record<string, number> | null;
}

export interface PendingDecision {
  decisionId: number;
  decisionType: string;
  sourceActionType: string;
  sourceCardInstanceId: number;
  sourceCardId: string;
  effectType: string;
  minSelect: number;
  maxSelect: number;
  targetHolomemCardInstanceId?: number | null;
  createdAt: string;
  candidates: PendingDecisionCandidate[];
}

export interface PendingInteraction {
  interactionId: number;
  interactionType: string;
  sourceActionType: string;
  sourceCardInstanceId?: number | null;
  sourceCardId?: string | null;
  effectType: string;
  minSelect: number;
  maxSelect: number;
  targetHolomemCardInstanceId?: number | null;
  title?: string | null;
  message?: string | null;
  createdAt: string;
  cards: PendingDecisionCandidate[];
}

export interface GameState {
  matchId: number;
  roomCode: string;
  status: 'WAITING' | 'READY' | 'STARTED';
  phase: MatchPhase;
  currentTurnPlayerId: number | null;
  turnNumber: number;
  players: PlayerZoneState[];
  recentActions: RecentMatchAction[];
  pendingDecisions: PendingDecision[];
  pendingInteractions: PendingInteraction[];
}

export interface PlayToStageActionRequest {
  cardInstanceId: number;
  targetZone: 'CENTER' | 'BACK';
}

export interface PlaySupportActionRequest {
  cardInstanceId: number;
  targetHolomemCardInstanceId?: number | null;
  selectedCardInstanceIds?: number[];
}

export interface BloomActionRequest {
  bloomCardInstanceId: number;
  targetHolomemCardInstanceId: number;
}

export interface AttachCheerActionRequest {
  cheerCardInstanceId: number;
  targetHolomemCardInstanceId: number;
}

export interface AttackArtActionRequest {
  attackerCardInstanceId: number;
  targetCardInstanceId?: number | null;
}

export interface ResolveDecisionActionRequest {
  decisionId: number;
  selectedCardInstanceIds?: number[];
}

export interface MoveStageHolomemActionRequest {
  cardInstanceId: number;
  targetZone: 'CENTER' | 'COLLAB';
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
  levelType?: 'DEBUT' | 'FIRST' | 'SECOND' | 'SPOT' | 'BUZZ';
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

export const playToStage = async (matchId: number, payload: PlayToStageActionRequest): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/play-to-stage`, payload);
  return response.data;
};

export const playSupport = async (matchId: number, payload: PlaySupportActionRequest): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/play-support`, payload);
  return response.data;
};

export const bloom = async (matchId: number, payload: BloomActionRequest): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/bloom`, payload);
  return response.data;
};

export const attachCheer = async (matchId: number, payload: AttachCheerActionRequest): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/attach-cheer`, payload);
  return response.data;
};

export const attackArt = async (matchId: number, payload: AttackArtActionRequest): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/attack-art`, payload);
  return response.data;
};

export const drawTurn = async (matchId: number): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/draw-turn`);
  return response.data;
};

export const sendTurnCheer = async (matchId: number): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/send-turn-cheer`);
  return response.data;
};

export const moveStageHolomem = async (
  matchId: number,
  payload: MoveStageHolomemActionRequest,
): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/move-stage-holomem`, payload);
  return response.data;
};

export const endTurn = async (matchId: number): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/end-turn`);
  return response.data;
};

export const resolveDecision = async (
  matchId: number,
  payload: ResolveDecisionActionRequest,
): Promise<LobbyMatch> => {
  const response = await api.post<LobbyMatch>(`/matches/${matchId}/actions/resolve-decision`, payload);
  return response.data;
};

export const getMatchState = async (matchId: number): Promise<GameState> => {
  const response = await api.get<GameState>(`/matches/${matchId}/state`);
  return response.data;
};

export const getCards = async (params?: CardSearchParams): Promise<CardSummary[]> => {
  const response = await api.get<CardSummary[]>('/cards', { params });
  return response.data;
};

export const getCardDetail = async (cardId: string): Promise<CardDetail> => {
  const response = await api.get<CardDetail>(`/cards/${encodeURIComponent(cardId)}`);
  return response.data;
};

export const updatePreferredCardVariant = async (cardId: string, variantId: number | null): Promise<CardDetail> => {
  const response = await api.put<CardDetail>(`/cards/${encodeURIComponent(cardId)}/preferred-variant`, { variantId });
  return response.data;
};

export const getCardTags = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/cards/tags');
  return response.data;
};

export const createAdminCard = async (payload: AdminCreateCardRequest): Promise<CardSummary> => {
  const response = await api.post<CardSummary>('/card-admin/cards', payload);
  return response.data;
};

export const getMyDeckList = async (): Promise<DeckSummary[]> => {
  const response = await api.get<DeckSummary[]>('/decks/me/list');
  return response.data;
};

export const createMyDeck = async (name: string): Promise<DeckDetail> => {
  const response = await api.post<DeckDetail>('/decks/me', { name });
  return response.data;
};

export const getMyDeckDetail = async (deckId: number): Promise<DeckDetail> => {
  const response = await api.get<DeckDetail>(`/decks/me/${deckId}`);
  return response.data;
};

export const activateMyDeck = async (deckId: number): Promise<DeckDetail> => {
  const response = await api.post<DeckDetail>(`/decks/me/${deckId}/activate`);
  return response.data;
};

export const validateMyDeck = async (deckId: number): Promise<DeckValidation> => {
  const response = await api.post<DeckValidation>(`/decks/me/${deckId}/validate`);
  return response.data;
};

export const getMyDeck = async (): Promise<DeckCard[]> => {
  const response = await api.get<DeckCard[]>('/decks/me');
  return response.data;
};

export const setupQuickDeck = async (): Promise<DeckCard[]> => {
  const response = await api.post<DeckCard[]>('/decks/me/quick-setup');
  return response.data;
};

export const updateDeckCard = async (cardId: string, count: number): Promise<DeckCard> => {
  const response = await api.put<DeckCard>(`/decks/me/cards/${cardId}`, { count });
  return response.data;
};

export const updateDeckCardInDeck = async (deckId: number, cardId: string, count: number): Promise<DeckCard> => {
  const response = await api.put<DeckCard>(`/decks/me/${deckId}/cards/${cardId}`, { count });
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
