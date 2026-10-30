# Evangadi Forum

React forum with a Node API. The pages and the API are separate Vercel projects. MySQL in production is TiDB Cloud. A Hostinger domain can point at the pages.

The pages are in `frontend`. The API is in `backend`.

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

The pages and the API are two Vercel projects from this repository, the same way as the GPT clone.

| Vercel project | Root directory | Framework |
| --- | --- | --- |
| Pages | `frontend` | Vite |
| API | `backend` | Express |

1. Import this GitHub repository twice, once for each root directory above.
2. The API region is `iad1`, next to the TiDB Cloud database in `us-east-1`.
3. On the pages project, set `VITE_API_BASE_URL` to the API address with no trailing slash, then redeploy. Example: `https://your-api.vercel.app`.
4. On the API project, set the variables from `backend/.env.example`. Use TiDB Cloud for MySQL: `DB_PORT=4000` and `DB_SSL=true`. Set `NODE_ENV=production`. Set `FRONTEND_URL` and `WEBAUTHN_ORIGIN` to the pages address, and `WEBAUTHN_RP_ID` to that host name only.

`frontend/vercel.json` keeps routes such as `/auth` working. `backend/vercel.json` runs the Express app.

Face unlock and fingerprint need the public site address. A key saved on localhost does not work on the public site. Save the sign-in method again after the public address is live.

`FRONTEND_URL` is one address, the public pages, with no trailing slash. Password-reset mail uses it. `CORS_ORIGINS` can list extra page addresses, separated by commas.

## Database

Production uses TiDB Cloud, which speaks MySQL. Create an empty database there and apply `backend/db/schema.sql` once. Do not run that file against a database that already has data. It drops every table.

On a database that already has tables, apply `backend/db/migrations` in order instead.

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

To put the pages on Hostinger instead of Vercel, run `npm run build` and upload the **contents** of `frontend/dist` into `public_html`. `frontend/public/.htaccess` is copied into that build so addresses such as `/auth` still open the app. Do not upload `node_modules` or `backend/.env`. The API stays on Vercel.

After the pages have a public address, add that address to the portfolio. Do not put Hostinger, Vercel, or DNS tokens in this repository.
