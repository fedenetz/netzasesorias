# Netz Control · Supabase setup

The internal workspace uses Google OAuth plus an explicit employee allowlist. A successful Google login is not enough: `profiles.is_active` must also be true, and RLS enforces this on every operational table.

## 1. Create the database

Do this before the first login.

1. Open the Supabase project.
2. Go to **SQL Editor** → **New query**.
3. Paste all of `supabase/schema.sql` and select **Run**.
4. In **Table Editor**, confirm these tables exist: `profiles`, `clients`, `f29_periods`, `periods`, `period_status_fields`, `documents`, `observations`, and `activity_log`.

The schema enables RLS and creates the Google-user profile trigger. It is intended to run once on a new project.

## 2. Get the application keys

From the project's **Connect** dialog or **Project Settings** → **API Keys**, copy:

- Project URL → `VITE_SUPABASE_URL` and `SUPABASE_URL`.
- Publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Secret/service-role key → `SUPABASE_SERVICE_ROLE_KEY`.

Only the publishable key may use the `VITE_` prefix. Never place the secret/service-role key in browser code, commit it, or share it in chat.

Create `.env.local` in the repository root:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY
```

`.env.local` is gitignored. Restart Vite after creating or changing it.

## 3. Configure Google OAuth

### Google Cloud

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen. Use **Internal** if every employee belongs to the same Google Workspace; otherwise use **External** and add employee test users until the app is published.
3. Create **OAuth client ID** → **Web application**.
4. Add authorized JavaScript origins:
   - `http://127.0.0.1:4173`
   - `https://YOUR_PRODUCTION_DOMAIN`
5. Add this authorized redirect URI, using the Supabase project reference:
   - `https://PROJECT_REF.supabase.co/auth/v1/callback`
6. Copy the Google client ID and client secret.

### Supabase

1. Go to **Authentication** → **Providers** → **Google**.
2. Enable Google and paste the Google client ID and secret.
3. Go to **Authentication** → **URL Configuration**.
4. Set **Site URL** to the production origin, for example `https://netzasesorias.cl`.
5. Add redirect URLs:
   - `http://127.0.0.1:4173/**`
   - `https://YOUR_PRODUCTION_DOMAIN/**`
   - Add the Netlify preview URL pattern only if employee login should work on deploy previews.

The frontend returns users to `/control` after Google login.

## 4. Approve the first administrator

1. Start the app with `npm run dev` (the project is fixed to port 4173).
2. Open `http://127.0.0.1:4173/control` and sign in with Google.
3. The app should show **Tu acceso aún no está habilitado**. This confirms the allowlist is working.
4. In Supabase **SQL Editor**, run:

```sql
update public.profiles
set is_active = true,
    role = 'admin',
    updated_at = now()
where email = 'YOUR_GOOGLE_EMAIL';
```

5. Sign out and sign in again.

For another employee, repeat the update with role `accountant` or `viewer`. Never activate an unknown account.

## 5. Import Formulario 29

Run the safe dry-run first:

```powershell
npm run import:f29 -- "C:\Users\neto_\Downloads\Formulario 29.xlsx" --out=reports\f29-real-dry-run.json
```

Review the sanitized report. Then write to Supabase:

```powershell
npm run import:f29 -- "C:\Users\neto_\Downloads\Formulario 29.xlsx" --commit --out=reports\f29-import-committed.json
```

The importer uses the server-only key, ignores password/certificate columns, and upserts clients by RUT plus F29 periods by client/year/month.

## 6. Configure Netlify

In **Netlify** → **Site configuration** → **Environment variables**, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Trigger a new deploy after setting build-time `VITE_` variables. Keep the server-only key scoped to server functions and never expose it as a `VITE_` variable.

## 7. Configure Google Drive later

Drive scanning additionally needs a Google Cloud service account with the Drive API enabled:

1. Create a service account and JSON key.
2. Store the compact one-line JSON as Netlify's `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Share each client folder with the service account email as Viewer.
4. Save the folder ID in `clients.drive_folder_id`.

Do not commit the service-account JSON.

## 8. Verification checklist

- An inactive Google user sees the approval-required screen and cannot read client data.
- An active employee can open `/control` and `/f29/2026/05`.
- `profiles`, `clients`, and `f29_periods` show RLS enabled.
- No credential/password columns exist in Supabase.
- The F29 import count matches the dry-run report.
- Browser source contains only the publishable key, never the secret/service-role key.

Official references: [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), and [API keys](https://supabase.com/docs/guides/api/api-keys).
