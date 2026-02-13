// 對戰場地編號與名稱定義（對照官方場地 1~9 區塊）
export const ZONE_LEGEND = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type ZoneId = (typeof ZONE_LEGEND)[number];

export type ZoneVariant = 'card' | 'tall' | 'stage';

export interface ZoneMeta {
  title: string;
  subtitle: string;
}

export const ZONE_META: Record<ZoneId, ZoneMeta> = {
  1: { title: '推しポジション', subtitle: '推し Holomen' },
  2: { title: 'センターポジション', subtitle: 'Center Holomen' },
  3: { title: 'コラボポジション', subtitle: 'Collab Holomen' },
  4: { title: 'バックポジション', subtitle: 'Stage / Back Holomen' },
  5: { title: 'デッキ', subtitle: 'Deck' },
  6: { title: 'アーカイブ', subtitle: 'Archive' },
  7: { title: 'ホロパワー', subtitle: 'Holopower' },
  8: { title: 'エールデッキ', subtitle: 'Yell Deck' },
  9: { title: 'ライフ', subtitle: 'Life' },
};
