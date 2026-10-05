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
