# HOLOLIVE Card Game Frontend

目前此專案為前端本地開發介面，已可：
- mock 登入取得 JWT
- 呼叫受保護後端 API
- 建房 / 入房 / ready / start
- 透過 WebSocket 即時同步房間狀態

## 技術與套件（目前）
- React `19`
- TypeScript `5`
- Vite `7`
- Axios
- React Router（已安裝，後續可導入路由頁面）
- LINE LIFF SDK（已安裝，尚未啟用正式流程）

## 環境需求
- Node.js `20.19+`（或 `22.12+`）

> 若使用 Node 18，`npm run dev` 會失敗。

## 環境變數
建立 `.env`：
```env
VITE_API_BASE_URL=http://localhost:8090/api
VITE_LIFF_ID=YOUR_LIFF_ID
```

## 快速啟動（本地）
```bash
npm install
npm run dev
```

## 常用指令
```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## 本地測試流程（目前）
1. 先確認後端已啟動（`http://localhost:8090`）
2. 啟動前端 `npm run dev`
3. 開兩個瀏覽器視窗
4. 各自輸入不同 `Mock Line User ID` 並登入
5. 視窗 A 建房，視窗 B 以房號加入
6. 兩邊按 Ready，房主按 Start
7. 確認房間狀態有即時更新（WebSocket 狀態為 Connected）

## 與後端對接重點
- REST Base URL：`http://localhost:8090/api`
- WebSocket URL：`ws://localhost:8090/ws/matches/{matchId}`
- 保護路徑需 JWT：`/api/users/**`、`/api/matches/**`

## 當前進度
- 已完成：
  - API service 封裝
  - mock 登入與 token 儲存
  - Lobby MVP UI（本地連線測試）
- 尚未完成：
  - 正式 LIFF 登入
  - 對戰畫面與回合流程 UI
  - E2E 自動化測試
