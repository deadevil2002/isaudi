import { parse } from 'csv-parse/sync';

const ALLOWED_CSV_MIME_TYPES = new Set([
  '',
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
]);
const DANGEROUS_HEADERS = new Set(['__proto__', 'prototype', 'constructor']);
const FORMULA_PREFIX = /^[=+\-@]/;

export class InvalidCsvUploadError extends Error {}

export function neutralizeSpreadsheetFormula(value: string): string {
  return FORMULA_PREFIX.test(value.trimStart()) ? `'${value}` : value;
}

export function validateCsvFileMetadata(name: string, type: string): void {
  const normalizedName = name.trim().toLowerCase();
  if (!/^[^/\\\0]+\.csv$/.test(normalizedName) || normalizedName.slice(0, -4).includes('.')) {
    throw new InvalidCsvUploadError('Only .csv files are accepted');
  }
  if (!ALLOWED_CSV_MIME_TYPES.has(type.trim().toLowerCase())) {
    throw new InvalidCsvUploadError('File content type must be CSV or plain text');
  }
}

export function decodeCsv(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidCsvUploadError('CSV must be valid UTF-8 text');
  }
  if (text.includes('\0')) {
    throw new InvalidCsvUploadError('CSV contains invalid binary content');
  }
  return text.replace(/^\uFEFF/, '');
}

export function parseCsvText(text: string): string[][] {
  let rows: unknown;
  try {
    rows = parse(text, {
      relax_quotes: false,
      relax_column_count: true,
      skip_empty_lines: true,
      max_record_size: 1024 * 1024,
    });
  } catch {
    throw new InvalidCsvUploadError('Malformed CSV');
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 100_000) {
    throw new InvalidCsvUploadError('CSV is empty or has too many rows');
  }
  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0 || row.length > 256) {
      throw new InvalidCsvUploadError('CSV has an invalid column count');
    }
  }
  return (rows as unknown[][]).map((row) =>
    row.map((value: unknown) => neutralizeSpreadsheetFormula(String(value)))
  );
}

export function validateCsvTable(rows: string[][], headerIndex: number): void {
  const headers = rows[headerIndex]?.map((header) => header.trim().toLowerCase());
  if (!headers?.length || headers.some((header) => !header || DANGEROUS_HEADERS.has(header))) {
    throw new InvalidCsvUploadError('CSV contains invalid headers');
  }
  if (new Set(headers).size !== headers.length) {
    throw new InvalidCsvUploadError('CSV contains duplicate headers');
  }
  for (const row of rows.slice(headerIndex + 1)) {
    if (row.length !== headers.length) {
      throw new InvalidCsvUploadError('CSV rows must match the header column count');
    }
  }
}

export function csvRecord(headers: string[], row: string[]): Record<string, string> {
  const record = Object.create(null) as Record<string, string>;
  row.forEach((value, index) => {
    record[headers[index] || `col${index}`] = value;
  });
  return record;
}