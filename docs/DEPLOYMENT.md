# Production deployment plan

Step-by-step tasks to take EcoPrompt to production. Work through the phases in order: the API URL feeds the website, and the website URL and Supabase project feed the extension.

| Phase | What | Where it runs |
|---|---|---|
| 1 | API (`backend/`) | A container host (see task 1.6) |
| 2 | Database and auth (`supabase/`) | Supabase |
| 3 | Website (`webapp/ibmhack/`) | Vercel |
| 4 | Extension (`extension/`) | Chrome Web Store |
| 5 | Launch checks | Everywhere |

Placeholders used below: `<api-url>`, `<site-url>`, `<project-ref>` (Supabase), `<extension-id>`.

---

## Phase 0 – Decide how heavy the API will be

The API currently runs three models **in its own process** on every request:

| Model | Used by | RAM | Can be pre-trained and uploaded? |
|---|---|---|---|
| scikit-learn classifier (`artifacts/complexity_model.joblib`) | `/analyse` | Under 100 MB | Yes: train locally, upload the file |
| Qwen3.5-0.8B + `regolo/brick-complexity-extractor` LoRA | `/analyse` (blended 50/50 with the classifier) | About 3–4 GB | No. Uploading the weights still means the server runs Qwen inference |
| LLMLingua-2 BERT | `/compress` | About 1–2 GB | No, for the same reason |

Choose one mode:

- **Lite (recommended for cheap/free hosting):** scikit-learn classifier only, with compression either kept or turned off. Needs 512 MB–2 GB of RAM. Requires tasks 1.2 and 1.3 (code changes).
- **Full:** everything as it is today. Needs at least 6–8 GB of RAM. Skip tasks 1.2 and 1.3.

Write the decision down. Several tasks below differ by mode.

---

## Phase 1 – API

### 1.1 Train and export the classifier

1. Create a virtual environment in `backend/`:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Run the training notebook headlessly: `python run_notebook.py` (or open `main.ipynb` and run all cells).
3. Confirm that `backend/artifacts/complexity_model.joblib` and `backend/artifacts/metrics.json` exist.
4. Open `metrics.json` and note:
   - The macro-F1 and accuracy scores. These are what the lite mode will deliver.
   - The `versions` block (`scikit-learn`, `numpy`, `joblib`). **The server must use exactly these versions**, because a joblib pickle from one scikit-learn version may fail or behave differently on another.
5. Keep the artifact out of git (`artifacts/` is already ignored). It reaches the server through the Docker image (task 1.5) or a storage bucket.

### 1.2 (Lite only) Make Qwen optional

Currently `joint_classifier.classify()` always imports `train_complexity_model`, which loads Qwen at import time. Also, the website hardcodes `epsilon: 0.5`, so the switch must be enforced on the server.

1. In `backend/joint_classifier.py`, read a flag such as `USE_LM = os.getenv("USE_LM", "1") == "1"`.
2. In `classify()`, when `USE_LM` is off, return the notebook model's probabilities directly and **never import** `train_complexity_model`. Ignore the incoming epsilon (treat it as 1).
3. Add a unit test in `test_joint_classifier.py` that confirms `train_complexity_model` is not imported when `USE_LM=0`.

### 1.3 (Lite only) Decide what to do with `/compress`

Pick one:

- **Keep compression:** no code change. Budget about 2 GB of RAM.
- **Turn it off:** add `USE_COMPRESSOR=0` handling in `backend/api.py`. Skip constructing `Compressor()` and `warm_up()` at startup, and make `/compress` return HTTP 503. Do **not** use `MOCK_MODEL=1` in production, because it returns fake compressions. On the website, hide or disable the compression panel (`components/checker/CompressionPanel.tsx`) using a new flag in `lib/features.ts`. Otherwise users will see "Compression service returned 503".

### 1.4 Protect the API with a shared secret

The API has no authentication, and both endpoints are expensive. The website calls it server-to-server, so a shared key is enough.

