import { useMemo, useState, type FC } from 'react';
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
  fieldBackgroundUrls: string[];
  cardAndCheerBackgroundUrls: string[];
  selectedFieldBackgroundUrl: string | null;
  selectedCardBackgroundUrl: string | null;
  selectedCheerBackgroundUrl: string | null;
  onMockLineIdChange: (value: string) => void;
  onRoomCodeInputChange: (value: string) => void;
  onSignInAs: () => Promise<void>;
  onSetupQuickDeck: () => Promise<void>;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: () => Promise<void>;
  onToggleReady: () => Promise<void>;
  onStartMatch: () => Promise<void>;
  onSelectDeck: (deckId: number) => Promise<void>;
  onAddFieldBackgroundUrl: (url: string) => Promise<void>;
  onAddCardAndCheerBackgroundUrl: (url: string) => Promise<void>;
  onSelectFieldBackgroundUrl: (url: string | null) => void;
  onSelectCardBackgroundUrl: (url: string | null) => void;
  onSelectCheerBackgroundUrl: (url: string | null) => void;
}

const FIELD_PAGE_SIZE = 12;
const CARD_AND_CHEER_PAGE_SIZE = 15;

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
  fieldBackgroundUrls,
  cardAndCheerBackgroundUrls,
  selectedFieldBackgroundUrl,
  selectedCardBackgroundUrl,
  selectedCheerBackgroundUrl,
  onMockLineIdChange,
  onRoomCodeInputChange,
  onSignInAs,
  onSetupQuickDeck,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartMatch,
  onSelectDeck,
  onAddFieldBackgroundUrl,
  onAddCardAndCheerBackgroundUrl,
  onSelectFieldBackgroundUrl,
  onSelectCardBackgroundUrl,
  onSelectCheerBackgroundUrl,
}) => {
  const [fieldInputUrl, setFieldInputUrl] = useState('');
  const [cardAndCheerInputUrl, setCardAndCheerInputUrl] = useState('');
  const [fieldPage, setFieldPage] = useState(0);
  const [cardAndCheerPage, setCardAndCheerPage] = useState(0);

  const fieldPageCount = Math.max(1, Math.ceil(fieldBackgroundUrls.length / FIELD_PAGE_SIZE));
  const cardAndCheerPageCount = Math.max(1, Math.ceil(cardAndCheerBackgroundUrls.length / CARD_AND_CHEER_PAGE_SIZE));

  const pagedFieldBackgrounds = useMemo(() => {
    const safePage = Math.min(fieldPage, Math.max(fieldPageCount - 1, 0));
    const start = safePage * FIELD_PAGE_SIZE;
    return fieldBackgroundUrls.slice(start, start + FIELD_PAGE_SIZE);
  }, [fieldBackgroundUrls, fieldPage, fieldPageCount]);

  const pagedCardAndCheerBackgrounds = useMemo(() => {
    const safePage = Math.min(cardAndCheerPage, Math.max(cardAndCheerPageCount - 1, 0));
    const start = safePage * CARD_AND_CHEER_PAGE_SIZE;
    return cardAndCheerBackgroundUrls.slice(start, start + CARD_AND_CHEER_PAGE_SIZE);
  }, [cardAndCheerBackgroundUrls, cardAndCheerPage, cardAndCheerPageCount]);

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
        <h2>背景自訂（Edit）</h2>

        <div className="lobby-bg-block">
          <h3>場地背景（獨立列表）</h3>
          <div className="row">
            <input
              value={fieldInputUrl}
              onChange={(event) => setFieldInputUrl(event.target.value)}
              placeholder="輸入場地背景圖片 URL"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void onAddFieldBackgroundUrl(fieldInputUrl);
                setFieldInputUrl('');
              }}
            >
              新增到場地列表
            </button>
            <button type="button" disabled={busy} onClick={() => onSelectFieldBackgroundUrl(null)}>
              使用預設場地
            </button>
          </div>

          <div className="lobby-bg-grid lobby-bg-grid--field">
            {pagedFieldBackgrounds.map((url) => (
              <button
                key={url}
                type="button"
                className={`lobby-bg-item ${selectedFieldBackgroundUrl === url ? 'is-selected' : ''}`}
                onClick={() => onSelectFieldBackgroundUrl(url)}
                title={url}
              >
                <span className="lobby-bg-item__preview" style={{ backgroundImage: `url(${url})` }} />
              </button>
            ))}
          </div>
          <div className="lobby-bg-pagination">
            <button type="button" disabled={fieldPage <= 0} onClick={() => setFieldPage((page) => Math.max(page - 1, 0))}>
              上一頁
            </button>
            <span>
              {Math.min(fieldPage + 1, fieldPageCount)} / {fieldPageCount}
            </span>
            <button
              type="button"
              disabled={fieldPage >= fieldPageCount - 1}
              onClick={() => setFieldPage((page) => Math.min(page + 1, fieldPageCount - 1))}
            >
              下一頁
            </button>
          </div>
        </div>

        <div className="lobby-bg-block">
          <h3>卡片 / エール 背景（共用列表）</h3>
          <div className="row">
            <input
              value={cardAndCheerInputUrl}
              onChange={(event) => setCardAndCheerInputUrl(event.target.value)}
              placeholder="輸入卡片或エール背景圖片 URL"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void onAddCardAndCheerBackgroundUrl(cardAndCheerInputUrl);
                setCardAndCheerInputUrl('');
              }}
            >
              新增到卡片/エール列表
            </button>
            <button type="button" disabled={busy} onClick={() => onSelectCardBackgroundUrl(null)}>
              卡片使用預設
            </button>
            <button type="button" disabled={busy} onClick={() => onSelectCheerBackgroundUrl(null)}>
              エール使用預設
            </button>
          </div>

          <div className="lobby-bg-grid lobby-bg-grid--card">
            {pagedCardAndCheerBackgrounds.map((url) => {
              const isCardSelected = selectedCardBackgroundUrl === url;
              const isCheerSelected = selectedCheerBackgroundUrl === url;
              return (
                <div
                  key={url}
                  className={`lobby-bg-item lobby-bg-item--card ${isCardSelected || isCheerSelected ? 'is-selected' : ''}`}
                  title={url}
                >
                  <span className="lobby-bg-item__preview" style={{ backgroundImage: `url(${url})` }} />
                  <div className="lobby-bg-item__actions">
                    <button type="button" className={isCardSelected ? 'is-active' : ''} onClick={() => onSelectCardBackgroundUrl(url)}>
                      卡片
                    </button>
                    <button type="button" className={isCheerSelected ? 'is-active' : ''} onClick={() => onSelectCheerBackgroundUrl(url)}>
                      エール
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lobby-bg-pagination">
            <button
              type="button"
              disabled={cardAndCheerPage <= 0}
              onClick={() => setCardAndCheerPage((page) => Math.max(page - 1, 0))}
            >
              上一頁
            </button>
            <span>
              {Math.min(cardAndCheerPage + 1, cardAndCheerPageCount)} / {cardAndCheerPageCount}
            </span>
            <button
              type="button"
              disabled={cardAndCheerPage >= cardAndCheerPageCount - 1}
              onClick={() => setCardAndCheerPage((page) => Math.min(page + 1, cardAndCheerPageCount - 1))}
            >
              下一頁
            </button>
          </div>
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
