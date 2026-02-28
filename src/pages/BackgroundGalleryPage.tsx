import { useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';

interface BackgroundGalleryPageProps {
  mode: 'FIELD' | 'CARD';
  busy: boolean;
  fieldBackgroundUrls: string[];
  cardAndCheerBackgroundUrls: string[];
  selectedFieldBackgroundUrl: string | null;
  selectedCardBackgroundUrl: string | null;
  selectedCheerBackgroundUrl: string | null;
  onAddFieldBackgroundUrl: (url: string) => Promise<void>;
  onAddCardAndCheerBackgroundUrl: (url: string) => Promise<void>;
  onSelectFieldBackgroundUrl: (url: string | null) => void;
  onSelectCardBackgroundUrl: (url: string | null) => void;
  onSelectCheerBackgroundUrl: (url: string | null) => void;
}

const FIELD_PAGE_SIZE = 12;
const CARD_AND_CHEER_PAGE_SIZE = 15;

export const BackgroundGalleryPage: FC<BackgroundGalleryPageProps> = ({
  mode,
  busy,
  fieldBackgroundUrls,
  cardAndCheerBackgroundUrls,
  selectedFieldBackgroundUrl,
  selectedCardBackgroundUrl,
  selectedCheerBackgroundUrl,
  onAddFieldBackgroundUrl,
  onAddCardAndCheerBackgroundUrl,
  onSelectFieldBackgroundUrl,
  onSelectCardBackgroundUrl,
  onSelectCheerBackgroundUrl,
}) => {
  const navigate = useNavigate();
  const [inputUrl, setInputUrl] = useState('');
  const [page, setPage] = useState(0);

  const isField = mode === 'FIELD';
  const urls = isField ? fieldBackgroundUrls : cardAndCheerBackgroundUrls;
  const pageSize = isField ? FIELD_PAGE_SIZE : CARD_AND_CHEER_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(urls.length / pageSize));
  const pagedUrls = useMemo(() => {
    const safePage = Math.min(page, Math.max(pageCount - 1, 0));
    const start = safePage * pageSize;
    return urls.slice(start, start + pageSize);
  }, [page, pageCount, pageSize, urls]);

  return (
    <section className="panel">
      <h2>{isField ? '場地背景管理' : '卡片 / エール 背景管理'}</h2>
      <div className="row">
        <button type="button" onClick={() => navigate('/lobby')}>
          回到 Lobby
        </button>
        {isField ? (
          <button type="button" disabled={busy} onClick={() => onSelectFieldBackgroundUrl(null)}>
            使用預設場地
          </button>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => onSelectCardBackgroundUrl(null)}>
              卡片使用預設
            </button>
            <button type="button" disabled={busy} onClick={() => onSelectCheerBackgroundUrl(null)}>
              エール使用預設
            </button>
          </>
        )}
      </div>

      <div className="row">
        <input
          value={inputUrl}
          onChange={(event) => setInputUrl(event.target.value)}
          placeholder={isField ? '輸入場地背景圖片 URL' : '輸入卡片或エール背景圖片 URL'}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (isField) {
              void onAddFieldBackgroundUrl(inputUrl);
            } else {
              void onAddCardAndCheerBackgroundUrl(inputUrl);
            }
            setInputUrl('');
          }}
        >
          新增圖片
        </button>
      </div>

      <div className={`lobby-bg-grid ${isField ? 'lobby-bg-grid--field' : 'lobby-bg-grid--card'}`}>
        {pagedUrls.map((url) => {
          if (isField) {
            const isSelected = selectedFieldBackgroundUrl === url;
            return (
              <button
                key={url}
                type="button"
                className={`lobby-bg-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectFieldBackgroundUrl(url)}
                title={url}
              >
                <span className="lobby-bg-item__preview" style={{ backgroundImage: `url(${url})` }} />
              </button>
            );
          }
          const isCardSelected = selectedCardBackgroundUrl === url;
          const isCheerSelected = selectedCheerBackgroundUrl === url;
          return (
            <div key={url} className={`lobby-bg-item lobby-bg-item--card ${isCardSelected || isCheerSelected ? 'is-selected' : ''}`}>
              <span className="lobby-bg-item__preview" style={{ backgroundImage: `url(${url})` }} />
              <div className="lobby-bg-item__actions">
                <button type="button" className={isCardSelected ? 'is-active' : ''} onClick={() => onSelectCardBackgroundUrl(url)}>
                  卡片
                </button>
                <button type="button" className={isCheerSelected ? 'is-active' : ''} onClick={() => onSelectCheerBackgroundUrl(url)}>
                  エール
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lobby-bg-pagination">
        <button type="button" disabled={page <= 0} onClick={() => setPage((value) => Math.max(value - 1, 0))}>
          上一頁
        </button>
        <span>
          {Math.min(page + 1, pageCount)} / {pageCount}
        </span>
        <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(value + 1, pageCount - 1))}>
          下一頁
        </button>
      </div>
    </section>
  );
};
