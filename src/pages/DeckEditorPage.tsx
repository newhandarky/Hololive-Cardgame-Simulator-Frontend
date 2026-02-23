import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  activateMyDeck,
  createMyDeck,
  getCardDetail,
  getCardTags,
  getCards,
  getMyDeckDetail,
  getMyDeckList,
  updateDeckCardInDeck,
  validateMyDeck,
  type CardDetail,
  type CardSearchParams,
  type CardSummary,
  type DeckCard,
  type DeckSummary,
  type DeckValidation,
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

const clampCount = (count: number, cardType: string): number => {
  const safe = Number.isFinite(count) ? count : 0;
  const max = cardType === 'OSHI' ? 1 : cardType === 'CHEER' ? 20 : 4;
  return Math.max(0, Math.min(max, safe));
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

const toDisplayEntries = (raw?: string): Array<{ key: string; value: string }> => {
  if (!raw) return [];
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return [{ key: '內容', value: raw }];
  }
  return Object.entries(parsed).map(([key, value]) => ({ key, value: formatJsonValue(value) }));
};

// 編輯卡牌頁：使用卡片查詢式介面，直接在卡片下方用按鈕調整張數
export const DeckEditorPage: FC = () => {
  const navigate = useNavigate();

  const [cards, setCards] = useState<CardSummary[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [form, setForm] = useState<SearchFormState>(initialSearchForm);

  const [deckSummaries, setDeckSummaries] = useState<DeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [deckMap, setDeckMap] = useState<Record<string, number>>({});
  const [validation, setValidation] = useState<DeckValidation | null>(null);

  const [newDeckName, setNewDeckName] = useState('');
  const [loading, setLoading] = useState(false);
  const [deckActionBusy, setDeckActionBusy] = useState(false);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDeck = useMemo(() => {
    if (selectedDeckId == null) return null;
    return deckSummaries.find((deck) => deck.id === selectedDeckId) ?? null;
  }, [deckSummaries, selectedDeckId]);

  const loadDeckSummaries = async () => {
    const summaries = await getMyDeckList();
    setDeckSummaries(summaries);

    if (summaries.length === 0) {
      setSelectedDeckId(null);
      return;
    }

    setSelectedDeckId((previousDeckId) => {
      if (previousDeckId && summaries.some((deck) => deck.id === previousDeckId)) {
        return previousDeckId;
      }
      const activeDeck = summaries.find((deck) => deck.active);
      return activeDeck?.id ?? summaries[0].id;
    });
  };

  const loadCards = async () => {
    const data = await getCards({
      keyword: form.keyword || undefined,
      type: form.type || undefined,
      rarity: form.rarity || undefined,
      color: form.color || undefined,
      levelType: form.levelType || undefined,
      expansionCode: form.expansionCode || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      hasImage: form.hasImage,
      sort: form.sort,
    });
    setCards(data);
  };

  const loadSelectedDeckDetail = async (deckId: number) => {
    const [detail, nextValidation] = await Promise.all([getMyDeckDetail(deckId), validateMyDeck(deckId)]);

    const nextDeckMap: Record<string, number> = {};
    detail.cards.forEach((item: DeckCard) => {
      nextDeckMap[item.cardId] = item.count;
    });

    setDeckMap(nextDeckMap);
    setValidation(nextValidation);
  };

  const loadDeckEditorData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [tags] = await Promise.all([getCardTags().catch(() => [])]);
      setAvailableTags(tags);
      await Promise.all([loadCards(), loadDeckSummaries()]);
    } catch (err) {
      console.error(err);
      setError('載入牌組資料失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDeckEditorData();
    // 初次進入時初始化資料
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDeckId == null) {
      setDeckMap({});
      setValidation(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        await loadSelectedDeckDetail(selectedDeckId);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('載入指定牌組失敗');
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedDeckId]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  // DeckEditor 也可開啟卡片詳細資料，避免來回切頁
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

  // 卡片按鈕直接套用張數並送出，避免文字輸入流程
  const applyDeckCount = async (card: CardSummary, nextCount: number) => {
    if (selectedDeckId == null) {
      setError('請先選擇牌組');
      return;
    }

    const safeCount = clampCount(nextCount, card.cardType);
    setSavingCardId(card.cardId);
    setError(null);

    try {
      const saved = await updateDeckCardInDeck(selectedDeckId, card.cardId, safeCount);
      setDeckMap((prev) => ({ ...prev, [saved.cardId]: saved.count }));

      const [nextValidation] = await Promise.all([validateMyDeck(selectedDeckId), loadDeckSummaries()]);
      setValidation(nextValidation);
    } catch (err) {
      console.error(err);
      setError(`儲存 ${card.cardId} 失敗`);
    } finally {
      setSavingCardId(null);
    }
  };

  const handleCreateDeck = async () => {
    const normalizedName = newDeckName.trim();
    if (!normalizedName) {
      setError('請輸入新牌組名稱');
      return;
    }

    setDeckActionBusy(true);
    setError(null);

    try {
      const createdDeck = await createMyDeck(normalizedName);
      setNewDeckName('');
      await loadDeckSummaries();
      setSelectedDeckId(createdDeck.id);
    } catch (err) {
      console.error(err);
      setError('建立牌組失敗');
    } finally {
      setDeckActionBusy(false);
    }
  };

  const handleActivateDeck = async () => {
    if (!selectedDeck || selectedDeck.active) {
      return;
    }

    setDeckActionBusy(true);
    setError(null);

    try {
      await activateMyDeck(selectedDeck.id);
      await loadDeckSummaries();
    } catch (err) {
      console.error(err);
      setError('切換啟用牌組失敗');
    } finally {
      setDeckActionBusy(false);
    }
  };

  const handleValidateDeck = async () => {
    if (selectedDeckId == null) {
      setError('請先選擇牌組');
      return;
    }

    setDeckActionBusy(true);
    setError(null);

    try {
      const result = await validateMyDeck(selectedDeckId);
      setValidation(result);
      await loadDeckSummaries();
    } catch (err) {
      console.error(err);
      setError('牌組驗證失敗');
    } finally {
      setDeckActionBusy(false);
    }
  };

  return (
    <section className="card-catalog deck-editor-catalog">
      <header className="card-catalog__hero">
        <p className="card-catalog__breadcrumb">TOP / 牌組編輯 / 卡片選擇</p>
        <h1>DECK EDITOR</h1>
        <p className="card-catalog__subtitle">用卡片介面直接調整張數</p>
      </header>

      <section className="card-catalog__filter panel">
        <div className="screen-header">
          <h2>牌組設定</h2>
          <div className="screen-header__actions">
            <button type="button" onClick={() => void handleValidateDeck()} disabled={deckActionBusy || !selectedDeck}>
              驗證牌組
            </button>
            <button type="button" onClick={() => navigate('/lobby')}>
              回到 Lobby
            </button>
          </div>
        </div>

        <div className="row">
          <select
            value={selectedDeckId ?? ''}
            onChange={(event) => setSelectedDeckId(event.target.value ? Number(event.target.value) : null)}
          >
            {deckSummaries.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}（{deck.totalCards} 張{deck.active ? ' / 啟用中' : ''}）
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleActivateDeck()}
            disabled={deckActionBusy || !selectedDeck || selectedDeck.active}
          >
            設為啟用牌組
          </button>
          <input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)} placeholder="新牌組名稱" />
          <button type="button" onClick={() => void handleCreateDeck()} disabled={deckActionBusy}>
            建立新牌組
          </button>
        </div>

        <p>
          目前牌組：<strong>{selectedDeck?.name ?? '未選擇'}</strong>
          {selectedDeck?.active ? '（啟用中）' : ''} / 主牌庫：{validation?.mainDeckCount ?? '-'} / 50 / エール：
          {validation?.cheerDeckCount ?? '-'} / 20 / 推し：{validation?.oshiCount ?? '-'} / 1
        </p>

        {validation ? (
          <div className={`deck-validation-box ${validation.valid ? 'deck-validation-box--ok' : 'deck-validation-box--error'}`}>
            <p>
              驗證結果：{validation.valid ? '可開戰' : '不可開戰'} ｜ 推し {validation.oshiCount}/1 / 主牌庫{' '}
              {validation.mainDeckCount}/50 / エール {validation.cheerDeckCount}/20
            </p>
            {!validation.valid ? (
              <ul className="deck-validation-errors">
                {validation.errors.map((item) => (
                  <li key={`${item.code}-${item.message}`}>{item.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card-catalog__filter panel">
        <div className="screen-header">
          <h2>卡片搜尋</h2>
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
          </p>
        </div>

        {loading ? <p>載入中...</p> : null}

        <div className="card-catalog__grid">
          {cards.map((card) => {
            const count = deckMap[card.cardId] ?? 0;
            const max = card.cardType === 'OSHI' ? 1 : card.cardType === 'CHEER' ? 20 : 4;
            const quickPresets =
              card.cardType === 'OSHI'
                ? [0, 1]
                : card.cardType === 'CHEER'
                  ? [0, 5, 10, 15, 20]
                  : [0, 1, 2, 3, 4];
            const isSaving = savingCardId === card.cardId;

            return (
              <article key={card.cardId} className="card-catalog__card deck-editor-card">
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
                  <p className="deck-editor-card__count">目前張數：{count}</p>
                </div>

                <div className="deck-editor-card__controls">
                  <button type="button" className="deck-editor-card__detail" onClick={() => void loadCardDetail(card.cardId)}>
                    查看詳情
                  </button>

                  <div className="deck-editor-card__quick">
                    {quickPresets.map((preset) => (
                      <button
                        key={`${card.cardId}-${preset}`}
                        type="button"
                        className={count === preset ? 'is-active' : ''}
                        onClick={() => void applyDeckCount(card, preset)}
                        disabled={isSaving || preset > max}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {card.cardType === 'OSHI' ? (
                    <span className="deck-editor-card__max">推し卡僅可設定 0 或 1 張</span>
                  ) : (
                    <div className="deck-editor-card__stepper">
                      <button
                        type="button"
                        onClick={() => void applyDeckCount(card, count - 5)}
                        disabled={isSaving || count <= 0}
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyDeckCount(card, count - 1)}
                        disabled={isSaving || count <= 0}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyDeckCount(card, count + 1)}
                        disabled={isSaving || count >= max}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyDeckCount(card, count + 5)}
                        disabled={isSaving || count >= max}
                      >
                        +5
                      </button>
                      <span className="deck-editor-card__max">上限 {max}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

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
                          {skill.effectJson ? (
                            <div className="card-detail-modal__kv-list">
                              {toDisplayEntries(skill.effectJson).map((entry) => (
                                <p key={`${skill.skillType}-${skill.skillName}-${entry.key}`}>
                                  <strong>{entry.key}：</strong>
                                  {entry.value}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : null}

                  {detail.memberArts.length > 0 ? (
                    <div className="card-detail-modal__block">
                      <h3>アーツ</h3>
                      {detail.memberArts.map((art) => (
                        <article key={`${art.orderIndex}-${art.name}`} className="card-detail-modal__item">
                          <p>
                            <strong>#{art.orderIndex}</strong> {art.name}
                          </p>
                          {art.description ? <p>{art.description}</p> : null}
                          {art.effectJson ? (
                            <div className="card-detail-modal__kv-list">
                              {toDisplayEntries(art.effectJson).map((entry) => (
                                <p key={`${art.orderIndex}-${art.name}-${entry.key}`}>
                                  <strong>{entry.key}：</strong>
                                  {entry.value}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
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