1. In `backend/api.py`, add a FastAPI dependency that compares an `X-API-Key` request header against `os.environ["API_KEY"]` using `secrets.compare_digest`. Apply it to `/analyse`, `/analyse/bulk` and `/compress`, and leave `/` open as a health check. Return 401 on a mismatch.
2. In `webapp/ibmhack/lib/estimation/client.ts` and `lib/compression/client.ts`, send `"X-API-Key": process.env.BACKEND_API_KEY` in the fetch headers. Keep it server-only, with **no** `NEXT_PUBLIC_` prefix.
3. Add `X-API-Key` to `allow_headers` in the CORS middleware, but only if a browser will ever call the API directly.
4. Add tests in `test_api.py` for a missing key, a wrong key and a correct key.
5. Generate a key: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Store it in a password manager.

### 1.5 Write the Dockerfile and requirements

1. **Lite mode:** create `backend/requirements-prod.txt` with only what the server needs, pinned to the versions from `metrics.json`:
   ```
   fastapi>=0.115,<1
   pydantic>=2.9,<3
   uvicorn[standard]
   tiktoken
   joblib==<from metrics.json>
   numpy==<from metrics.json>
   scikit-learn==<from metrics.json>
   scipy
   # add these only if compression is kept:
   # torch (CPU wheel), transformers, llmlingua==0.2.2
   ```
   **Full mode:** use `requirements.txt`, but install the CPU build of torch first.
2. Create `backend/Dockerfile`:
   ```dockerfile
   FROM python:3.12-slim
   WORKDIR /app
   ENV PYTHONUNBUFFERED=1 HF_HOME=/app/.hf
   # Full mode / compression only: CPU torch keeps the image several GB smaller
   # RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
   COPY requirements-prod.txt .
   RUN pip install --no-cache-dir -r requirements-prod.txt
   COPY *.py ./
   COPY artifacts/complexity_model.joblib artifacts/
   # Full mode / compression only: bake HF weights into the image so cold starts don't download them
   # RUN python -c "from compressor import Compressor; Compressor()"
   EXPOSE 8000
   CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
   ```
   Keep `--workers 1`, because each worker loads its own copy of every model.
3. Add `backend/.dockerignore` containing `.venv`, `data`, `.runtime`, `__pycache__`, `*.ipynb` and `.ipynb_checkpoints`.
4. Build and test locally:
   ```bash
   docker build -t ecoprompt-api backend
   docker run --rm -p 8000:8000 -e APP_ENV=production -e API_KEY=test -e USE_LM=0 ecoprompt-api
   curl -X POST localhost:8000/analyse -H "Content-Type: application/json" -H "X-API-Key: test" -d '{"prompt":"hello"}'
   ```
5. Run the test suite: `pip install -r requirements-test.txt && python -m unittest test_api test_joint_classifier`.

### 1.6 Choose a host and deploy

Prices are rough; check the current pricing.

| Mode | Good options |
|---|---|
| Lite | Render (Starter about $7/mo; the free tier sleeps), Railway, Fly.io smallest machine, IBM Code Engine (if hackathon credits are available) |
| Full | Hugging Face Spaces (free CPU tier with 16 GB; sleeps when idle; the app must listen on port 7860), Hetzner VM with 8 GB (about €8/mo, you manage it), Fly.io with 8 GB |

General steps for any container host:
1. Connect the GitHub repo and set the build context/root directory to `backend/` with the Dockerfile. Alternatively, push the image to a registry and deploy it from there.
2. Make sure the artifact reaches the image. CI cannot see a gitignored file, so do one of these:
   - Build the image locally and push it to the host's registry (simplest).
   - Upload `complexity_model.joblib` to a bucket and download it during the build or at startup.
   - Commit the artifact with Git LFS. It's small, so this is acceptable.
3. Set the environment variables:
   ```
   APP_ENV=production
   API_KEY=<the key from 1.4>
   USE_LM=0                  # lite only
   USE_COMPRESSOR=0          # only if 1.3 disabled it
   ALLOWED_ORIGINS=          # empty: only the website server calls it
   TORCH_THREADS=<vCPUs>     # only if torch is installed
   ```
4. Set the health check path to `/`. Allow a long startup timeout in full mode, because model loading takes a while.
5. Note the public HTTPS URL. This is `<api-url>`.
6. Smoke test it with `curl`, both with and without the key (expect 200 and 401).

