import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  createMatch,
  getUsers,
  getWsBaseUrl,
  healthCheck,
  joinMatch,
  loginWithLine,
  setMatchReady,
  startMatch,
  type ApiUser,
  type LobbyEvent,
  type LobbyMatch,
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

function App() {
  const [health, setHealth] = useState('Checking API...');
  const [authStatus, setAuthStatus] = useState('Signing in...');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [mockLineId, setMockLineId] = useState(getInitialMockLineId);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentMatch, setCurrentMatch] = useState<LobbyMatch | null>(null);
  const [wsStatus, setWsStatus] = useState('Disconnected');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myPlayer = useMemo(() => {
    if (!currentMatch || currentUserId == null) return null;
    return currentMatch.players.find((player) => player.userId === currentUserId) ?? null;
  }, [currentMatch, currentUserId]);

  const isHost = useMemo(() => {
    if (!currentMatch || currentUserId == null || currentMatch.players.length === 0) return false;
    return currentMatch.players[0].userId === currentUserId;
  }, [currentMatch, currentUserId]);

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
    // Only run once on app boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentMatch) {
      setWsStatus('Disconnected');
      return;
    }

    const wsUrl = `${getWsBaseUrl()}/ws/matches/${currentMatch.matchId}`;
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
      } catch (err) {
        console.error('Invalid WS payload', err);
      }
    };

    return () => {
      socket.close();
    };
  }, [currentMatch?.matchId]);

  const handleSignInAs = async () => {
    setBusy(true);
    setError(null);
    try {
      await authenticate(mockLineId);
      setCurrentMatch(null);
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
      setRoomCodeInput(match.roomCode);
    } catch (err) {
      setError('Failed to create room.');
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
      setRoomCodeInput(match.roomCode);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Failed to join room.');
      } else {
        setError('Failed to join room.');
      }
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
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Failed to start match.');
      } else {
        setError('Failed to start match.');
      }
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">
      <h1>HOLOLIVE Card Game</h1>
      <p>API Status: {health}</p>
      <p>Auth Status: {authStatus}</p>

      <section className="panel">
        <h2>Local Auth</h2>
        <div className="row">
          <input
            value={mockLineId}
            onChange={(event) => setMockLineId(event.target.value)}
            placeholder="Mock Line User ID"
          />
          <button type="button" onClick={handleSignInAs} disabled={busy}>
            Sign In As This User
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Lobby (Local MVP)</h2>
        <div className="row">
          <button type="button" onClick={handleCreateRoom} disabled={busy}>
            Create Room
          </button>
          <input
            value={roomCodeInput}
            onChange={(event) => setRoomCodeInput(event.target.value)}
            placeholder="Room Code"
          />
          <button type="button" onClick={handleJoinRoom} disabled={busy}>
            Join Room
          </button>
        </div>

        {currentMatch ? (
          <>
            <p>
              Match #{currentMatch.matchId} / Room: <strong>{currentMatch.roomCode}</strong> / Status:{' '}
              <strong>{currentMatch.status}</strong>
            </p>
            <p>WebSocket: {wsStatus}</p>

            <ul>
              {currentMatch.players.map((player, index) => (
                <li key={player.userId}>
                  {index === 0 ? 'Host' : 'Guest'} #{player.userId} - {player.ready ? 'Ready' : 'Not Ready'}
                </li>
              ))}
            </ul>

            <div className="row">
              <button type="button" onClick={handleToggleReady} disabled={busy || !myPlayer}>
                {myPlayer?.ready ? 'Set Not Ready' : 'Set Ready'}
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={busy || !isHost || currentMatch.status !== 'READY'}
              >
                Start Match
              </button>
            </div>
          </>
        ) : (
          <p>No room joined.</p>
        )}
      </section>

      <section className="panel">
        <h2>Users</h2>
        {loadingUsers ? <p>Loading...</p> : null}
        <ul>
          {users.map((user) => (
            <li key={user.id}>
              #{user.id} {user.displayName} ({user.lineUserId})
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}

export default App;
