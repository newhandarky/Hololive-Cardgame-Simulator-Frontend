import { useMemo, type CSSProperties, type FC } from 'react';
import type { PlayerZoneState, ZoneCardInstance } from '../../services/api';
import { BOARD_SLOT_TO_ZONE } from '../../types/battlefield';
import { FieldZone, type ZoneCardVisualInfo } from './FieldZone';

interface PlayerBattlefieldProps {
  playerName: string;
  zoneState: PlayerZoneState | null;
  reversed?: boolean;
  cardInfoById: Record<string, ZoneCardVisualInfo>;
  interactive?: boolean;
  onZoneClick?: (zoneId: number) => void;
  onZoneCardClick?: (zoneId: number, card: ZoneCardInstance) => void;
  showZoneLabels?: boolean;
  showHeader?: boolean;
  customBackgroundUrl?: string | null;
}

const FACE_DOWN_SLOT_IDS = new Set<number>([5, 7, 8, 9]);

export const PlayerBattlefield: FC<PlayerBattlefieldProps> = ({
  playerName,
  zoneState,
  reversed = false,
  cardInfoById,
  interactive = false,
  onZoneClick,
  onZoneCardClick,
  showZoneLabels = true,
  showHeader = true,
  customBackgroundUrl,
}) => {
  const boardZoneMap = useMemo(() => {
    const mapping = new Map<string, PlayerZoneState['boardZones'][number]>();
    for (const zone of zoneState?.boardZones ?? []) {
      mapping.set(zone.zone, zone);
    }
    return mapping;
  }, [zoneState?.boardZones]);

  const zoneCount = (slotId: keyof typeof BOARD_SLOT_TO_ZONE, fallback: number): number => {
    const zoneKey = BOARD_SLOT_TO_ZONE[slotId];
    const cards = boardZoneMap.get(zoneKey)?.cards ?? [];
    return cards.length > 0 ? cards.length : fallback;
  };

  const zoneCards = (slotId: keyof typeof BOARD_SLOT_TO_ZONE) => {
    const zoneKey = BOARD_SLOT_TO_ZONE[slotId];
    return boardZoneMap.get(zoneKey)?.cards ?? [];
  };
  const revealCards = (slotId: keyof typeof BOARD_SLOT_TO_ZONE): boolean => !FACE_DOWN_SLOT_IDS.has(slotId);
  const resolveZoneClick = (slotId: keyof typeof BOARD_SLOT_TO_ZONE) => {
    if (!interactive) {
      return undefined;
    }
    if (slotId !== 5 && slotId !== 8) {
      return undefined;
    }
    return () => onZoneClick?.(slotId);
  };
  const resolveCardClick = (slotId: keyof typeof BOARD_SLOT_TO_ZONE) => {
    if (!interactive || slotId !== 4) {
      return undefined;
    }
    return (card: ZoneCardInstance) => onZoneCardClick?.(slotId, card);
  };

  const zoneLabel = (slotId: number): string => {
    if (slotId === 7) {
      return `ホロパワー X${zoneCount(7, zoneState?.holopowerCount ?? 0)}`;
    }
    if (slotId === 9) {
      return `ライフ X${zoneCount(9, zoneState?.lifeCount ?? 0)}`;
    }
    return '';
  };

  const style = useMemo<CSSProperties | undefined>(() => {
    if (!customBackgroundUrl) {
      return undefined;
    }
    return {
      backgroundImage: customBackgroundUrl.startsWith('var(') ? customBackgroundUrl : `url(${customBackgroundUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
  }, [customBackgroundUrl]);

  return (
    <section className={`player-field ${reversed ? 'player-field--reversed' : ''}`} style={style}>
      {showHeader ? <header className="player-field__header">{playerName}</header> : null}

      <div className="player-field__grid">
        <div className="player-field__left-column">
          <FieldZone
            id={9}
            variant="tall"
            count={zoneCount(9, zoneState?.lifeCount ?? 0)}
            cards={zoneCards(9)}
            cardInfoById={cardInfoById}
            revealCards={revealCards(9)}
            onZoneClick={resolveZoneClick(9)}
            onCardClick={resolveCardClick(9)}
            labelText={zoneLabel(9)}
            hideZoneLabel={!showZoneLabels && zoneCount(9, zoneState?.lifeCount ?? 0) <= 0}
          />
          <FieldZone
            id={8}
            count={zoneCount(8, zoneState?.cheerDeckCount ?? 0)}
            cards={zoneCards(8)}
            cardInfoById={cardInfoById}
            revealCards={revealCards(8)}
            onZoneClick={resolveZoneClick(8)}
            onCardClick={resolveCardClick(8)}
            hideZoneLabel={!showZoneLabels}
          />
        </div>

        <div className="player-field__center-column">
          <div className="player-field__top-row">
            <FieldZone
              id={3}
              count={zoneCount(3, zoneState?.collabCount ?? 0)}
              cards={zoneCards(3)}
              cardInfoById={cardInfoById}
              revealCards={revealCards(3)}
              onZoneClick={resolveZoneClick(3)}
              onCardClick={resolveCardClick(3)}
              hideZoneLabel={!showZoneLabels}
            />
            <FieldZone
              id={2}
              count={zoneCount(2, zoneState?.centerCount ?? 0)}
              cards={zoneCards(2)}
              cardInfoById={cardInfoById}
              revealCards={revealCards(2)}
              onZoneClick={resolveZoneClick(2)}
              onCardClick={resolveCardClick(2)}
              hideZoneLabel={!showZoneLabels}
            />
            <FieldZone
              id={1}
              count={zoneCount(1, zoneState?.oshiCount ?? 0)}
              cards={zoneCards(1)}
              cardInfoById={cardInfoById}
              revealCards={revealCards(1)}
              onZoneClick={resolveZoneClick(1)}
              onCardClick={resolveCardClick(1)}
              hideZoneLabel={!showZoneLabels}
            />
          </div>
          <FieldZone
            id={4}
            variant="stage"
            count={zoneCount(4, zoneState?.backCount ?? 0)}
            cards={zoneCards(4)}
            cardInfoById={cardInfoById}
            revealCards={revealCards(4)}
            onZoneClick={resolveZoneClick(4)}
            onCardClick={resolveCardClick(4)}
            hideZoneLabel={!showZoneLabels}
          />
        </div>

        <div className="player-field__right-column">
          <FieldZone
            id={7}
            count={zoneCount(7, zoneState?.holopowerCount ?? 0)}
            cards={zoneCards(7)}
            cardInfoById={cardInfoById}
            revealCards={revealCards(7)}
            onZoneClick={resolveZoneClick(7)}
            onCardClick={resolveCardClick(7)}
            labelText={zoneLabel(7)}
            hideZoneLabel={!showZoneLabels && zoneCount(7, zoneState?.holopowerCount ?? 0) <= 0}
          />
          <FieldZone
            id={5}
            count={zoneCount(5, zoneState?.deckCount ?? 0)}
            cards={zoneCards(5)}
            cardInfoById={cardInfoById}
            revealCards={revealCards(5)}
            onZoneClick={resolveZoneClick(5)}
            onCardClick={resolveCardClick(5)}
            hideZoneLabel={!showZoneLabels}
          />
          <FieldZone
            id={6}
            count={zoneCount(6, zoneState?.archiveCount ?? 0)}
            cards={zoneCards(6)}
            cardInfoById={cardInfoById}
            revealCards={revealCards(6)}
            onZoneClick={resolveZoneClick(6)}
            onCardClick={resolveCardClick(6)}
            hideZoneLabel={!showZoneLabels}
          />
        </div>
      </div>
    </section>
  );
};
