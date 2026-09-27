# Busitema Stays — Cloudflare-compatible edition

This edition intentionally uses no React, Next.js, Vinext, Vite, or framework build step. Cloudflare uploads one standard Worker and the files in `public/`.

## Before deploying: create photo storage

1. In Cloudflare, open **R2 Object Storage**.
2. Create a bucket named exactly `busitema-hostel-photos`.
3. Leave the bucket private. The Worker securely serves the photos through the website.

The source already contains an R2 binding named `PHOTOS`. Create the bucket before deploying so the deployment can connect successfully.

## Deploy from GitHub

1. Upload the **contents of this folder** to the root of a GitHub repository.
2. In Cloudflare, open **Workers & Pages → Create → Import a repository**.
3. Select the repository.
4. Use these settings:
   - Build command: leave blank
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
5. Deploy. The first public address will end in `.workers.dev`.

After deployment, open `/api/status` on the public address. The response must
show `"build":"2026-09-28-booking-v2"`. If that value is missing, Cloudflare
is still serving an older Worker deployment or a different production branch.

## Connect the database

1. In Cloudflare, create a D1 database named `busitema-stays-db`.
2. Open its Console and run `migrations/0001_initial.sql`.
   - If the database already exists, also run `migrations/0002_booking_confirmation.sql` to enable the two-sided booking confirmation system.
3. Open the deployed Worker → Settings → Bindings.
4. Add a **D1 database** binding named exactly `DB` and select `busitema-stays-db`.
5. Under Variables and Secrets add:
   - `MANAGER_PASSWORD` — your private manager password
   - `MANAGER_AUTH_SECRET` — any long random private phrase
   - `BOOKING_CODE_SECRET` — a different long random private phrase used to create private student move-in codes
6. Redeploy once so the new settings are active.

The public hostel catalogue works even before D1 is connected. Bookings and manager changes require D1.

## Add hostel photos

1. Open the live website's **Manager** page and sign in.
2. Choose a hostel from **Edit or remove a hostel**.
3. Under **Hostel photos**, select up to five JPG, PNG or WebP files. Each file must be 5 MB or smaller.
4. Select **Upload selected photos**.
5. After the previews appear, select **Save changes**.

## Edit, hide or delete a hostel

Open the live **Manager** page and choose a hostel. Change any details and select **Save changes**. Select **Hide from public website** to remove it from the public catalogue while keeping its details, or select **Show on public website** to restore it. Select **Delete hostel** only when the listing should be permanently removed. The delete action asks for confirmation and removes its uploaded photos too.

Students can swipe horizontally through multiple photos on the public hostel cards. Only signed-in managers can upload or remove photos. No new D1 migration is needed for this feature.

Students can select **Explore hostel** on every listing, including fully occupied hostels. The details view shows the hostel photos, room types, prices, distance, services and notes. An occupied hostel offers **Join waiting list**, and the resulting request is marked as a waiting-list request in the manager dashboard.

## Confirm bookings and move-ins

New room requests use references such as `BST-48273105`. Students can open **Track booking**, enter the reference and their phone number, accept a room offer, retrieve a private six-digit move-in code, cancel a request and confirm a completed move-in. Managers mark requests as contacted, offer rooms and enter the student's code only when the student physically arrives. A booking is counted as completed only after the student confirms the move-in.

If the dashboard reports that photo storage is not connected, confirm that the R2 bucket is named `busitema-hostel-photos` and that the Worker has an R2 binding named exactly `PHOTOS`.

## Test on a computer

Install Node.js 20 or newer, then run:

```sh
npm install
npm run dev
```

## Important security note

Never place passwords or API keys inside the source files or GitHub repository. Add them only as Cloudflare secrets.