### 1.7 Logging and alerts

1. Confirm that the logs show request counts and timings, not prompt text. `/compress` already logs only counts.
2. Turn on the host's uptime check, or a free monitor such as UptimeRobot, against `<api-url>/`.

---

## Phase 2 – Supabase (database and auth)

### 2.1 Create the projects

1. Create a **staging** Supabase project and a **production** one. For the free tier, the production project can be your existing one.
2. Back up the production database before making any change: Dashboard → Database → Backups, or `pg_dump`.

### 2.2 Apply the migrations

1. Install the CLI (`npm i -g supabase`) and log in: `supabase login`.
2. Link to staging and push: `supabase link --project-ref <staging-ref>`, then `supabase db push`. This applies, in order:
   - `20261018000002_extension_account_sync.sql`
   - `20261018000003_weekly_leaderboard.sql`
3. Run the SQL tests in `supabase/tests/` against staging (`supabase test db`, or paste them into the SQL editor).
4. Repeat the push for production: `supabase link --project-ref <project-ref>` and `supabase db push`.
5. **Never** run the old destructive `20261018000001_baseline.sql` (see `extension/ACCOUNT_SYNC.md`).

### 2.3 Configure auth

1. Auth → Providers → **Email**: enable it, and keep "Confirm email" on.
2. Auth → Providers → **Google**:
   1. In Google Cloud Console, create an OAuth 2.0 client of type "Web application".
   2. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   3. Paste the client ID and secret into Supabase.
   4. Configure the OAuth consent screen (app name, support email, privacy policy URL) and publish it. While it stays in "Testing", only listed test users can sign in.
3. Auth → URL Configuration:
   - Site URL: `<site-url>`
   - Redirect URLs: `<site-url>/auth/callback`. The extension's URL gets added in task 4.6.
4. Auth → SMTP: set up a custom SMTP provider (Resend, Postmark, SendGrid…). Supabase's built-in email is heavily rate-limited and not meant for production.

### 2.4 Collect the keys

From Project Settings → API, copy the **Project URL** and the **publishable** key. Never put the service-role/secret key in the website or the extension.

---

## Phase 3 – Website (Next.js on Vercel)

### 3.1 Check the build locally

```bash
cd webapp/ibmhack
npm ci
npm run lint
npx tsc --noEmit
npm run build            # if Turbopack stalls: npm run build -- --webpack
```

### 3.2 Create the Vercel project

1. vercel.com → Add New → Project → import the GitHub repo.
2. Set **Root Directory** to `webapp/ibmhack`. Vercel detects the Next.js framework automatically.
3. If the build stalled in 3.1, override the Build Command with `next build --webpack`.

### 3.3 Set the environment variables (Production and Preview)

```
BACKEND_API_URL=<api-url>
BACKEND_API_KEY=<the key from 1.4>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SITE_URL=<site-url>
```
If `BACKEND_API_URL` is missing, the site silently falls back to **mock** data, so double-check it is set. For previews, point at the staging Supabase project and the staging API if you have them.

### 3.4 Deploy and add the domain

1. Deploy, then go to Settings → Domains and add your domain. Create the DNS records Vercel shows you.
2. Update `SITE_URL` (Vercel), plus the Supabase Site URL and redirect URL (task 2.3), to the final domain, then redeploy.

### 3.5 Add legal pages

Add a **privacy policy** page and a terms page to the site, for example `app/(marketing)/privacy/page.tsx`. Both the Chrome Web Store and Google's OAuth consent screen require a privacy policy URL. Describe what is stored: estimates metadata, not prompt text.

### 3.6 Smoke test

Sign up by email (confirm the email arrives and its link works), sign in with Google, run the prompt checker, bulk and compression, and check that the dashboard, history and leaderboard show real data.

---

## Phase 4 – Chrome extension

### 4.1 Production config

Create `extension/.env.production.local` (Vite loads it for `vite build`):
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_SITE_URL=<site-url>
VITE_BACKEND_URL=<api-url>
```
These values are embedded in the shipped bundle, so only public values belong here. Never put `API_KEY` here. The extension currently uses the mock analysis service and doesn't call the API. If you later make it call the API, it will need its own auth (for example, a Supabase JWT that the API verifies) and `chrome-extension://<extension-id>` in the API's `ALLOWED_ORIGINS`.

