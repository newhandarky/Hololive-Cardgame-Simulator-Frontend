import type { FC } from 'react';
import { ZONE_META, type ZoneId, type ZoneVariant } from '../../types/battlefield';
import type { ZoneCardInstance } from '../../services/api';

export interface ZoneCardVisualInfo {
  name: string;
  imageUrl?: string | null;
}

interface FieldZoneProps {
  id: ZoneId;
  variant?: ZoneVariant;
  count: number;
  cards?: ZoneCardInstance[];
  cardInfoById: Record<string, ZoneCardVisualInfo>;
  revealCards?: boolean;
}

const STACK_PREVIEW_ZONE_IDS = new Set<ZoneId>([5, 8, 9]);

// 單一場地區塊元件：顯示編號、區位名稱、張數與卡片視覺
export const FieldZone: FC<FieldZoneProps> = ({
  id,
  variant = 'card',
  count,
  cards = [],
  cardInfoById,
  revealCards = false,
}) => {
  const meta = ZONE_META[id];
  const previewLimit = STACK_PREVIEW_ZONE_IDS.has(id) ? 1 : id === 4 ? 5 : 3;
  const previewCards = id === 6 ? cards.slice(-1) : cards.slice(0, previewLimit);

  return (
    <article className={`field-zone field-zone--${variant}`}>
      <span className="field-zone__index">{id}</span>
      <div className="field-zone__content">
        <div className="field-zone__header">
          <p className="field-zone__title">{meta.title}</p>
          <p className="field-zone__count">目前張數：{count}</p>
        </div>

        {previewCards.length > 0 ? (
          <div className="field-zone__cards">
            {previewCards.map((card) => {
              const info = cardInfoById[card.cardId];
              const cardName = info?.name ?? '卡片';

              return (
                <figure key={card.cardInstanceId} className="field-zone__card">
                  {revealCards ? (
                    info?.imageUrl ? (
                      <img className="card-visual card-visual--front" src={info.imageUrl} alt={cardName} loading="lazy" />
                    ) : (
                      <div className="card-visual card-visual--placeholder">
                        <span>{cardName}</span>
                      </div>
                    )
                  ) : (
                    <div className="card-visual card-visual--back">
                      <span>HOLO</span>
                    </div>
                  )}
                  {revealCards ? <figcaption className="field-zone__card-name">{cardName}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
};
