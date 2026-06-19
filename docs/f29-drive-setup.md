# F29 and Google Drive operations

## Environment variables

The browser uses only the two `VITE_SUPABASE_*` variables. Netlify Functions additionally require:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

`GOOGLE_SERVICE_ACCOUNT_JSON` must contain the complete Google Cloud service-account JSON on one line. It is a server-only value and must never use a `VITE_` prefix.

## Google Drive permissions

Share each client folder with the service account's `client_email` as a viewer. The Drive scanner is read-only and stores file metadata in Supabase; the files remain in Google Drive.

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
