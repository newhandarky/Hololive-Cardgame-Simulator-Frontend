import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { ApiUser, DeckSummary, LobbyMatch, LobbyPlayer } from '../../services/api';

interface LobbyScreenProps {
  health: string;
  authStatus: string;
  mockLineId: string;
  roomCodeInput: string;
  busy: boolean;
  wsStatus: string;
  loadingUsers: boolean;
  loadingDecks: boolean;
  users: ApiUser[];
  decks: DeckSummary[];
  activeDeckId: number | null;
  currentMatch: LobbyMatch | null;
  myPlayer: LobbyPlayer | null;
  isHost: boolean;
  onMockLineIdChange: (value: string) => void;
  onRoomCodeInputChange: (value: string) => void;
  onSignInAs: () => Promise<void>;
  onSetupQuickDeck: () => Promise<void>;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: () => Promise<void>;
  onToggleReady: () => Promise<void>;
  onStartMatch: () => Promise<void>;
  onSelectDeck: (deckId: number) => Promise<void>;
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
  loadingDecks,
  users,
  decks,
  activeDeckId,
  currentMatch,
  myPlayer,
  isHost,
  onMockLineIdChange,
  onRoomCodeInputChange,
  onSignInAs,
  onSetupQuickDeck,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartMatch,
  onSelectDeck,
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
          <button type="button" onClick={() => void onSetupQuickDeck()} disabled={busy}>
            一鍵補測試牌組
          </button>
          <Link className="button-link" to="/cards">
            卡片查詢頁
          </Link>
          <Link className="button-link" to="/deck-editor">
            編輯卡牌頁
          </Link>
          <Link className="button-link" to="/card-admin">
            卡片管理頁
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>對戰牌組</h2>
        <div className="row">
          <select
            value={activeDeckId ?? ''}
            onChange={(event) => {
              if (!event.target.value) {
                return;
              }
              void onSelectDeck(Number(event.target.value));
            }}
            disabled={busy || loadingDecks || decks.length === 0}
          >
            {decks.length === 0 ? <option value="">目前沒有牌組</option> : null}
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}（{deck.totalCards} 張{deck.active ? ' / 啟用中' : ''}）
              </option>
            ))}
          </select>
        </div>
        <p className="lobby-deck-hint">
          {loadingDecks
            ? '牌組載入中...'
            : activeDeckId != null
              ? `目前啟用牌組 ID：${activeDeckId}`
              : '尚未設定可用牌組，請先到「編輯卡牌頁」建立或使用一鍵補測試牌組。'}
        </p>
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
              <button type="button" onClick={() => void onToggleReady()} disabled={busy || !myPlayer || activeDeckId == null}>
                {myPlayer?.ready ? 'Set Not Ready' : 'Set Ready'}
              </button>
              <button
                type="button"
                onClick={() => void onStartMatch()}
                disabled={busy || !isHost || currentMatch.status !== 'READY' || activeDeckId == null}
              >
                Start Match
              </button>
            </div>
            {activeDeckId == null ? <p className="lobby-deck-hint">請先在上方選擇可用牌組，才能準備與開始對戰。</p> : null}
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
