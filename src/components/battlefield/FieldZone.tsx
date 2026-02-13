import type { FC } from 'react';
import { ZONE_META, type ZoneId, type ZoneVariant } from '../../types/battlefield';

interface FieldZoneProps {
  id: ZoneId;
  variant?: ZoneVariant;
  count: number;
}

// 單一場地區塊元件：顯示編號、日文名稱與輔助說明
export const FieldZone: FC<FieldZoneProps> = ({ id, variant = 'card', count }) => {
  const meta = ZONE_META[id];

  return (
    <article className={`field-zone field-zone--${variant}`}>
      <span className="field-zone__index">{id}</span>
      <div className="field-zone__content">
        <p className="field-zone__title">{meta.title}</p>
        <p className="field-zone__subtitle">{meta.subtitle}</p>
        <p className="field-zone__count">目前張數：{count}</p>
      </div>
    </article>
  );
};
