# Paint Masters Ops Board — standalone deploy guide

This is a self-contained version of the Daily Ops Board that does **not** require a Claude login on the warehouse PC. Instead it's gated by a single shared passphrase you set. It's the same board — same layout, same click-to-edit rows, same pull alert and chime — just hosted on its own tiny server.

Cost: ~$7.25/mo (Render's Starter plan + a small persistent disk to keep the board's data safe across restarts).

## 1. Push this folder to GitHub

1. Go to https://github.com/new and create a new **private** repository (e.g. `paint-masters-ops-board`).
2. On your computer, unzip this bundle, then from inside that folder:
   ```
   git init
   git add .
   git commit -m "Initial ops board"
   git branch -M main
   git remote add origin https://github.com/<your-username>/paint-masters-ops-board.git
   git push -u origin main
   ```
   (No git installed / don't want the command line? GitHub's website also lets you drag-and-drop upload every file in this folder directly through "Add file → Upload files" on the new repo's page.)

## 2. Deploy on Render

1. Go to https://render.com and sign up / log in (GitHub login is easiest).
2. Click **New +** → **Blueprint**.
3. Connect the GitHub repo you just created. Render will read `render.yaml` from this bundle automatically and propose one web service: `paint-masters-ops-board`.
4. Click **Apply**. It will ask you to fill in the `PASSPHRASE` environment variable — type whatever passphrase you want warehouse PCs to use (e.g. a short word or number code). Keep it somewhere you'll remember; you can change it later in Render's dashboard under the service's **Environment** tab.
5. Click **Deploy**. First deploy takes a minute or two.
6. Once it's live, Render gives you a URL like `https://paint-masters-ops-board.onrender.com`.

## 3. Open it on the warehouse PC(s)

- Go to `https://paint-masters-ops-board.onrender.com/?key=YOUR_PASSPHRASE` **once** in the browser on that PC — the `?key=` part unlocks it automatically and remembers the passphrase in that browser from then on (it won't show up in the address bar after the first load).
- Bookmark it or pin the tab. No Claude login involved anywhere — anyone who opens that browser only ever sees the board itself, nothing else.
- Full-screen the browser (F11) for a clean kiosk look.

You can do this on as many PCs/screens as you want — they'll all stay in sync (polling every 4 seconds).

## Notes

- **Data safety:** board data lives on the persistent disk Render attaches (`/var/data/board.json`), not in the code, so redeploys don't wipe it. It's seeded on first boot with the board's real data as of the migration date.
- **Changing the passphrase:** Render dashboard → your service → Environment → edit `PASSPHRASE` → Save (it redeploys automatically). You'll need to re-enter it (or re-visit the `?key=` link) on every PC after that.
- **If it ever shows "Reconnecting…":** the board keeps whatever was last loaded and keeps retrying in the background — nothing is lost, it just means the server's briefly unreachable (Render's free/starter tier can take a few seconds to wake up from idle).
- **Local test before deploying (optional):** with Node 18+ installed, run `PASSPHRASE=test node server.js` from this folder, then open `http://localhost:3000/?key=test`.
