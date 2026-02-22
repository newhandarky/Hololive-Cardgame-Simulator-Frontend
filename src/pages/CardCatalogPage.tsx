import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCardDetail,
  getCards,
  getCardTags,
  type CardDetail,
  type CardSearchParams,
  type CardSummary,
} from '../services/api';

const CARD_TYPES = ['OSHI', 'MEMBER', 'SUPPORT', 'CHEER'] as const;
const COLOR_OPTIONS = ['WHITE', 'GREEN', 'RED', 'BLUE', 'YELLOW', 'PURPLE', 'COLORLESS'] as const;
const LEVEL_OPTIONS = ['DEBUT', 'FIRST', 'SECOND', 'SPOT', 'BUZZ'] as const;

interface SearchFormState {
  keyword: string;
  type: string;
  rarity: string;
  color: string;
  levelType: string;
  expansionCode: string;
  hasImage: boolean;
  sort: CardSearchParams['sort'];
}

const initialSearchForm: SearchFormState = {
  keyword: '',
  type: '',
  rarity: '',
  color: '',
  levelType: '',
  expansionCode: '',
  hasImage: true,
  sort: 'cardNo',
};

const parseJsonObject = (raw?: string): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const formatJsonValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => formatJsonValue(item)).join(' / ');
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.map(([key, item]) => `${key}:${formatJsonValue(item)}`).join(', ');
  }
  return String(value);
};

// 將 JSON 欄位轉成可讀的「鍵值清單」，避免直接顯示原始 JSON 字串
const toDisplayEntries = (raw?: string): Array<{ key: string; value: string }> => {
  if (!raw) return [];
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return [{ key: '內容', value: raw }];
  }
  return Object.entries(parsed).map(([key, value]) => ({ key, value: formatJsonValue(value) }));
};

const parseCheerCost = (raw?: string): Array<{ color: string; count: number }> => {
  const parsed = parseJsonObject(raw);
  if (!parsed) return [];
  return Object.entries(parsed)
    .map(([color, count]) => ({ color, count: Number(count) }))
    .filter((item) => Number.isFinite(item.count) && item.count > 0);
};

