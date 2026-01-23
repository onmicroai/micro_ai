import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migratePhasesToElements, normalizeAppJsonToV2 } from '../../frontend/src/utils/migrateAppJson';

type ValidationIssue = {
  code: string;
  message: string;
};

type AppResult = {
  id: string;
  status: 'ok' | 'error';
  errors: ValidationIssue[];
};

type Report = {
  generatedAt: string;
  input: {
    csvPath?: string;
    jsonPath?: string;
    idColumn: string;
    jsonColumn: string;
  };
  summary: {
    total: number;
    ok: number;
    error: number;
    errorsByCode: Record<string, number>;
  };
  apps: AppResult[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultCsvPath = path.resolve(__dirname, '..', 'resources', 'apps-dev.csv');
const defaultReportPath = path.resolve(__dirname, '..', 'reports', 'migration-report.json');

const KNOWN_ELEMENT_TYPES = new Set([
  'text',
  'textarea',
  'radio',
  'checkbox',
  'dropdown',
  'slider',
  'boolean',
  'richText',
  'chat',
  'imageUpload',
  'prompt',
  'aiInstructions',
  'fixedResponse',
  'title',
  'aiResponse',
  'scoring',
]);

const NON_FIELD_TYPES = new Set([
  'title',
  'aiResponse',
  'fixedResponse',
  'scoring',
  'prompt',
  'aiInstructions',
]);

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  return {
    csvPath: getArg('--csv') ?? defaultCsvPath,
    jsonPath: getArg('--json'),
    idColumn: getArg('--id-column') ?? 'id',
    jsonColumn: getArg('--json-column') ?? 'app_json',
    outPath: getArg('--out') ?? defaultReportPath,
  };
};

const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === ',' || char === '\n' || char === '\r')) {
      currentRow.push(currentField);
      currentField = '';

      if (char === '\n' || (char === '\r' && nextChar !== '\n')) {
        if (currentRow.length > 1 || currentRow.some(cell => cell.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      }
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
};

const extractPlaceholders = (text: string): string[] => {
  const placeholders: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    placeholders.push(match[1]);
    match = regex.exec(text);
  }

  return placeholders;
};

const collectFieldKeys = (elements: any[]): Set<string> => {
  const keys = new Set<string>();
  elements.forEach(element => {
    if (!element || NON_FIELD_TYPES.has(element.type)) return;
    if (typeof element.id === 'string') keys.add(element.id);
    if (typeof element.name === 'string') keys.add(element.name);
  });
  return keys;
};

const validateApp = (appJson: any, id: string): AppResult => {
  const errors: ValidationIssue[] = [];
  let normalized: any;

  try {
    normalized = normalizeAppJsonToV2(appJson);
  } catch (error: any) {
    errors.push({
      code: 'migration_throw',
      message: `normalizeAppJsonToV2 threw: ${String(error?.message ?? error)}`,
    });
    return { id, status: 'error', errors };
  }

  if (!Array.isArray(normalized.elements)) {
    errors.push({ code: 'elements_not_array', message: 'elements is not an array' });
  }

  if (Array.isArray(normalized.elements)) {
    normalized.elements.forEach((element: any, idx: number) => {
      if (element == null) {
        errors.push({ code: 'null_element', message: `element at index ${idx} is null/undefined` });
      }
      if (element && !KNOWN_ELEMENT_TYPES.has(element.type)) {
        errors.push({
          code: 'unknown_element_type',
          message: `element ${element.id ?? idx} has unknown type ${String(element.type)}`,
        });
      }
    });
  }

  try {
    JSON.stringify(normalized);
  } catch (error: any) {
    errors.push({
      code: 'json_not_serializable',
      message: `JSON.stringify failed: ${String(error?.message ?? error)}`,
    });
  }

  if (Array.isArray(appJson?.phases)) {
    const expected = migratePhasesToElements(appJson);
    if (JSON.stringify(expected.elements) !== JSON.stringify(normalized.elements)) {
      errors.push({
        code: 'ordering_mismatch',
        message: 'normalized elements do not match deterministic migration order',
      });
    }

    const inputFields: any[] = [];
    appJson.phases.forEach((phase: any) => {
      const fields = Array.isArray(phase?.elements) && phase.elements.length > 0
        ? phase.elements
        : Array.isArray(phase?.fields)
          ? phase.fields
          : [];
      inputFields.push(...fields);

      if (phase?.title) {
        const exists = normalized.elements?.some(
          (el: any) => el?.type === 'title' && (el?.text === phase.title || el?.label === phase.title),
        );
        if (!exists) {
          errors.push({
            code: 'phase_title_missing',
            message: `phase title "${phase.title}" missing`,
          });
        }
      }

      if (phase?.description) {
        const exists = normalized.elements?.some(
          (el: any) =>
            el?.type === 'title' &&
            (el?.text === phase.description || el?.label === phase.description),
        );
        if (!exists) {
          errors.push({
            code: 'phase_description_missing',
            message: `phase description missing`,
          });
        }
      }
    });

    inputFields.forEach(field => {
      if (!field) return;
      const match = normalized.elements?.some(
        (el: any) =>
          (field.id && el?.id === field.id) ||
          (field.name && el?.name === field.name),
      );
      if (!match) {
        errors.push({
          code: 'field_missing',
          message: `field missing in elements (id: ${String(field?.id ?? 'n/a')}, name: ${String(field?.name ?? 'n/a')})`,
        });
      }
    });
  }

  if (Array.isArray(normalized.elements)) {
    const fieldKeys = collectFieldKeys(normalized.elements);
    normalized.elements.forEach((element: any) => {
      if (!element) return;
      const texts: string[] = [];
      if (typeof element.text === 'string') texts.push(element.text);
      if (Array.isArray(element.instructions)) {
        element.instructions.forEach((instruction: any) => {
          if (typeof instruction?.text === 'string') texts.push(instruction.text);
        });
      }

      texts.forEach(text => {
        const placeholders = extractPlaceholders(text);
        placeholders.forEach(placeholder => {
          if (!fieldKeys.has(placeholder)) {
            errors.push({
              code: 'unknown_placeholder',
              message: `unknown placeholder "{${placeholder}}" in element ${String(element.id ?? element.name ?? 'unknown')}`,
            });
          }
        });
      });
    });
  }

  return { id, status: errors.length > 0 ? 'error' : 'ok', errors };
};

const readCsvApps = async (csvPath: string, idColumn: string, jsonColumn: string) => {
  const raw = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCsv(raw);
  if (rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map(h => h.trim());
  const idIndex = headers.indexOf(idColumn);
  const jsonIndex = headers.indexOf(jsonColumn);

  if (idIndex === -1 || jsonIndex === -1) {
    throw new Error(`CSV missing required columns: ${idColumn}, ${jsonColumn}`);
  }

  return dataRows.map((row, idx) => ({
    id: row[idIndex] ?? String(idx + 1),
    appJsonRaw: row[jsonIndex],
  }));
};

const readJsonApps = async (jsonPath: string) => {
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('JSON must be an array of app records');
  }
  return data.map((item: any, idx: number) => ({
    id: String(item?.id ?? idx + 1),
    appJson: item?.app_json ?? item?.appJson ?? item,
  }));
};

const main = async () => {
  const { csvPath, jsonPath, idColumn, jsonColumn, outPath } = parseArgs(process.argv);
  const apps: { id: string; appJson: any }[] = [];
  const input = { csvPath: undefined as string | undefined, jsonPath: undefined as string | undefined, idColumn, jsonColumn };

  if (jsonPath) {
    input.jsonPath = jsonPath;
    const records = await readJsonApps(jsonPath);
    records.forEach(record => apps.push({ id: record.id, appJson: record.appJson }));
  } else {
    input.csvPath = csvPath;
    const records = await readCsvApps(csvPath, idColumn, jsonColumn);
    records.forEach(record => {
      let parsed: any;
      try {
        parsed = JSON.parse(record.appJsonRaw);
      } catch (error: any) {
        apps.push({
          id: String(record.id),
          appJson: null,
        });
        return;
      }
      apps.push({ id: String(record.id), appJson: parsed });
    });
  }

  const results = apps.map(app => {
    if (app.appJson == null) {
      return {
        id: app.id,
        status: 'error' as const,
        errors: [{ code: 'json_parse_error', message: 'Invalid app_json JSON' }],
      };
    }
    return validateApp(app.appJson, app.id);
  });

  const errorsByCode: Record<string, number> = {};
  results.forEach(result => {
    result.errors.forEach(error => {
      errorsByCode[error.code] = (errorsByCode[error.code] ?? 0) + 1;
    });
  });

  const report: Report = {
    generatedAt: new Date().toISOString(),
    input,
    summary: {
      total: results.length,
      ok: results.filter(r => r.status === 'ok').length,
      error: results.filter(r => r.status === 'error').length,
      errorsByCode,
    },
    apps: results,
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  process.stdout.write(
    `Wrote report to ${outPath}\nTotal: ${report.summary.total} | OK: ${report.summary.ok} | Errors: ${report.summary.error}\n`,
  );
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
