# Migration Validation (v2)

This folder contains data-driven scripts to validate the v2 app schema migration using real app JSON from a CSV or JSON dump. These scripts are meant for exploratory validation (not CI).

## Folder structure

- `scripts/` - validation scripts
- `resources/` - input data (gitignored)
- `reports/` - output reports (gitignored but shareable)

## CSV format

Default column names:

- `id` - app id
- `app_json` - JSON string for the app

If your columns differ, pass `--id-column` and `--json-column`.

## Usage

From `frontend/`:

```bash
node --test --import tsx tests/migrateAppJson.test.ts
```

```bash
npx tsx ../migration/scripts/validate-migration.ts \
  --csv ../migration/resources/apps-dev.csv \
  --id-column id \
  --json-column app_json \
  --out ../migration/reports/migration-report.json
```

```bash
npx tsx ../migration/scripts/summarize-results.ts \
  --report ../migration/reports/migration-report.json
```

## JSON input alternative

If you have a JSON dump instead of CSV:

```bash
npx tsx ../migration/scripts/validate-migration.ts \
  --json ../migration/resources/apps-dev.json \
  --out ../migration/reports/migration-report.json
```

The JSON file should be an array of objects containing either:

- `{ id, app_json }`
- `{ id, appJson }`
- raw app JSON objects (id will be inferred from index)
