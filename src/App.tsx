import axios from 'axios';
import { useEffect, useMemo, useState, type CSSProperties, type FC } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { GameRoomScreen } from './components/screens/GameRoomScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { CardAdminPage } from './pages/CardAdminPage';
import { CardCatalogPage } from './pages/CardCatalogPage';
import { DeckEditorPage } from './pages/DeckEditorPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BackgroundGalleryPage } from './pages/BackgroundGalleryPage';
import {
  activateMyDeck,
  attachCheer,
  attackArt,
  bloom,
  concede,
  createBackgroundAsset,
  createMatch,
  createVsHardNpcMatch,
  drawTurn,
  endTurn,
  getBackgroundAssets,
  getMyDeckList,
  getMatch,
  getMatchState,
  getMatchWsUrl,
  getUsers,
  healthCheck,
  joinMatch,
  loginWithLine,
  moveStageHolomem,
  playSupport,
  playToStage,
  resolveDecision,
  sendTurnCheer,
  setMatchReady,
  setupQuickDeck,
  startMatch,
  type AttachCheerActionRequest,
  type AttackArtActionRequest,
  type BloomActionRequest,
  type ApiUser,
  type DeckSummary,
  type GameState,
  type LobbyEvent,
  type LobbyMatch,
  type LobbyPlayer,
  type MoveStageHolomemActionRequest,
  type PlaySupportActionRequest,
  type PlayToStageActionRequest,
  type ResolveDecisionActionRequest,
} from './services/api';

const MOCK_ID_STORAGE_KEY = 'mockLineId';
const BACKGROUND_CUSTOMIZATION_STORAGE_KEY = 'holoBackgroundCustomizationV1';

interface BackgroundCustomizationState {
  fieldBackgroundUrls: string[];
  cardAndCheerBackgroundUrls: string[];
  selectedFieldBackgroundUrl: string | null;
  selectedCardBackgroundUrl: string | null;
  selectedCheerBackgroundUrl: string | null;
}

const DEFAULT_BACKGROUND_CUSTOMIZATION: BackgroundCustomizationState = {
  fieldBackgroundUrls: [],
  cardAndCheerBackgroundUrls: [],
  selectedFieldBackgroundUrl: null,
  selectedCardBackgroundUrl: null,
  selectedCheerBackgroundUrl: null,
};

const createDefaultMockLineId = (): string => {
  return `frontend_${Math.floor(Math.random() * 1000000)}`;
};

const getInitialMockLineId = (): string => {
  const saved = sessionStorage.getItem(MOCK_ID_STORAGE_KEY);
  if (saved && saved.trim()) {
    return saved;
  }

  const generated = createDefaultMockLineId();
  sessionStorage.setItem(MOCK_ID_STORAGE_KEY, generated);
  return generated;
};

const normalizeImageUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const toCssImageValue = (url: string | null): string => {
  if (!url || !url.trim()) {
    return 'none';
  }
  return `url("${url.replace(/"/g, '\\"')}")`;
};

const loadBackgroundCustomization = (): BackgroundCustomizationState => {
  const raw = localStorage.getItem(BACKGROUND_CUSTOMIZATION_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_BACKGROUND_CUSTOMIZATION;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BackgroundCustomizationState>;
    return {
      fieldBackgroundUrls: [],
      cardAndCheerBackgroundUrls: [],
      selectedFieldBackgroundUrl: normalizeImageUrl(parsed.selectedFieldBackgroundUrl ?? '') ?? null,
      selectedCardBackgroundUrl: normalizeImageUrl(parsed.selectedCardBackgroundUrl ?? '') ?? null,
      selectedCheerBackgroundUrl: normalizeImageUrl(parsed.selectedCheerBackgroundUrl ?? '') ?? null,
    };
  } catch {
    return DEFAULT_BACKGROUND_CUSTOMIZATION;
  }
};

