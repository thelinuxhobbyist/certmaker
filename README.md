# The Cert Maker — Phase 1

Stateless edge certificate engine (thecertmaker.com): design templates, generate PNG/PDF, download a zip immediately. No login. Generated certificate files are not kept on our servers.

## Stack

- **Frontend:** React + Vite (Konva canvas, PapaParse) on Workers Assets
- **API:** Hono on Cloudflare Workers
- **Storage:** D1 (templates + issuance metadata), R2 (background images only in Phase 1)
- **Render:** `@cf-wasm/resvg` + `pdf-lib` → zip via `fflate`

## Phase 1 policy

- **No auth** — optional `Authorization: Bearer …` is accepted and wired for later
- **Ephemeral certs** — generate → zip download → no PNG/PDF written to R2
- **Future hook** — `handleStoragePolicy()` will retain files ~24h for logged-in users

## Quick start

```bash
npm install
npm run build:web
npm run db:migrate:local
npm run types
npm run dev:api
```

Open http://localhost:8787

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/templates/upload-bg` | Upload PNG background (≤10MB) to R2 |
| `POST` | `/api/templates` | Save template (`user_id` defaults to `anonymous`) |
| `GET` | `/api/templates/:id` | Template metadata + coordinates |
| `POST` | `/api/certificates/generate-single` | Returns a **zip** download (PNG+PDF) |
| `POST` | `/api/certificates/batch` | Up to 100 rows → **zip** download |
| `GET` | `/api/verify/:cert_id` | Metadata only in Phase 1 (no stored files) |
| `GET` | `/api/assets/*` | Serve R2 objects (backgrounds) |

Zip responses include headers: `X-Certify-Policy`, `X-Certify-Count`, `X-Certify-Failed`, `X-Certify-Elapsed-Ms`.

## Deploy

1. Create D1 + R2 in the Cloudflare dashboard (or via wrangler).
2. Put real `database_id` / bucket name in `wrangler.jsonc`.
3. `npm run db:migrate:remote && npm run deploy`

Set `PUBLIC_BASE_URL` to `https://thecertmaker.com`.

### Custom domain (`thecertmaker.com`)

1. Add the site in the Cloudflare dashboard (DNS must use Cloudflare nameservers).
2. Remove any apex `A` / `CNAME` records that conflict with the Worker custom domain.
3. Deploy — `wrangler.jsonc` already maps `thecertmaker.com` and `www.thecertmaker.com` as Worker custom domains.