// 卡片查詢頁：使用「官方卡表風格」的搜尋區 + 圖片卡片牆 + 詳細資料抽屜
export const CardCatalogPage: FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<SearchFormState>(initialSearchForm);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const hasActiveFilter = useMemo(() => {
    return (
      !!form.keyword.trim() ||
      !!form.type ||
      !!form.rarity.trim() ||
      !!form.color ||
      !!form.levelType ||
      !!form.expansionCode.trim() ||
      selectedTags.length > 0 ||
      !form.hasImage
    );
  }, [form, selectedTags]);

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: CardSearchParams = {
        keyword: form.keyword || undefined,
        type: form.type || undefined,
        rarity: form.rarity || undefined,
        color: form.color || undefined,
        levelType: form.levelType || undefined,
        expansionCode: form.expansionCode || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        hasImage: form.hasImage,
        sort: form.sort,
      };
      const data = await getCards(params);
      setCards(data);
    } catch (err) {
      console.error(err);
      setError('卡片查詢失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const loadCardDetail = async (cardId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const data = await getCardDetail(cardId);
      setDetail(data);
    } catch (err) {
      console.error(err);
      setError(`載入卡片 ${cardId} 詳細資料失敗。`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [tags, list] = await Promise.all([
          getCardTags().catch(() => []),
          getCards({ hasImage: true, sort: 'cardNo' }),
        ]);
        setAvailableTags(tags);
        setCards(list);
      } catch (err) {
        console.error(err);
        setError('初始化卡片列表失敗。');
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  return (
    <section className="card-catalog">
      <header className="card-catalog__hero">
        <p className="card-catalog__breadcrumb">TOP / 卡片列表 / 搜尋結果</p>
        <h1>CARDLIST</h1>
        <p className="card-catalog__subtitle">卡片查詢</p>
      </header>

      <section className="card-catalog__filter panel">
        <div className="screen-header">
          <h2>搜尋條件</h2>
          <div className="screen-header__actions">
            <button type="button" onClick={() => void loadCards()} disabled={loading}>
              {loading ? '搜尋中...' : '套用條件'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(initialSearchForm);
                setSelectedTags([]);
              }}
            >
              清空條件
            </button>
            <button type="button" onClick={() => navigate('/lobby')}>
              回到 Lobby
            </button>
          </div>
        </div>

        <div className="card-catalog__form-grid">
          <input
            value={form.keyword}
            onChange={(event) => setForm((prev) => ({ ...prev, keyword: event.target.value }))}
            placeholder="搜尋卡名 / 卡號"
          />
          <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
            <option value="">全部類型</option>
            {CARD_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            value={form.rarity}
            onChange={(event) => setForm((prev) => ({ ...prev, rarity: event.target.value.toUpperCase() }))}
            placeholder="稀有度（如 OSR / RR）"
          />
          <input
            value={form.expansionCode}
            onChange={(event) => setForm((prev) => ({ ...prev, expansionCode: event.target.value.toUpperCase() }))}
            placeholder="收錄商品代碼（如 HSD13）"
          />
          <select value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}>
            <option value="">全部顏色</option>
            {COLOR_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={form.levelType}
            onChange={(event) => setForm((prev) => ({ ...prev, levelType: event.target.value }))}
          >
            <option value="">全部 Bloom</option>
            {LEVEL_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={form.sort}
            onChange={(event) => setForm((prev) => ({ ...prev, sort: event.target.value as SearchFormState['sort'] }))}
          >
            <option value="cardNo">卡號排序</option>
            <option value="newest">建立時間新到舊</option>
            <option value="rarity">稀有度排序</option>
            <option value="name">名稱排序</option>
            <option value="cardId">Card ID 排序</option>
          </select>
          <label className="card-catalog__checkbox">
            <input
              type="checkbox"
              checked={form.hasImage}
              onChange={(event) => setForm((prev) => ({ ...prev, hasImage: event.target.checked }))}
            />
            <span>只看有圖片卡片</span>
          </label>
        </div>

        <div className="card-catalog__tags">
          <span className="card-catalog__tag-label">Tag 條件：</span>
          {availableTags.length === 0 ? <span className="card-catalog__tag-empty">目前無可用 Tag</span> : null}
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`card-catalog__tag-chip ${selectedTags.includes(tag) ? 'is-active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      <section className="panel card-catalog__result">
        <div className="card-catalog__result-header">
          <h2>卡片列表</h2>
          <p>
            搜尋結果 <strong>{cards.length}</strong> 件
            {hasActiveFilter ? '（已套用條件）' : ''}
          </p>
        </div>

        {loading ? <p>載入中...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="card-catalog__grid">
          {cards.map((card) => (
            <button
              key={card.cardId}
              type="button"
              className="card-catalog__card"
              onClick={() => void loadCardDetail(card.cardId)}
            >
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.name} loading="lazy" />
              ) : (
                <div className="card-catalog__card-placeholder">
                  <strong>{card.name}</strong>
                  <span>{card.cardId}</span>
                </div>
              )}
              <div className="card-catalog__card-meta">
                <p className="mono">{card.cardId}</p>
                <p>{card.name}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {detail ? (
        <section className="card-detail-modal" role="dialog" aria-modal="true">
          <div className="card-detail-modal__backdrop" onClick={() => setDetail(null)} />
          <div className="card-detail-modal__panel">
            <button type="button" className="card-detail-modal__close" onClick={() => setDetail(null)}>
              關閉
            </button>
            {loadingDetail ? <p>讀取詳細資料中...</p> : null}
            {!loadingDetail ? (
              <div className="card-detail-modal__layout">
                <div className="card-detail-modal__image">
                  {detail.imageUrl ? <img src={detail.imageUrl} alt={detail.name} /> : <p>無圖片</p>}
                </div>
                <div className="card-detail-modal__content">
                  <h2>{detail.name}</h2>
                  <p className="mono">{detail.cardNo || detail.cardId}</p>
                  <p>
                    {detail.cardType} / {detail.rarity || '-'} / {detail.expansionCode || '-'}
                  </p>
                  <p>顏色：{detail.mainColor || detail.cheerColor || '-'}</p>
                  {detail.levelType ? <p>Bloom：{detail.levelType}</p> : null}
                  {detail.hp ? <p>HP：{detail.hp}</p> : null}
                  {detail.life ? <p>LIFE：{detail.life}</p> : null}
                  {detail.tags.length > 0 ? <p>Tags：{detail.tags.join(' ')}</p> : null}

                  {detail.oshiSkills.length > 0 ? (
                    <div className="card-detail-modal__block">
                      <h3>推し技能</h3>
                      {detail.oshiSkills.map((skill) => (
                        <article key={`${skill.skillType}-${skill.skillName}`} className="card-detail-modal__item">
                          <p>
                            <strong>{skill.skillType}</strong> / Cost: {skill.holopowerCost ?? 0}
                          </p>
                          <p>{skill.skillName}</p>
                          <p>{skill.description}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}

                  {detail.memberArts.length > 0 ? (
                    <div className="card-detail-modal__block">
                      <h3>アーツ</h3>
                      {detail.memberArts.map((art) => {
                        const costList = parseCheerCost(art.costCheerJson);
                        return (
                          <article key={`${art.orderIndex}-${art.name}`} className="card-detail-modal__item">
                            <p>
                              <strong>#{art.orderIndex}</strong> {art.name}
                            </p>
                            {art.description ? <p>{art.description}</p> : null}
                            {costList.length > 0 ? (
                              <div className="card-detail-modal__cost-list">
                                <span className="card-detail-modal__cost-label">費用</span>
                                {costList.map((cost) => (
                                  <span
                                    key={`${art.orderIndex}-${art.name}-${cost.color}`}
                                    className="card-detail-modal__cost-chip"
                                  >
                                    {cost.color} × {cost.count}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : null}

                  {detail.passiveEffectJson ? (
                    <div className="card-detail-modal__block">
                      <h3>被動 / 關鍵字</h3>
                      <div className="card-detail-modal__kv-list">
                        {toDisplayEntries(detail.passiveEffectJson).map((entry) => (
                          <p key={`${detail.cardId}-${entry.key}`}>
                            <strong>{entry.key}：</strong>
                            {entry.value}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
};