interface GameRoomRouteProps {
  currentMatch: LobbyMatch | null;
  currentGameState: GameState | null;
  wsStatus: string;
  myDisplayName: string;
  opponentDisplayName: string;
  currentUserId: number | null;
  busy: boolean;
  onPlayToStage: (payload: PlayToStageActionRequest) => Promise<void>;
  onPlaySupport: (payload: PlaySupportActionRequest) => Promise<void>;
  onBloom: (payload: BloomActionRequest) => Promise<void>;
  onAttachCheer: (payload: AttachCheerActionRequest) => Promise<void>;
  onAttackArt: (payload: AttackArtActionRequest) => Promise<void>;
  onDrawTurn: () => Promise<void>;
  onSendTurnCheer: () => Promise<void>;
  onMoveStageHolomem: (payload: MoveStageHolomemActionRequest) => Promise<void>;
  onResolveDecision: (payload: ResolveDecisionActionRequest) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onConcede: () => Promise<void>;
  errorMessage: string | null;
  onBackToLobby: () => void;
}

// GameRoom 路由守門：確保網址 matchId 與本地房間一致
const GameRoomRoute: FC<GameRoomRouteProps> = ({
  currentMatch,
  currentGameState,
  wsStatus,
  myDisplayName,
  opponentDisplayName,
  currentUserId,
  busy,
  onPlayToStage,
  onPlaySupport,
  onBloom,
  onAttachCheer,
  onAttackArt,
  onDrawTurn,
  onSendTurnCheer,
  onMoveStageHolomem,
  onResolveDecision,
  onEndTurn,
  onConcede,
  errorMessage,
  onBackToLobby,
}) => {
  const { matchId } = useParams<{ matchId: string }>();
  const routeMatchId = Number(matchId);

  if (!currentMatch) {
    return (
      <section className="panel">
        <h2>Game Room</h2>
        <p>目前沒有有效的對戰房間，請先回到 Lobby 建立或加入房間。</p>
        <button type="button" onClick={onBackToLobby}>
          回到 Lobby
        </button>
      </section>
    );
  }

  if (Number.isFinite(routeMatchId) && routeMatchId !== currentMatch.matchId) {
    return (
      <section className="panel">
        <h2>Game Room</h2>
        <p>網址房間（#{routeMatchId}）與目前連線房間（#{currentMatch.matchId}）不一致。</p>
        <button type="button" onClick={onBackToLobby}>
          回到 Lobby
        </button>
      </section>
    );
  }

  return (
    <GameRoomScreen
      currentMatch={currentMatch}
      currentGameState={currentGameState}
      wsStatus={wsStatus}
      myDisplayName={myDisplayName}
      opponentDisplayName={opponentDisplayName}
      currentUserId={currentUserId}
      busy={busy}
      onPlayToStage={onPlayToStage}
      onPlaySupport={onPlaySupport}
      onBloom={onBloom}
      onAttachCheer={onAttachCheer}
      onAttackArt={onAttackArt}
      onDrawTurn={onDrawTurn}
      onSendTurnCheer={onSendTurnCheer}
      onMoveStageHolomem={onMoveStageHolomem}
      onResolveDecision={onResolveDecision}
      onEndTurn={onEndTurn}
      onConcede={onConcede}
      errorMessage={errorMessage}
      onBackToLobby={onBackToLobby}
    />
  );
};

