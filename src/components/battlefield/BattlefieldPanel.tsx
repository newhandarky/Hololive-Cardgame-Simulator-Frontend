import type { FC } from 'react';
import { ZONE_LEGEND, ZONE_META } from '../../types/battlefield';
import type { GameState, PlayerZoneState } from '../../services/api';
import { PlayerBattlefield } from './PlayerBattlefield';

interface BattlefieldPanelProps {
  showBattlefield: boolean;
  myDisplayName: string;
  opponentDisplayName: string;
  currentUserId: number | null;
  gameState: GameState | null;
}

// 對戰場地總面板：上方顯示對手（180 度反轉），下方顯示我方
export const BattlefieldPanel: FC<BattlefieldPanelProps> = ({
  showBattlefield,
  myDisplayName,
  opponentDisplayName,
  currentUserId,
  gameState,
}) => {
  const myState: PlayerZoneState | null = gameState?.players.find((player) => player.userId === currentUserId) ?? null;
  const opponentState: PlayerZoneState | null = gameState?.players.find(
    (player) => currentUserId != null && player.userId !== currentUserId,
  ) ?? null;

  return (
    <section className="panel battlefield-panel">
      <h2>Battle Field (Prototype)</h2>
      {showBattlefield ? (
        <>
          <div className="battlefield-scroll">
            <div className="battlefield-stack">
              <PlayerBattlefield playerName={`對手：${opponentDisplayName}`} reversed zoneState={opponentState} />
              <PlayerBattlefield playerName={`我方：${myDisplayName}`} zoneState={myState} />
            </div>
          </div>

          <p className="battlefield-summary">
            場地快照：Turn #{gameState?.turnNumber ?? '-'} / 目前行動玩家 #{gameState?.currentTurnPlayerId ?? '-'}
          </p>

          <ul className="zone-legend">
            {ZONE_LEGEND.map((zoneId) => (
              <li key={zoneId}>
                <strong>{zoneId}.</strong> {ZONE_META[zoneId].title} - {ZONE_META[zoneId].subtitle}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>房間開始後（Status = STARTED）會顯示對戰場地。</p>
      )}
    </section>
  );
};
