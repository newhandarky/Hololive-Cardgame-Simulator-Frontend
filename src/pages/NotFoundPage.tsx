import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';

// 路由兜底頁：避免錯誤網址造成白畫面
export const NotFoundPage: FC = () => {
  const navigate = useNavigate();

  return (
    <section className="panel">
      <h1>404 - 找不到頁面</h1>
      <p>你目前進入的網址不存在，請回到 Lobby。</p>
      <button type="button" onClick={() => navigate('/lobby')}>
        回到 Lobby
      </button>
    </section>
  );
};
