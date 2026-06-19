# F29 and Google Drive operations

## Authentication

Drive scanning uses the logged-in employee's Google OAuth authorization. Downloadable service-account keys and API keys are not required.

The browser uses:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Netlify Functions use:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The Google OAuth client configured in Supabase must belong to a Google Cloud project where the Google Drive API is enabled. The app requests the read-only Drive scope during Google login.

## Google Drive permissions

Share the client folders with the employee Google accounts that will use the control center. The backend validates that the Google token email matches the authenticated Supabase employee before reading a folder.

Existing employees must sign out and sign in once after this update to approve the new read-only Drive permission. If authorization expires or is missing, the Documents tab displays **Autorizar Google Drive**.

Drive tokens are sent only to the Netlify Function for the current scan. They are not stored in Supabase, document metadata, or activity logs.

## Import folder IDs

Preview matches without changing Supabase:

```powershell
npm run import:drive-folders -- "C:\path\Visor Contabilidad.csv"
```

Commit exact matches:

```powershell
npm run import:drive-folders:commit -- "C:\path\Visor Contabilidad.csv"
```

The importer ignores rows without folder IDs and does not create clients for unmatched RUTs.

## Operational behavior

- Editing an existing F29 row updates it and adds an activity entry.
- Editing a client without an F29 row creates the missing monthly period automatically.
- Amounts and observations save on blur or Enter to avoid one audit entry per keystroke.
- Drive scans upsert metadata by Google `drive_file_id`, preventing duplicates.
- Document classification and client observations also create activity entries.
