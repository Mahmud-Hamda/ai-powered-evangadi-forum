# Evangadi Forum

React forum with a Node API. The site can be pushed to GitHub, the pages deployed on Vercel, and a Hostinger domain pointed at that deployment.

The pages are in `frontend`. The API and MySQL access are in `backend`. Vercel serves the pages. The API needs a host that runs Node and can reach MySQL. A static upload of `frontend/dist` does not include the API.

## Local development

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev
```

Fill `backend/.env` on your machine. Do not commit it.

- Pages: `http://localhost:5173`
- API: `http://localhost:3777`

Other scripts:

- `npm run build` — production build of the pages in `frontend/dist`
- `npm run dev:backend` — API only
- `npm run dev:frontend` — pages only

On a database that already has tables, apply `backend/db/migrations` in order. Do not run `backend/db/schema.sql` on a live database. That file drops every table.

## GitHub

Keep secrets out of the repository. `.gitignore` excludes `.env` files, keys, `node_modules`, uploads, and the Vercel local folder `.vercel`. `backend/.env.example` and `frontend/.env.example` are the lists of settings, with empty secrets.

```bash
git add .
git commit -m "Prepare the forum for deployment"
git push -u origin main
```

Confirm `backend/.env` is not in the commit before you push.

## Vercel

1. Import this GitHub repository.
2. Set the root directory to `frontend`. Vercel detects Vite. `frontend/vercel.json` publishes `dist` and keeps routes such as `/auth` working.
3. Add one environment variable: `VITE_API_BASE_URL`, the public API address, with no trailing slash. Example: `https://api.yourdomain.com`.
4. Deploy. Later pushes to the connected branch deploy the pages automatically.

If you set the Vercel root directory to `frontend` instead, `frontend/vercel.json` is used. Set `VITE_API_BASE_URL` there as well.

Face unlock and fingerprint need the real site address on the API: `WEBAUTHN_RP_ID` is the host name only, and `WEBAUTHN_ORIGIN` is the full `https://` address. A key saved on localhost does not work on the public site. Save the sign-in method again after the public address is live.

## API host

The API start command is `npm start` inside `backend`. The host must set `PORT`. The app listens on all interfaces.

Set the variables from `backend/.env.example` in the host’s panel, not in git. Use a new `JWT_SECRET`. Point `DB_HOST` at the database that host gives you.

`FRONTEND_URL` is one address, the public pages, with no trailing slash. Password-reset mail uses it. `CORS_ORIGINS` can list extra page addresses, separated by commas, such as the `vercel.app` address and the Hostinger domain.

`NODE_ENV=production` on that host.

## Hostinger

Use Hostinger for the domain and keep the pages on Vercel, the same way as the portfolio.

1. In the Vercel project, open **Settings → Domains** and add the Hostinger domain, including `www` if you use it.
2. Vercel shows the DNS records to create. In Hostinger, open **hPanel → Domains → DNS / Nameservers**.
3. Add the records Vercel lists. A typical setup is:
   - `A` record for `@` pointing at the address Vercel gives you
   - `CNAME` record for `www` pointing at `cname.vercel-dns.com`
4. Remove any old `A` or `CNAME` records for the same host that would conflict.
5. Wait for DNS, then set `FRONTEND_URL` and `WEBAUTHN_ORIGIN` on the API to that `https://` address, and `WEBAUTHN_RP_ID` to the host name only.
6. Set `VITE_API_BASE_URL` on Vercel to the public API address and redeploy the pages.

To put the pages on Hostinger instead of Vercel, run `npm run build` and upload the **contents** of `frontend/dist` into `public_html`. `frontend/public/.htaccess` is copied into that build so addresses such as `/auth` still open the app. Do not upload `node_modules` or `backend/.env`.

The API still has to run as Node somewhere MySQL is reachable. If that is a Hostinger Node app, its root is `backend`, the start command is `npm start`, and the environment variables belong in that panel.

After the pages have a public address, add that address to the portfolio. Do not put Hostinger, Vercel, or DNS tokens in this repository.
