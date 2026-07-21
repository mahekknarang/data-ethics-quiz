# Data Ethics Live Quiz

Two pages only:

| URL | Who | What |
|-----|-----|------|
| `/` | Students (phones) | Join + play the quiz |
| `/admin` | You (projector/laptop) | **All-in-one**: run the quiz **and** show the data reveal |

Passcode (default): `ethics2026`

---

## 1. Terminal commands (run the app)

Open Terminal and paste these one by one:

```bash
cd /Users/mahek/Projects/data-ethics-quiz
```

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm start
```

Then open:

- Players → http://localhost:3000/
- You (admin) → http://localhost:3000/admin

To stop the server later: press `Ctrl + C` in that terminal.

If you change `.env`, stop the server and run `npm start` again.

---

## 2. Connect Supabase (step by step)

### Step A — Create a project

1. Go to https://supabase.com and sign in (GitHub is fine).
2. Click **New project**.
3. Pick an org, name it something like `data-ethics-quiz`.
4. Set a database password (save it somewhere — you won’t need it for this app).
5. Choose a region close to you → **Create project**.
6. Wait until the project is ready (green).

### Step B — Create the tables

1. In the left sidebar open **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase-schema.sql` in this project, copy **all** of it, paste into the SQL editor.
4. Click **Run**.
5. Confirm you see success. Then open **Table Editor** — you should see tables `players` and `answers`.

### Step C — Copy API keys

1. Click the gear icon → **Project Settings**.
2. Open **API** (sometimes under **Data API**).
3. Copy:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **service_role** key (under Project API keys) → long `eyJ...` string  
     ⚠️ Use **service_role**, not the `anon` key. Never share this key publicly.

### Step D — Put keys in `.env`

In Terminal:

```bash
cd /Users/mahek/Projects/data-ethics-quiz
open -e .env
```

(or open `.env` in Cursor)

Edit so it looks like this (use *your* values):

```env
PORT=3000
HOST_PASSCODE=ethics2026
PUBLIC_URL=http://localhost:3000

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY
```

Save the file.

### Step E — Restart the app

In the terminal where the server is running, press `Ctrl + C`, then:

```bash
npm start
```

You should see a line like `[supabase] Client ready` (not the “placeholder credentials” warning).

### Step F — Test it

1. Open http://localhost:3000/admin → enter passcode.
2. On your phone (or another browser tab), open http://localhost:3000/ and join with a name.
3. In Supabase → **Table Editor** → `players` → refresh — you should see a new row.
4. Run a question, answer it → check the `answers` table.
5. In admin, switch to **2 · Data reveal** — stats should load with `source: supabase`.

---

## 3. How you use it in class

1. Project **Admin** (`/admin`) on the big screen — stay on **1 · Run quiz**.
2. Students scan the QR / open the join URL on their phones.
3. Click **Start Quiz**, then **Next Question** to advance.
4. When the quiz ends, click **Show data reveal →** (or the **2 · Data reveal** tab) — same page, no second URL.
5. Optional: also show the Supabase Table Editor so the class sees real rows.

---

## 4. Edit questions

Edit `questions.json`, then restart with `npm start`.

```json
{
  "text": "Your question?",
  "options": ["A", "B", "C", "D"],
  "correct": 1
}
```

`correct` is 0-based (`0` = first option).

---

## 5. Deploy live (phones on real wifi)

Full step-by-step: see **[DEPLOY.md](./DEPLOY.md)**.

Short version: push to GitHub → create a **Render Web Service** → set env vars → set `PUBLIC_URL` to the live URL → students open that URL.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| `[supabase] Missing or placeholder credentials` | `.env` still has `YOUR_PROJECT` placeholders — paste real URL + service_role key, restart |
| Rows not appearing in Supabase | Confirm you used **service_role** key; confirm tables exist; check terminal for `[supabase] insertPlayer:` errors |
| Passcode wrong | Default is `ethics2026` — or whatever you set as `HOST_PASSCODE` |
| Port in use | Change `PORT=3001` in `.env` and restart |
| QR shows localhost on phones | Phones need your computer’s LAN IP or a deployed `PUBLIC_URL` |
