import { Fragment, useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCards,
  getMyDeck,
  updateDeckCard,
  type CardSummary,
  type DeckCard,
} from '../services/api';

// 編輯卡牌頁：提供最小可用的卡片查詢與卡組數量編輯
export const DeckEditorPage: FC = () => {
  const navigate = useNavigate();

  const [cards, setCards] = useState<CardSummary[]>([]);
  const [deckMap, setDeckMap] = useState<Record<string, number>>({});
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDeckEditorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsData, deckData] = await Promise.all([
        getCards({ type: typeFilter || undefined, keyword: keyword || undefined }),
        getMyDeck(),
      ]);
      setCards(cardsData);

      const nextDeckMap: Record<string, number> = {};
      deckData.forEach((item: DeckCard) => {
        nextDeckMap[item.cardId] = item.count;
      });
      setDeckMap(nextDeckMap);
    } catch (err) {
      console.error(err);
      setError('載入卡組資料失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDeckEditorData();
    // keyword/typeFilter 改變時手動按搜尋，避免每打字都 request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalDeckCount = useMemo(() => {
    return Object.values(deckMap).reduce((sum, count) => sum + count, 0);
  }, [deckMap]);

  const handleChangeCount = (cardId: string, nextCount: number) => {
    const safeCount = Math.max(0, Math.min(4, nextCount));
    setDeckMap((prev) => ({ ...prev, [cardId]: safeCount }));
  };

  const handleSaveCardCount = async (cardId: string) => {
    const count = deckMap[cardId] ?? 0;
    setSavingCardId(cardId);
    setError(null);
    try {
      const saved = await updateDeckCard(cardId, count);
      setDeckMap((prev) => ({ ...prev, [saved.cardId]: saved.count }));
    } catch (err) {
      console.error(err);
      setError(`儲存 ${cardId} 失敗`);
    } finally {
      setSavingCardId(null);
    }
  };

  return (
    <section className="panel">
      <h1>Deck Editor</h1>
      <p>目前卡組總數：{totalDeckCount}</p>

      <div className="row">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜尋卡名（keyword）"
        />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">全部類型</option>
          <option value="OSHI">OSHI</option>
          <option value="MEMBER">MEMBER</option>
          <option value="SUPPORT">SUPPORT</option>
          <option value="CHEER">CHEER</option>
        </select>
        <button type="button" onClick={() => void loadDeckEditorData()} disabled={loading}>
          搜尋
        </button>
        <button type="button" onClick={() => navigate('/lobby')}>
          回到 Lobby
        </button>
      </div>

      {loading ? <p>載入中...</p> : null}

      <div className="deck-editor-table">
        <div className="deck-editor-header">Card ID</div>
        <div className="deck-editor-header">Name</div>
        <div className="deck-editor-header">Type</div>
        <div className="deck-editor-header">Count (0~4)</div>
        <div className="deck-editor-header">Action</div>

        {cards.map((card) => {
          const count = deckMap[card.cardId] ?? 0;
          const isSaving = savingCardId === card.cardId;

          return (
            <Fragment key={card.cardId}>
              <div key={`${card.cardId}-id`} className="deck-editor-cell mono">
                {card.cardId}
              </div>
              <div key={`${card.cardId}-name`} className="deck-editor-cell">
                {card.name}
              </div>
              <div key={`${card.cardId}-type`} className="deck-editor-cell">
                {card.cardType}
              </div>
              <div key={`${card.cardId}-count`} className="deck-editor-cell">
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={count}
                  onChange={(event) => handleChangeCount(card.cardId, Number(event.target.value))}
                />
              </div>
              <div key={`${card.cardId}-action`} className="deck-editor-cell">
                <button type="button" onClick={() => void handleSaveCardCount(card.cardId)} disabled={isSaving}>
                  {isSaving ? '儲存中...' : '儲存'}
                </button>
              </div>
            </Fragment>
          );
        })}
      </div>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
};
