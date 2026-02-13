import type { FC } from 'react';
import { BattlefieldPanel } from '../battlefield/BattlefieldPanel';
import type { GameState, LobbyMatch } from '../../services/api';

interface GameRoomScreenProps {
  currentMatch: LobbyMatch;
  currentGameState: GameState | null;
  wsStatus: string;
  myDisplayName: string;
  opponentDisplayName: string;
  currentUserId: number | null;
  busy: boolean;
  onEndTurn: () => Promise<void>;
  onBackToLobby: () => void;
}

// GameRoom 畫面：進入對戰後只聚焦對戰資訊與場地顯示
export const GameRoomScreen: FC<GameRoomScreenProps> = ({
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
  const isMyTurn = currentUserId != null && currentMatch.currentTurnPlayerId === currentUserId;

  return (
    <>
      <div className="screen-header">
        <div>
          <h1>Game Room</h1>
          <p>
            Match #{currentMatch.matchId} / Room: <strong>{currentMatch.roomCode}</strong> / Status:{' '}
            <strong>{currentMatch.status}</strong>
          </p>
          <p>
            Turn #{currentMatch.turnNumber} / Current Player: #{currentMatch.currentTurnPlayerId ?? '-'}
          </p>
          <p>WebSocket: {wsStatus}</p>
        </div>

        <div className="screen-header__actions">
          <button type="button" onClick={() => void onEndTurn()} disabled={busy || !isMyTurn}>
            End Turn
          </button>
          <button type="button" onClick={onBackToLobby}>
            回到 Lobby
          </button>
        </div>
      </div>

      <BattlefieldPanel
        showBattlefield={true}
        myDisplayName={myDisplayName}
        opponentDisplayName={opponentDisplayName}
        currentUserId={currentUserId}
        gameState={currentGameState}
      />
    </>
  );
};