const App: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [health, setHealth] = useState('Checking API...');
  const [authStatus, setAuthStatus] = useState('Signing in...');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [myDecks, setMyDecks] = useState<DeckSummary[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);

  const [mockLineId, setMockLineId] = useState(getInitialMockLineId);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentMatch, setCurrentMatch] = useState<LobbyMatch | null>(null);
  const [currentGameState, setCurrentGameState] = useState<GameState | null>(null);
  const [wsStatus, setWsStatus] = useState('Disconnected');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundCustomization, setBackgroundCustomization] = useState<BackgroundCustomizationState>(
    loadBackgroundCustomization,
  );

  const userMap = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  // 我方玩家（目前登入者）
  const myPlayer = useMemo<LobbyPlayer | null>(() => {
    if (!currentMatch || currentUserId == null) return null;
    return currentMatch.players.find((player) => player.userId === currentUserId) ?? null;
  }, [currentMatch, currentUserId]);

  // 對手玩家（非目前登入者）
  const opponentPlayer = useMemo<LobbyPlayer | null>(() => {
    if (!currentMatch || currentUserId == null) return null;
    return currentMatch.players.find((player) => player.userId !== currentUserId) ?? null;
  }, [currentMatch, currentUserId]);

  const isHost = useMemo(() => {
    if (!currentMatch || currentUserId == null || currentMatch.players.length === 0) return false;
    return currentMatch.players[0].userId === currentUserId;
  }, [currentMatch, currentUserId]);
  const activeDeck = useMemo(() => myDecks.find((deck) => deck.active) ?? null, [myDecks]);

  const myDisplayName = useMemo(() => {
    if (currentUserId == null) return '我方玩家';
    return userMap.get(currentUserId)?.displayName ?? `玩家 #${currentUserId}`;
  }, [currentUserId, userMap]);

  const opponentDisplayName = useMemo(() => {
    if (!opponentPlayer) return '對手玩家';
    return userMap.get(opponentPlayer.userId)?.displayName ?? `玩家 #${opponentPlayer.userId}`;
  }, [opponentPlayer, userMap]);
  const appStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--custom-battlefield-image': toCssImageValue(backgroundCustomization.selectedFieldBackgroundUrl),
        '--custom-card-back-image': toCssImageValue(backgroundCustomization.selectedCardBackgroundUrl),
        '--custom-cheer-back-image': toCssImageValue(backgroundCustomization.selectedCheerBackgroundUrl),
      }) as CSSProperties,
    [
      backgroundCustomization.selectedCardBackgroundUrl,
      backgroundCustomization.selectedCheerBackgroundUrl,
      backgroundCustomization.selectedFieldBackgroundUrl,
    ],
  );

  const addFieldBackgroundUrl = async (url: string) => {
    const normalized = normalizeImageUrl(url);
    if (!normalized) {
      setError('場地背景 URL 無效，請輸入 http/https 圖片網址');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await withReauth(() => createBackgroundAsset({ category: 'FIELD', imageUrl: normalized }));
      const fieldAssets = await withReauth(() => getBackgroundAssets('FIELD'));
      setBackgroundCustomization((previous) => ({
        ...previous,
        fieldBackgroundUrls: fieldAssets.map((asset) => asset.imageUrl),
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, '新增場地背景失敗'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const addCardAndCheerBackgroundUrl = async (url: string) => {
    const normalized = normalizeImageUrl(url);
    if (!normalized) {
      setError('卡片/エール 背景 URL 無效，請輸入 http/https 圖片網址');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await withReauth(() => createBackgroundAsset({ category: 'CARD', imageUrl: normalized }));
      const cardAssets = await withReauth(() => getBackgroundAssets('CARD'));
      setBackgroundCustomization((previous) => ({
        ...previous,
        cardAndCheerBackgroundUrls: cardAssets.map((asset) => asset.imageUrl),
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, '新增卡片/エール 背景失敗'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const selectFieldBackgroundUrl = (url: string | null) => {
    const normalized = url == null ? null : normalizeImageUrl(url);
    setBackgroundCustomization((previous) => ({
      ...previous,
      selectedFieldBackgroundUrl: normalized,
    }));
  };

  const selectCardBackgroundUrl = (url: string | null) => {
    const normalized = url == null ? null : normalizeImageUrl(url);
    setBackgroundCustomization((previous) => ({
      ...previous,
      selectedCardBackgroundUrl: normalized,
    }));
  };

  const selectCheerBackgroundUrl = (url: string | null) => {
    const normalized = url == null ? null : normalizeImageUrl(url);
    setBackgroundCustomization((previous) => ({
      ...previous,
      selectedCheerBackgroundUrl: normalized,
    }));
  };

  // 模擬 LINE 登入，並在 localStorage 保存 JWT
  const authenticate = async (lineId: string) => {
    const normalized = lineId.trim();
    if (!normalized) {
      throw new Error('mock user id 不可為空');
    }

    sessionStorage.setItem(MOCK_ID_STORAGE_KEY, normalized);
    const loginResult = await loginWithLine({
      idToken: `mock:${normalized}`,
      displayName: `本地玩家(${normalized})`,
      avatarUrl: 'https://example.com/frontend-avatar.png',
    });
    setCurrentUserId(loginResult.userId);
    setAuthStatus(`Signed in as ${loginResult.displayName} (#${loginResult.userId})`);
    return loginResult.userId;
  };

  // 若 JWT 過期，先重登一次再重試 API
  const withReauth = async <T,>(fn: () => Promise<T>, retry = true): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (retry && axios.isAxiosError(err) && err.response?.status === 401) {
        await authenticate(mockLineId);
        return withReauth(fn, false);
      }
      throw err;
    }
  };

  // 將後端回應轉成可讀錯誤訊息，避免只看到固定英文字串
  const getApiErrorMessage = (err: unknown, fallback: string): string => {
    if (!axios.isAxiosError(err)) {
      return fallback;
    }

    const status = err.response?.status;
    const statusText = err.response?.statusText;
    const data = err.response?.data as { message?: string; error?: string } | string | undefined;

    if (typeof data === 'string' && data.trim()) {
      return data.trim();
    }
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string' && data.message.trim()) {
        return data.message.trim();
      }
      if (typeof data.error === 'string' && data.error.trim()) {
        return status ? `HTTP ${status}: ${data.error}` : data.error;
      }
    }

    if (status) {
      return `HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
    }
    return err.message || fallback;
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const data = await withReauth(() => getUsers());
      setUsers(data);
    } catch (err) {
      setError('Failed to load users from backend.');
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMyDecks = async () => {
    setLoadingDecks(true);
    setError(null);
    try {
      const decks = await withReauth(() => getMyDeckList());
      setMyDecks(decks);
    } catch (err) {
      setError(getApiErrorMessage(err, '載入牌組清單失敗'));
      console.error(err);
    } finally {
      setLoadingDecks(false);
    }
  };

  const loadSharedBackgroundAssets = async () => {
    try {
      const [fieldAssets, cardAssets] = await Promise.all([
        withReauth(() => getBackgroundAssets('FIELD')),
        withReauth(() => getBackgroundAssets('CARD')),
      ]);
      setBackgroundCustomization((previous) => ({
        ...previous,
        fieldBackgroundUrls: fieldAssets.map((asset) => asset.imageUrl),
        cardAndCheerBackgroundUrls: cardAssets.map((asset) => asset.imageUrl),
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, '載入共享背景庫失敗'));
      console.error(err);
    }
  };

  // 讀取指定房間的場地快照，供 GameRoom 直接渲染
  const loadGameState = async (matchId: number) => {
    const snapshot = await withReauth(() => getMatchState(matchId));
    setCurrentGameState(snapshot);
  };

  const syncMatchState = async (matchId: number) => {
    try {
      const [latestMatch, snapshot] = await Promise.all([
        withReauth(() => getMatch(matchId)),
        withReauth(() => getMatchState(matchId)),
      ]);
      setCurrentMatch(latestMatch);
      setCurrentGameState(snapshot);
    } catch (err) {
      console.error('Sync match state failed', err);
    }
  };

  // 初始流程：健康檢查 -> mock 登入 -> 載入使用者清單與牌組清單
  useEffect(() => {
    const init = async () => {
      try {
        const data = await healthCheck();
        setHealth(data.message);
      } catch (err) {
        setHealth('Backend connection failed.');
        console.error(err);
      }

      try {
        await authenticate(mockLineId);
      } catch (err) {
        setAuthStatus('Sign-in failed');
        setError('Failed to sign in via mock LINE login.');
        console.error(err);
      }

      await Promise.all([loadUsers(), loadMyDecks(), loadSharedBackgroundAssets()]);
    };

    void init();
    // 僅在頁面載入時初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(
      BACKGROUND_CUSTOMIZATION_STORAGE_KEY,
      JSON.stringify({
        selectedFieldBackgroundUrl: backgroundCustomization.selectedFieldBackgroundUrl,
        selectedCardBackgroundUrl: backgroundCustomization.selectedCardBackgroundUrl,
        selectedCheerBackgroundUrl: backgroundCustomization.selectedCheerBackgroundUrl,
      }),
    );
  }, [
    backgroundCustomization.selectedCardBackgroundUrl,
    backgroundCustomization.selectedCheerBackgroundUrl,
    backgroundCustomization.selectedFieldBackgroundUrl,
  ]);

  // 當使用者直接輸入 /game-room/:id 時，補抓該房間資料
  useEffect(() => {
    if (!location.pathname.startsWith('/game-room/')) {
      return;
    }

    const matchIdText = location.pathname.split('/').pop();
    const matchId = Number(matchIdText);
    if (!Number.isFinite(matchId)) {
      return;
    }
    if (currentMatch?.matchId === matchId) {
      return;
    }

    let cancelled = false;
    const loadRouteMatch = async () => {
      try {
        const match = await withReauth(() => getMatch(matchId));
        if (!cancelled) {
          setCurrentMatch(match);
          const snapshot = await withReauth(() => getMatchState(matchId));
          if (!cancelled) {
            setCurrentGameState(snapshot);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('載入房間失敗，請先回到 Lobby。');
        }
        console.error(err);
      }
    };

    void loadRouteMatch();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, currentMatch?.matchId]);

  // 進入房間後開啟 WS，接收即時房間狀態
  useEffect(() => {
    if (!currentMatch) {
      setWsStatus('Disconnected');
      setCurrentGameState(null);
      return;
    }

    const wsUrl = getMatchWsUrl(currentMatch.matchId);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setWsStatus('Connected');
    };

    socket.onclose = () => {
      setWsStatus('Disconnected');
    };

    socket.onerror = () => {
      setWsStatus('Error');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as LobbyEvent;
        if (payload.match) {
          setCurrentMatch(payload.match);
        }
        if (payload.gameState) {
          setCurrentGameState(payload.gameState);
        }
      } catch (err) {
        console.error('Invalid WS payload', err);
      }
    };

    return () => {
      socket.close();
    };
  }, [currentMatch?.matchId]);

  // Lobby 狀態補償輪詢：若 WS 在某些情境漏事件，仍可讓加入方同步進入 STARTED。
  useEffect(() => {
    if (!currentMatch || currentMatch.status === 'STARTED') {
      return;
    }

    let cancelled = false;
    const pollMatchStatus = async () => {
      try {
        const latest = await withReauth(() => getMatch(currentMatch.matchId));
        if (cancelled) {
          return;
        }
        setCurrentMatch(latest);
        if (latest.status === 'STARTED') {
          const snapshot = await withReauth(() => getMatchState(latest.matchId));
          if (!cancelled) {
            setCurrentGameState(snapshot);
          }
        }
      } catch (err) {
        console.error('Lobby polling failed', err);
      }
    };

    const timer = window.setInterval(() => {
      void pollMatchStatus();
    }, 2000);
    void pollMatchStatus();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch?.matchId, currentMatch?.status]);

  // 對戰中狀態補償輪詢：避免 WS 漏事件時，phase/pending interaction 無法即時同步。
  useEffect(() => {
    if (!currentMatch || currentMatch.status !== 'STARTED') {
      return;
    }

    let cancelled = false;
    const pollGameState = async () => {
      try {
        const [latestMatch, snapshot] = await Promise.all([
          withReauth(() => getMatch(currentMatch.matchId)),
          withReauth(() => getMatchState(currentMatch.matchId)),
        ]);
        if (cancelled) {
          return;
        }
        setCurrentMatch(latestMatch);
        setCurrentGameState(snapshot);
      } catch (err) {
        console.error('Game polling failed', err);
      }
    };

    const timer = window.setInterval(() => {
      void pollGameState();
    }, 1500);
    void pollGameState();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch?.matchId, currentMatch?.status]);

  // 房間進入 STARTED 後，自動導向對應 GameRoom 路由
  useEffect(() => {
    if (currentMatch?.status === 'STARTED') {
      const target = `/game-room/${currentMatch.matchId}`;
      if (location.pathname !== target) {
        navigate(target, { replace: true });
      }
      return;
    }

    if (!currentMatch && location.pathname.startsWith('/game-room/')) {
      navigate('/lobby', { replace: true });
    }
  }, [currentMatch, location.pathname, navigate]);

  const handleSignInAs = async () => {
    setBusy(true);
    setError(null);
    try {
      await authenticate(mockLineId);
      setCurrentMatch(null);
      setCurrentGameState(null);
      navigate('/lobby', { replace: true });
      await Promise.all([loadUsers(), loadMyDecks(), loadSharedBackgroundAssets()]);
    } catch (err) {
      setError('Failed to sign in with this mock user id.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => createMatch());
      setCurrentMatch(match);
      await loadGameState(match.matchId);
      setRoomCodeInput(match.roomCode);
      navigate('/lobby', { replace: true });
    } catch (err) {
      setError('Failed to create room.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateHardNpcRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => createVsHardNpcMatch());
      setCurrentMatch(match);
      await loadGameState(match.matchId);
      setRoomCodeInput(match.roomCode);
      navigate(`/game-room/${match.matchId}`, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, '建立 Hard NPC 對戰失敗'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };


  const handleSetupQuickDeck = async () => {
    setBusy(true);
    setError(null);
    try {
      await withReauth(() => setupQuickDeck());
      await loadMyDecks();
    } catch (err) {
      setError(getApiErrorMessage(err, '補齊測試牌組失敗'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectDeck = async (deckId: number) => {
    setBusy(true);
    setError(null);
    try {
      await withReauth(() => activateMyDeck(deckId));
      await loadMyDecks();
    } catch (err) {
      setError(getApiErrorMessage(err, '切換牌組失敗'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) {
      setError('請先輸入房間代碼');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => joinMatch(roomCodeInput.trim().toUpperCase()));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
      setRoomCodeInput(match.roomCode);
      navigate('/lobby', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to join room.'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleReady = async () => {
    if (!currentMatch || !myPlayer) return;

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => setMatchReady(currentMatch.matchId, !myPlayer.ready));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError('Failed to update ready status.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!currentMatch) return;

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => startMatch(currentMatch.matchId));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
      navigate(`/game-room/${match.matchId}`, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to start match.'));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleEndTurn = async () => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => endTurn(currentMatch.matchId));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'End Turn 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handleConcede = async () => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => concede(currentMatch.matchId));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, '投降失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handlePlayToStage = async (payload: PlayToStageActionRequest) => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => playToStage(currentMatch.matchId, payload));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'PLAY_TO_STAGE 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handlePlaySupport = async (payload: PlaySupportActionRequest) => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => playSupport(currentMatch.matchId, payload));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'PLAY_SUPPORT 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handleBloom = async (payload: BloomActionRequest) => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => bloom(currentMatch.matchId, payload));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'BLOOM 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handleAttachCheer = async (payload: AttachCheerActionRequest) => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => attachCheer(currentMatch.matchId, payload));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'ATTACH_CHEER 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handleAttackArt = async (payload: AttackArtActionRequest) => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => attackArt(currentMatch.matchId, payload));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'ATTACK_ART 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handleDrawTurn = async () => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => drawTurn(currentMatch.matchId));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'DRAW_TURN 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handleSendTurnCheer = async () => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => sendTurnCheer(currentMatch.matchId));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'TURN_CHEER 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  const handleMoveStageHolomem = async (payload: MoveStageHolomemActionRequest) => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => moveStageHolomem(currentMatch.matchId, payload));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'MOVE_STAGE_HOLOMEM 失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  void loadingUsers;
  void handleSignInAs;
  void handleSetupQuickDeck;

  const handleResolveDecision = async (payload: ResolveDecisionActionRequest) => {
    if (!currentMatch) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const match = await withReauth(() => resolveDecision(currentMatch.matchId, payload));
      setCurrentMatch(match);
      await loadGameState(match.matchId);
    } catch (err) {
      setError(getApiErrorMessage(err, '決策結算失敗'));
      console.error(err);
      await syncMatchState(currentMatch.matchId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app" style={appStyle}>
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route
          path="/lobby"
          element={
            <LobbyScreen
              health={health}
              authStatus={authStatus}
              mockLineId={mockLineId}
              roomCodeInput={roomCodeInput}
              busy={busy}
              wsStatus={wsStatus}
              loadingDecks={loadingDecks}
              decks={myDecks}
              activeDeckId={activeDeck?.id ?? null}
              currentMatch={currentMatch}
              myPlayer={myPlayer}
              isHost={isHost}
              onMockLineIdChange={setMockLineId}
              onRoomCodeInputChange={setRoomCodeInput}
              onCreateRoom={handleCreateRoom}
              onCreateHardNpcMatch={handleCreateHardNpcRoom}
              onJoinRoom={handleJoinRoom}
              onToggleReady={handleToggleReady}
              onStartMatch={handleStart}
              onSelectDeck={handleSelectDeck}
            />
          }
        />
        <Route
          path="/backgrounds/field"
          element={
            <BackgroundGalleryPage
              mode="FIELD"
              busy={busy}
              fieldBackgroundUrls={backgroundCustomization.fieldBackgroundUrls}
              cardAndCheerBackgroundUrls={backgroundCustomization.cardAndCheerBackgroundUrls}
              selectedFieldBackgroundUrl={backgroundCustomization.selectedFieldBackgroundUrl}
              selectedCardBackgroundUrl={backgroundCustomization.selectedCardBackgroundUrl}
              selectedCheerBackgroundUrl={backgroundCustomization.selectedCheerBackgroundUrl}
              onAddFieldBackgroundUrl={addFieldBackgroundUrl}
              onAddCardAndCheerBackgroundUrl={addCardAndCheerBackgroundUrl}
              onSelectFieldBackgroundUrl={selectFieldBackgroundUrl}
              onSelectCardBackgroundUrl={selectCardBackgroundUrl}
              onSelectCheerBackgroundUrl={selectCheerBackgroundUrl}
            />
          }
        />
        <Route
          path="/backgrounds/card"
          element={
            <BackgroundGalleryPage
              mode="CARD"
              busy={busy}
              fieldBackgroundUrls={backgroundCustomization.fieldBackgroundUrls}
              cardAndCheerBackgroundUrls={backgroundCustomization.cardAndCheerBackgroundUrls}
              selectedFieldBackgroundUrl={backgroundCustomization.selectedFieldBackgroundUrl}
              selectedCardBackgroundUrl={backgroundCustomization.selectedCardBackgroundUrl}
              selectedCheerBackgroundUrl={backgroundCustomization.selectedCheerBackgroundUrl}
              onAddFieldBackgroundUrl={addFieldBackgroundUrl}
              onAddCardAndCheerBackgroundUrl={addCardAndCheerBackgroundUrl}
              onSelectFieldBackgroundUrl={selectFieldBackgroundUrl}
              onSelectCardBackgroundUrl={selectCardBackgroundUrl}
              onSelectCheerBackgroundUrl={selectCheerBackgroundUrl}
            />
          }
        />
        <Route
          path="/game-room/:matchId"
          element={
            <GameRoomRoute
              currentMatch={currentMatch}
              currentGameState={currentGameState}
              wsStatus={wsStatus}
              myDisplayName={myDisplayName}
              opponentDisplayName={opponentDisplayName}
              currentUserId={currentUserId}
              busy={busy}
              onPlayToStage={handlePlayToStage}
              onPlaySupport={handlePlaySupport}
              onBloom={handleBloom}
              onAttachCheer={handleAttachCheer}
              onAttackArt={handleAttackArt}
              onDrawTurn={handleDrawTurn}
              onSendTurnCheer={handleSendTurnCheer}
              onMoveStageHolomem={handleMoveStageHolomem}
              onResolveDecision={handleResolveDecision}
              onEndTurn={handleEndTurn}
              onConcede={handleConcede}
              errorMessage={error}
              onBackToLobby={() => navigate('/lobby', { replace: true })}
            />
          }
        />
        <Route path="/deck-editor" element={<DeckEditorPage />} />
        <Route path="/cards" element={<CardCatalogPage />} />
        <Route path="/card-admin" element={<CardAdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
};

export default App;
