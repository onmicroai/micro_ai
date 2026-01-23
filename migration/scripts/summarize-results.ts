import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Report = {
  generatedAt: string;
  summary: {
    total: number;
    ok: number;
    error: number;
    errorsByCode: Record<string, number>;
  };
  apps: {
    id: string;
    status: 'ok' | 'error';
    errors: { code: string; message: string }[];
  }[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultReportPath = path.resolve(__dirname, '..', 'reports', 'migration-report.json');

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    reportPath: getArg('--report') ?? defaultReportPath,
  };
};

const main = async () => {
  const { reportPath } = parseArgs(process.argv);
  const raw = await fs.readFile(reportPath, 'utf-8');
  const report = JSON.parse(raw) as Report;

  const topErrors = Object.entries(report.summary.errorsByCode)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const sampleFailures = report.apps
    .filter(app => app.status === 'error')
    .slice(0, 5)
    .map(app => ({
      id: app.id,
      codes: Array.from(new Set(app.errors.map(err => err.code))),
    }));

  process.stdout.write(`Report: ${reportPath}\n`);
  process.stdout.write(`Generated: ${report.generatedAt}\n`);
  process.stdout.write(`Total: ${report.summary.total}\n`);
  process.stdout.write(`OK: ${report.summary.ok}\n`);
  process.stdout.write(`Errors: ${report.summary.error}\n`);

  process.stdout.write('\nTop error codes:\n');
  if (topErrors.length === 0) {
    process.stdout.write('  (none)\n');
  } else {
    topErrors.forEach(([code, count]) => {
      process.stdout.write(`  ${code}: ${count}\n`);
    });
  }

  process.stdout.write('\nSample failures:\n');
  if (sampleFailures.length === 0) {
    process.stdout.write('  (none)\n');
  } else {
    sampleFailures.forEach(sample => {
      process.stdout.write(`  ${sample.id}: ${sample.codes.join(', ')}\n`);
    });
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
