# Renta / F22 AT 2026

## 1. Apply the database migration

Open the Supabase SQL Editor, paste the complete contents of:

`supabase/migrations/20260618_add_f22_periods.sql`

Run it once. The migration is additive and idempotent: it creates `f22_periods`, adds `f29_enabled` / `f22_enabled` client flags, enables RLS, and links annual changes to `activity_log`.

## 2. Preview the workbook import

```powershell
npm run import:f22 -- "C:\Users\neto_\Downloads\RENTA AT 2026.xlsx"
```

Expected AT 2026 summary:

- 705 unique clients
- 214 detailed 14A / 14D-N3 rows
- 210 BCE dates loaded
- 475 F22 sent
- 73 DJ 1948 sent

## 3. Commit the sanitized import

```powershell
npm run import:f22:commit -- "C:\Users\neto_\Downloads\RENTA AT 2026.xlsx"
```

The importer never stores or reports values from `CLAVE`, bank, current-account, spreadsheet-ID, or folder-ID columns. Existing F29 clients are matched by a canonical RUT key; Renta-only clients are created with F29 disabled.
