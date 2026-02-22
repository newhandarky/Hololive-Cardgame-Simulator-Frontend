import axios from 'axios';
import { useEffect, useMemo, useState, type FC } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { GameRoomScreen } from './components/screens/GameRoomScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { CardAdminPage } from './pages/CardAdminPage';
import { CardCatalogPage } from './pages/CardCatalogPage';
import { DeckEditorPage } from './pages/DeckEditorPage';
import { NotFoundPage } from './pages/NotFoundPage';
import {
  createMatch,
  endTurn,
  getMatch,
  getMatchState,
  getMatchWsUrl,
  getUsers,
  healthCheck,
  joinMatch,
  loginWithLine,
  setMatchReady,
  setupQuickDeck,
  startMatch,
  type ApiUser,
  type GameState,
  type LobbyEvent,
  type LobbyMatch,
  type LobbyPlayer,
} from './services/api';

const MOCK_ID_STORAGE_KEY = 'mockLineId';

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

interface GameRoomRouteProps {
  currentMatch: LobbyMatch | null;
  currentGameState: GameState | null;
  wsStatus: string;
  myDisplayName: string;
  opponentDisplayName: string;
  currentUserId: number | null;
  busy: boolean;
  onEndTurn: () => Promise<void>;
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
  onEndTurn,
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
      onEndTurn={onEndTurn}
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

  const [mockLineId, setMockLineId] = useState(getInitialMockLineId);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentMatch, setCurrentMatch] = useState<LobbyMatch | null>(null);
  const [currentGameState, setCurrentGameState] = useState<GameState | null>(null);
  const [wsStatus, setWsStatus] = useState('Disconnected');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const myDisplayName = useMemo(() => {
    if (currentUserId == null) return '我方玩家';
    return userMap.get(currentUserId)?.displayName ?? `玩家 #${currentUserId}`;
  }, [currentUserId, userMap]);

  const opponentDisplayName = useMemo(() => {
    if (!opponentPlayer) return '對手玩家';
    return userMap.get(opponentPlayer.userId)?.displayName ?? `玩家 #${opponentPlayer.userId}`;
  }, [opponentPlayer, userMap]);

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

  // 讀取指定房間的場地快照，供 GameRoom 直接渲染
  const loadGameState = async (matchId: number) => {
    const snapshot = await withReauth(() => getMatchState(matchId));
    setCurrentGameState(snapshot);
  };

  // 初始流程：健康檢查 -> mock 登入 -> 載入使用者清單
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

      await loadUsers();
    };

    void init();
    // 僅在頁面載入時初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await loadUsers();
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

  const handleSetupQuickDeck = async () => {
    setBusy(true);
    setError(null);
    try {
      await withReauth(() => setupQuickDeck());
    } catch (err) {
      setError(getApiErrorMessage(err, '補齊測試牌組失敗'));
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">
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
              loadingUsers={loadingUsers}
              users={users}
              currentMatch={currentMatch}
              myPlayer={myPlayer}
              isHost={isHost}
              onMockLineIdChange={setMockLineId}
              onRoomCodeInputChange={setRoomCodeInput}
              onSignInAs={handleSignInAs}
              onSetupQuickDeck={handleSetupQuickDeck}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onToggleReady={handleToggleReady}
              onStartMatch={handleStart}
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
              onEndTurn={handleEndTurn}
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
