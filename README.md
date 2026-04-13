# Vertex Metals — Website & Portal

Vanilla HTML/CSS/JS website and internal management portal for Vertex Metals Ltd, an Isle of Man commodity trading intermediary specialising in aluminium alloy core wire (India → UK).

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in [docs/supabase-schema.md](docs/supabase-schema.md) in the SQL editor
3. Create a portal user: **Authentication → Users → Add user** (use email/password)

### 2. Configure credentials

Edit `js/supabase-client.js` and replace the placeholder values:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

Both values are found in **Supabase → Settings → API**.

### 3. Serve locally

Any static file server works. The simplest options:

```bash
# Python
python -m http.server 8080

# Node (if installed)
npx serve .

# VS Code Live Server extension — right-click index.html → Open with Live Server
```

Then open `http://localhost:8080`.

### 4. Deploy

Drop the entire folder onto any static host:
- **Netlify** — drag-and-drop deploy or connect Git repo
- **Vercel** — `vercel deploy`
- **Cloudflare Pages** — connect Git repo

No build step required.

## Structure

See [docs/architecture.md](docs/architecture.md) for the full directory layout and system design.

## Database

See [docs/supabase-schema.md](docs/supabase-schema.md) for all `CREATE TABLE` statements and RLS policies.

## Portal Access

Navigate to `/portal/login.html`. Sign in with the credentials created in step 3.
