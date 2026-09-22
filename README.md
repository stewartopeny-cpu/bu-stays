# Busitema Stays — Cloudflare-compatible edition

This edition intentionally uses no React, Next.js, Vinext, Vite, or framework build step. Cloudflare uploads one standard Worker and the files in `public/`.

## Deploy from GitHub

1. Upload the **contents of this folder** to the root of a GitHub repository.
2. In Cloudflare, open **Workers & Pages → Create → Import a repository**.
3. Select the repository.
4. Use these settings:
   - Build command: leave blank
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
5. Deploy. The first public address will end in `.workers.dev`.

## Connect the database

1. In Cloudflare, create a D1 database named `busitema-stays-db`.
2. Open its Console and run `migrations/0001_initial.sql`.
3. Open the deployed Worker → Settings → Bindings.
4. Add a **D1 database** binding named exactly `DB` and select `busitema-stays-db`.
5. Under Variables and Secrets add:
   - `MANAGER_PASSWORD` — your private manager password
   - `MANAGER_AUTH_SECRET` — any long random private phrase
6. Redeploy once so the new settings are active.

The public hostel catalogue works even before D1 is connected. Bookings and manager changes require D1.

## Test on a computer

Install Node.js 20 or newer, then run:

```sh
npm install
npm run dev
```

## Important security note

Never place passwords or API keys inside the source files or GitHub repository. Add them only as Cloudflare secrets.
