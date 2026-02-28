import type { FC } from 'react';
import { ZONE_META, type ZoneId, type ZoneVariant } from '../../types/battlefield';
import type { ZoneCardInstance } from '../../services/api';

export interface ZoneCardVisualInfo {
  name: string;
  imageUrl?: string | null;
  defaultAttack?: number | null;
}

interface FieldZoneProps {
  id: ZoneId;
  variant?: ZoneVariant;
  count: number;
  cards?: ZoneCardInstance[];
  cardInfoById: Record<string, ZoneCardVisualInfo>;
  revealCards?: boolean;
  onZoneClick?: () => void;
  onCardClick?: (card: ZoneCardInstance) => void;
  labelText?: string;
  hideZoneLabel?: boolean;
}

const STACK_PREVIEW_ZONE_IDS = new Set<ZoneId>([5, 7, 8, 9]);

export const FieldZone: FC<FieldZoneProps> = ({
  id,
  variant = 'card',
  count,
  cards = [],
  cardInfoById,
  revealCards = false,
  onZoneClick,
  onCardClick,
  labelText,
  hideZoneLabel = false,
}) => {
  const meta = ZONE_META[id];
  const previewLimit = STACK_PREVIEW_ZONE_IDS.has(id) ? 1 : id === 4 ? 5 : 3;
  const previewCards = id === 6 ? cards.slice(-1) : cards.slice(0, previewLimit);

  return (
    <article
      className={`field-zone field-zone--${variant}${onZoneClick ? ' field-zone--clickable' : ''}`}
      onClick={() => onZoneClick?.()}
    >
      {!hideZoneLabel ? <span className="field-zone__label">{labelText ?? meta.title}</span> : null}

      <div className="field-zone__content">
        {previewCards.length > 0 ? (
          <div className="field-zone__cards">
            {previewCards.map((card) => {
              const info = cardInfoById[card.cardId];
              const cardName = info?.name ?? '卡片';
              const stackDepth = card.stackDepth ?? 1;
              const cheerCount = card.cheerCount ?? 0;
              const hpText =
                card.currentHp != null && card.maxHp != null ? `${card.currentHp}/${card.maxHp}` : null;
              const attackValue =
                card.currentAttack != null && card.currentAttack > 0
                  ? card.currentAttack
                  : info?.defaultAttack != null && info.defaultAttack > 0
                    ? info.defaultAttack
                    : null;
              const attackText = attackValue != null ? `${attackValue}` : null;
              const hasBattleStats = hpText != null || attackText != null;
              const content = (
                <>
                  {revealCards ? (
                    info?.imageUrl ? (
                      <img className="card-visual card-visual--front" src={info.imageUrl} alt={cardName} loading="lazy" />
                    ) : (
                      <div className="card-visual card-visual--placeholder">
                        <span>{cardName}</span>
                      </div>
                    )
                  ) : (
                    <div className={`card-visual ${id === 8 || id === 9 ? 'card-visual--cheer-back' : 'card-visual--back'}`}>
                      <span>HOLO</span>
                    </div>
                  )}
                  {revealCards && stackDepth > 1 ? (
                    <span className="field-zone__badge field-zone__badge--stack">疊放 {stackDepth}</span>
                  ) : null}
                  {revealCards && cheerCount > 0 ? (
                    <span className="field-zone__badge field-zone__badge--cheer">吶喊 {cheerCount}</span>
                  ) : null}
                  {revealCards && hasBattleStats ? (
                    <div className="field-zone__stats-overlay">
                      {hpText ? <p className="field-zone__card-stat-line">HP {hpText}</p> : null}
                      {attackText ? <p className="field-zone__card-stat-line">ATK {attackText}</p> : null}
                    </div>
                  ) : null}
                </>
              );

              if (onCardClick) {
                return (
                  <button
                    key={card.cardInstanceId}
                    type="button"
                    className="field-zone__card field-zone__card--clickable"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCardClick(card);
                    }}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <figure key={card.cardInstanceId} className="field-zone__card">
                  {content}
                </figure>
              );
            })}
          </div>
        ) : null}

        {previewCards.length === 0 && (id === 7 || id === 9) ? (
          <p className="field-zone__count-empty">X{count}</p>
        ) : null}
      </div>
    </article>
  );
};
