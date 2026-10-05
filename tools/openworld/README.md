# Openworld（自由）

TypeScript、React 和 Supabase 自由画布，发布在 https://jiezhao2002.github.io/openworld/。

```sh
npm ci
npm run dev
npm test
npm run build:pages
```

构建输出在 `dist/`。个站根目录运行 `node scripts/build-site.mjs --sync-openworld`，将构建同步到 GitHub Pages 的 `openworld/`。

Supabase 连接使用可公开的 publishable key，数据所有权由 RLS 保证。`NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 可在本机 `.env.local` 覆盖；不要添加 service role key。Google/GitHub OAuth 凭据在 Supabase 管理后台填写，重定向白名单为 `https://jiezhao2002.github.io/openworld/`。

背景音乐需用户手动开启。播放器不会因关闭对话而停止；最近播放的曲目和进度保存在本机，刷新后手动继续。

绘画支持 50、100、150、200 像素的正方形画布和显示缩放。调整像素尺寸会按比例保留原图，未绘制的区域保持透明。形象和街景可以分别拖动定位；只有登录用户能移动自己的作品，位置由 Supabase 保存。

现有数据库升级请在 Supabase SQL Editor 执行 `supabase/migrations/20261005000200_canvas_positions.sql`，新增街景坐标并支持四种像素尺寸。新项目使用 `supabase/schema.sql`；已有作品和 RLS 所有权策略会保留。
