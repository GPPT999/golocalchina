# GoLocalChina — Deployment Guide (Vercel + Railway)

Costs depend on the current Vercel and Railway plans. HTTPS is included.

---

## Architecture

This project uses a **unified backend** (`golocalchina-api/`) that supports:
- **SQLite** for development and the current Railway deployment
- **PostgreSQL** for production deployments
- **Argon2id** password hashing (OWASP recommended)
- **PyJWT** for JWT tokens (replaces unmaintained python-jose)
- **Anthropic SDK** for AI agent LLM calls (secure, no CLI flags)

---

## Step 1: Deploy Backend to Railway (5 min)

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select `GPPT999/golocalchina`
4. Railway will auto-detect — set these:
   - **Root Directory:** `golocalchina-api`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables in Railway dashboard:
   ```
   JWT_SECRET_KEY=<generate a random 64-char string>
   CORS_ORIGINS=https://golocalchina.vercel.app
   DATABASE_URL=sqlite+aiosqlite:////data/golocalchina.db
   ```
6. Mount a persistent Railway volume at `/data`.
7. Deploy and verify `https://golocalchina-production-6f97.up.railway.app/health`.

---

## Step 2: Deploy Frontend to Vercel (5 min)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **"Add New Project"** → Import `GPPT999/golocalchina`
3. Configure:
   - **Root Directory:** `golocalchina-web`
   - **Framework:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Click **Deploy** → Vercel gives you `golocalchina.vercel.app`

---

## Step 3: Connect Frontend → Backend (2 min)

1. In your Vercel project, go to **Settings → Environment Variables**
2. (The API URL is already configured in `vercel.json` — just update it)
3. Edit `golocalchina-web/vercel.json` in GitHub:
   ```json
   "rewrites": [
     { "source": "/api/:path*", "destination": "https://YOUR_RAILWAY_URL.up.railway.app/api/:path*" }
   ]
   ```
4. Push the change → Vercel auto-redeploys

---

## Step 4: Custom Domain (optional, $10/year)

1. Buy a domain (e.g., `golocalchina.com`) from Namecheap or Cloudflare
2. In Vercel: **Settings → Domains → Add** `golocalchina.com`
3. Point your domain's DNS to Vercel (they give you the records)
4. HTTPS is automatic

---

## Step 5: Production PostgreSQL (optional)

For production deployments, switch from SQLite to PostgreSQL:

1. Add a PostgreSQL database in Railway (or use Supabase/Neon)
2. Set the `DATABASE_URL` environment variable:
   ```
   DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
   ```
3. The backend auto-detects PostgreSQL and enables connection pooling

---

## Running Tests

```bash
cd golocalchina-api
pip install -r requirements.txt
pytest
```

Tests cover:
- Health endpoint
- Auth flow (send code, verify code, register, login)
- Guide search and detail
- Explore listings

---

## CI/CD

Vercel and Railway are connected to `GPPT999/golocalchina`. Pushes to `main`
trigger their configured deployments. Run the backend tests and frontend build
before pushing because this repository does not include a GitHub Actions workflow.

---

## That's It!

Your live URLs:
- **Frontend:** `https://golocalchina.vercel.app` (or your custom domain)
- **Backend API:** `https://golocalchina-production-6f97.up.railway.app/health`
- **API Docs:** `https://golocalchina-production-6f97.up.railway.app/docs`

Both have HTTPS and auto-deploy on git push.
