import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { ApiUser, LobbyMatch, LobbyPlayer } from '../../services/api';

interface LobbyScreenProps {
  health: string;
  authStatus: string;
  mockLineId: string;
  roomCodeInput: string;
  busy: boolean;
  wsStatus: string;
  loadingUsers: boolean;
  users: ApiUser[];
  currentMatch: LobbyMatch | null;
  myPlayer: LobbyPlayer | null;
  isHost: boolean;
  onMockLineIdChange: (value: string) => void;
  onRoomCodeInputChange: (value: string) => void;
  onSignInAs: () => Promise<void>;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: () => Promise<void>;
  onToggleReady: () => Promise<void>;
  onStartMatch: () => Promise<void>;
}

// Lobby 主畫面：顯示玩家資訊、建立房間與加入房間流程
export const LobbyScreen: FC<LobbyScreenProps> = ({
  health,
  authStatus,
  mockLineId,
  roomCodeInput,
  busy,
  wsStatus,
  loadingUsers,
  users,
  currentMatch,
  myPlayer,
  isHost,
  onMockLineIdChange,
  onRoomCodeInputChange,
  onSignInAs,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartMatch,
}) => {
  return (
    <>
      <h1>HOLOLIVE Card Game</h1>
      <p>API Status: {health}</p>
      <p>Auth Status: {authStatus}</p>

      <section className="panel">
        <h2>Local Auth</h2>
        <div className="row">
          <input
            value={mockLineId}
            onChange={(event) => onMockLineIdChange(event.target.value)}
            placeholder="Mock Line User ID"
          />
          <button type="button" onClick={() => void onSignInAs()} disabled={busy}>
            Sign In As This User
          </button>
          <Link className="button-link" to="/deck-editor">
            編輯卡牌頁
          </Link>
          <Link className="button-link" to="/card-admin">
            卡片管理頁
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>Lobby</h2>
        <div className="row">
          <button type="button" onClick={() => void onCreateRoom()} disabled={busy}>
            Create Room
          </button>
          <input
            value={roomCodeInput}
            onChange={(event) => onRoomCodeInputChange(event.target.value)}
            placeholder="Room Code"
          />
          <button type="button" onClick={() => void onJoinRoom()} disabled={busy}>
            Join Room
          </button>
        </div>

        {currentMatch ? (
          <>
            <p>
              Match #{currentMatch.matchId} / Room: <strong>{currentMatch.roomCode}</strong> / Status:{' '}
              <strong>{currentMatch.status}</strong>
            </p>
            <p>Turn #{currentMatch.turnNumber}</p>
            <p>WebSocket: {wsStatus}</p>

            <ul>
              {currentMatch.players.map((player, index) => (
                <li key={player.userId}>
                  {index === 0 ? 'Host' : 'Guest'} #{player.userId} - {player.ready ? 'Ready' : 'Not Ready'}
                </li>
              ))}
            </ul>

            <div className="row">
              <button type="button" onClick={() => void onToggleReady()} disabled={busy || !myPlayer}>
                {myPlayer?.ready ? 'Set Not Ready' : 'Set Ready'}
              </button>
              <button
                type="button"
                onClick={() => void onStartMatch()}
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
    </>
  );
};
