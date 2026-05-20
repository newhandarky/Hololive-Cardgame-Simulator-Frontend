# AGENTS.md

## 前端入口規範

此目錄是 React / TypeScript / Vite 前端 repository。代理人進入前端工作時，應把本檔視為第一入口，優先維持既有操作流程、API 契約一致性與響應式畫面品質。

## 溝通與工作節奏

- 回覆使用繁體中文，技術名詞、指令、檔案路徑可保留英文。
- commit 訊息使用繁體中文。
- 修改前先執行 `git status --short --branch`，確認目前工作區狀態。
- 不要回退使用者或其他工作中的變更。
- 一般前端工作以自動完成為預設；涉及公開 API 欄位、登入/LIFF、對戰狀態資料流或大量 UI 改版時，先說明影響面與驗證方式。
- 若做到一個適合 commit 的段落，回報時同時提供繁體中文 commit 訊息。

## 現有架構

- 路由與全域狀態入口主要在 `src/App.tsx`。
- API 呼叫與資料型別主要在 `src/services/api.ts`。
- 頁面元件位於 `src/pages/`。
- 對戰與大廳畫面位於 `src/components/screens/`。
- 對戰場地元件位於 `src/components/battlefield/`。
- 共用型別位於 `src/types/`。
- 全域樣式主要在 `src/App.css` 與 `src/index.css`。

新增功能時優先沿用上述結構；不要建立平行但重複責任的資料夾或 service。

## UI 設計規則

- 對戰、牌組、卡牌管理等功能頁應直接提供可操作介面，不新增不必要的 landing page。
- UI 變更需檢查桌機與手機寬度，避免文字重疊、溢出、按鈕擠壓或版面跳動。
- 優先沿用既有 component、CSS 命名與版面模式。
- 固定格式元素如場地格、卡片、工具列、按鈕列需有穩定尺寸或合理的 responsive constraints。
- 不要為了小變更引入新的 UI 套件；若確實需要新增套件，需說明必要性並同步更新 lockfile。

## API 契約同步

- API 欄位、請求 payload、回應格式或 WebSocket 狀態資料變更時，需同步檢查後端契約。
- 前端型別應與 `src/services/api.ts` 與 `src/types/` 保持一致。
- 避免使用 `any`；若資料來源暫時不確定，優先使用明確 interface 或 `unknown` 搭配檢查。
- 不要只改 UI 顯示而忽略錯誤狀態、loading 狀態與空資料狀態。

## 驗證矩陣

- 文件或註解變更：`git diff --check`
- lint：`npm run lint`
- build：`npm run build`
- 本機開發：`npm run dev`
- UI 或互動流程變更完成後，需啟動 dev server，並用瀏覽器檢查主要畫面。

回報時列出實際執行過的指令與結果；未執行的驗證需說明原因。

## Commit 規則

- 一個 commit 只包含一個清楚段落。
- 不要把後端變更提交到前端 repo。
- 建議訊息：
  - `前端：調整對戰房間操作介面`
  - `前端：修正卡牌列表響應式排版`
  - `前端：同步對戰狀態 API 型別`
  - `文件：完善前端代理人協作規範`
