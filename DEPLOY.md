# Deploy live (step by step)

Use **Render** (free web service) — works well for Socket.IO.  
Do **not** use Vercel/Netlify (they drop live sockets).

You need:
- A GitHub account
- Supabase already set up (tables + URL + service_role key)

---

## Part 1 — Put the code on GitHub

Open Terminal and run:

```bash
cd /Users/mahek/Projects/data-ethics-quiz
```

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial data ethics quiz app"
```

```bash
gh auth login
```

(Follow the prompts — choose GitHub.com → HTTPS → login in browser.)

Then create the repo and push:

```bash
gh repo create data-ethics-quiz --public --source=. --remote=origin --push
```

If `gh` fails, do it in the browser instead:
1. Go to https://github.com/new
2. Name: `data-ethics-quiz` → Create repository
3. Then run:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/data-ethics-quiz.git
git push -u origin main
```

⚠️ Never commit `.env` (it’s already in `.gitignore`).

---

## Part 2 — Deploy on Render

1. Go to https://render.com and sign up / log in (use GitHub).
2. Click **New +** → **Web Service**.
3. Connect the `data-ethics-quiz` GitHub repo.
4. Settings:
   - **Name:** `data-ethics-quiz`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
5. Click **Environment** and add these variables:

| Key | Value |
|-----|--------|
| `HOST_PASSCODE` | pick a secret (e.g. `ethics2026`) |
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | your Supabase **service_role** key |
| `PUBLIC_URL` | leave blank for now — set after first deploy |

6. Click **Create Web Service** and wait until status is **Live**.
7. Copy your URL, e.g. `https://data-ethics-quiz-xxxx.onrender.com`
8. Go back to **Environment** → set:

```text
PUBLIC_URL=https://data-ethics-quiz-xxxx.onrender.com
```

9. Save → Render will redeploy (~1–2 min).

---

## Part 3 — Use it live

- Players: `https://YOUR-APP.onrender.com/`
- Admin (you): `https://YOUR-APP.onrender.com/admin`  
  Passcode = whatever you set as `HOST_PASSCODE`

Project the admin page. Students join on their phones with the QR / URL.

---

## Free-tier note (Render)

Free services **spin down** after ~15 minutes idle. First open after sleep can take 30–60 seconds. Open the admin URL a few minutes before class so it’s awake.

---

## Optional: Railway instead

1. https://railway.app → login with GitHub  
2. **New Project** → **Deploy from GitHub** → pick `data-ethics-quiz`  
3. Add the same env vars (`HOST_PASSCODE`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLIC_URL`)  
4. **Settings → Networking → Generate Domain**  
5. Set `PUBLIC_URL` to that domain and redeploy  

---

## Checklist before class

- [ ] Supabase tables `players` / `answers` exist  
- [ ] Env vars set on Render/Railway  
- [ ] `PUBLIC_URL` matches the live URL (QR works)  
- [ ] You can open `/admin` with your passcode  
- [ ] A test join creates a row in Supabase Table Editor  
- [ ] Open the site once before the talk (wake free tier)  
