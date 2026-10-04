# Jie's Site

The current live site is published by GitHub Pages from the root of the `master` branch. The Validate Site workflow checks navigation, builds a public-only output, and tests Tree; it does not change the site's existing publishing mode.

## Tree

Tree appears under Experiments and opens at `/tree/`. The story can be added later in `blog/experiments/tree.md`. App source is in `tools/tree/`; `tree/` contains the committed production build used by GitHub Pages.

```bash
npm --prefix tools/tree ci
# After changing app source or its public API address:
npm run publish:tree
npm test
```

Commit the updated source, `tree/`, and blog index, then push to `master`. Keep the generated assets together with `tree/index.html`. Visitors use the Cloudflare API, not your local computer. See `tools/tree/README.md` for API deployment, key rotation, limits, and local Ollama.

## Local Preview

```bash
npm run dev
```

For public-only preview or Cloudflare Pages:

```bash
npm run build
python3 -m http.server 8000 --bind 127.0.0.1 --directory _site
```

On Cloudflare Pages, use build command `npm run build`, output directory `_site`, and Node 24. A Pages connection is separate from the deployed `jie-tree-api` Worker. If using a Pages/custom domain, add its exact origin to the Worker's `ALLOWED_ORIGINS` and redeploy.

No model key belongs in GitHub, the static build, or a `VITE_` variable. Use `wrangler secret put GROQ_API_KEY` to configure the Worker. Never serve the whole repository after adding local credentials; serve `_site/` instead.
