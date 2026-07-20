#!/usr/bin/env node
import { parseBackupImportArgs, runBackupImport, writeImportReport } from "./backupImporter";

async function main() {
  try {
    const args = parseBackupImportArgs(process.argv.slice(2));
    const result = await runBackupImport(args);
    writeImportReport(result.report, args.reportPath);
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
    process.exit(result.code);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

void main();
