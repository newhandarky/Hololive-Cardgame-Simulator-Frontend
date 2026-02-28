import type { FC } from 'react';
import type { GameState, PlayerZoneState, ZoneCardInstance } from '../../services/api';
import { PlayerBattlefield } from './PlayerBattlefield';
import type { ZoneCardVisualInfo } from './FieldZone';

interface BattlefieldPanelProps {
  showBattlefield: boolean;
  myDisplayName: string;
  opponentDisplayName: string;
  currentUserId: number | null;
  gameState: GameState | null;
  cardInfoById: Record<string, ZoneCardVisualInfo>;
  onMyZoneClick?: (zoneId: number) => void;
  onMyZoneCardClick?: (zoneId: number, card: ZoneCardInstance) => void;
}

export const BattlefieldPanel: FC<BattlefieldPanelProps> = ({
  showBattlefield,
  myDisplayName,
  opponentDisplayName,
  currentUserId,
  gameState,
  cardInfoById,
  onMyZoneClick,
  onMyZoneCardClick,
}) => {
  const myState: PlayerZoneState | null = gameState?.players.find((player) => player.userId === currentUserId) ?? null;
  const opponentState: PlayerZoneState | null = gameState?.players.find(
    (player) => currentUserId != null && player.userId !== currentUserId,
  ) ?? null;

  return (
    <section className="panel battlefield-panel">
      <h2>Battle Field</h2>
      {showBattlefield ? (
        <div className="battlefield-scroll">
          <div className="battlefield-stack">
            <PlayerBattlefield
              playerName={`對手：${opponentDisplayName}`}
              reversed
              zoneState={opponentState}
              cardInfoById={cardInfoById}
              showZoneLabels={false}
              showHeader={true}
            />
            <PlayerBattlefield
              playerName={`我方：${myDisplayName}`}
              zoneState={myState}
              cardInfoById={cardInfoById}
              interactive
              onZoneClick={onMyZoneClick}
              onZoneCardClick={onMyZoneCardClick}
              showZoneLabels={true}
              showHeader={true}
              customBackgroundUrl={'var(--custom-battlefield-image)'}
            />
          </div>
        </div>
      ) : (
        <p>房間開始後（Status = STARTED）會顯示對戰場地。</p>
      )}
    </section>
  );
};
