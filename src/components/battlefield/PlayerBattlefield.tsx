import type { FC } from 'react';
import type { PlayerZoneState } from '../../services/api';
import { FieldZone } from './FieldZone';

interface PlayerBattlefieldProps {
  playerName: string;
  zoneState: PlayerZoneState | null;
  reversed?: boolean;
}

// 單一玩家場地：依官方示意配置 1~9 區塊
export const PlayerBattlefield: FC<PlayerBattlefieldProps> = ({ playerName, zoneState, reversed = false }) => {
  return (
    <section className={`player-field ${reversed ? 'player-field--reversed' : ''}`}>
      <header className="player-field__header">{playerName}</header>

      <div className="player-field__grid">
        <div className="player-field__left-column">
          <FieldZone id={9} variant="tall" count={zoneState?.lifeCount ?? 0} />
          <FieldZone id={8} count={zoneState?.cheerDeckCount ?? 0} />
        </div>

        <div className="player-field__center-column">
          <div className="player-field__top-row">
            <FieldZone id={3} count={zoneState?.collabCount ?? 0} />
            <FieldZone id={2} count={zoneState?.centerCount ?? 0} />
            <FieldZone id={1} count={zoneState?.oshiCount ?? 0} />
          </div>
          <FieldZone id={4} variant="stage" count={zoneState?.backCount ?? 0} />
        </div>

        <div className="player-field__right-column">
          <FieldZone id={7} count={zoneState?.holopowerCount ?? 0} />
          <FieldZone id={5} count={zoneState?.deckCount ?? 0} />
          <FieldZone id={6} count={zoneState?.archiveCount ?? 0} />
        </div>
      </div>
    </section>
  );
};