### 4.2 Prepare the manifest and assets

In `extension/public/manifest.json`:
1. Set `version` (for example `1.0.0`), and increase it on every upload.
2. Update `description`. It currently says "mock", which reviewers and users will see.
3. Add `"icons"` at 16, 32, 48 and 128 px, and set `action.default_icon`. Put the PNGs in `extension/public/icons/`.
4. Check that every permission is actually used (`tabs`, `scripting`, `activeTab`, `identity`, `alarms`, `storage`). Unused permissions slow down review or cause rejection.

### 4.3 Build and package

```bash
cd extension
npm ci
npm test                       # typecheck, build and all tests
cd dist && zip -r ../ecoprompt-extension.zip . && cd ..
```
On Windows, use `Compress-Archive -Path dist\* -DestinationPath ecoprompt-extension.zip`. The `manifest.json` file must be at the root of the zip.

### 4.4 Do a final manual check of the production build

1. Go to `chrome://extensions` → Developer mode → Load unpacked → `extension/dist`.
2. Go through the "Still required" checklist in `extension/ACCOUNT_SYNC.md`: guest tracking, email and Google login, sync, offline retry and account switching.

### 4.5 Publish to the Chrome Web Store

1. Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time $5 fee) and verify your email.
2. Click New item and upload the zip.
3. **Store listing:** name, a detailed description, a category (Productivity), at least one 1280×800 screenshot, a 440×280 promo tile and the 128px icon.
4. **Privacy practices:**
   - Write a single-purpose statement.
   - Justify every permission and the host permissions (`chatgpt.com`, `chat.openai.com`, and the Supabase origin that the build adds).
   - Declare the data collected: authentication info, plus website content read on chatgpt.com, which is used only locally.
   - Certify the Limited Use policy.
   - Add the privacy policy URL from task 3.5.
5. **Distribution:** choose Public, or Unlisted for a soft launch.
6. Submit for review. It usually takes a few days and can take longer on a first submission.

### 4.6 Fix the Google login redirect for the published ID

1. After the first upload, the dashboard shows the permanent `<extension-id>`.
2. Add `https://<extension-id>.chromiumapp.org/` to the Supabase redirect URLs (task 2.3). This is the value of `chrome.identity.getRedirectURL()`.
3. Optional: to give your local unpacked build the same ID, go to the dashboard → Package → copy the public key into `"key"` in `manifest.json`. Remove it again before uploading if the store complains.
4. Test Google login with the store-installed build once it's approved.

### 4.7 Link the extension from the website

Update `components/marketing/Extension.tsx` (and any install buttons) to link to the Chrome Web Store listing URL.

---

## Phase 5 – Launch checks

- [ ] `<api-url>/` returns 200; protected endpoints return 401 without the key.
- [ ] The website shows real backend results (the methodology is labelled `backend-token-v1`, not mock).
- [ ] Email signup, Google login and the password flows work on the production domain.
- [ ] Rows appear in `estimates` with no prompt text. RLS blocks reads across users: test this with two accounts.
- [ ] The extension installed from the store can log in, track usage and sync. The website history shows the extension's rows.
- [ ] Uptime monitoring and alerts are set up for the API.
- [ ] Supabase backups are enabled. The Pro plan is needed to avoid the free tier pausing after inactivity.
- [ ] Secrets (`API_KEY`, Google OAuth secret, SMTP credentials) are stored in a password manager, not in the repo.

## Releasing updates later

- **API:** make the change, run the tests, rebuild the image and redeploy. If you retrain the classifier, rebuild with the new `complexity_model.joblib` and keep the scikit-learn pin in sync with `metrics.json`.
- **Website:** merge to `main`, and Vercel deploys automatically.
- **Database:** add a new timestamped file in `supabase/migrations/`, test it on staging, then run `supabase db push` against production.
- **Extension:** bump `version`, run `npm test`, zip `dist`, upload and resubmit. Users get the update automatically after review.
