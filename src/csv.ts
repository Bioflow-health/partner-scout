const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;
const BOM = "\uFEFF";
const CRLF = "\r\n";

export const csvCell = (value: string): string => {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const toCsv = (rows: readonly (readonly string[])[]): string =>
  BOM + rows.map((row) => row.map(csvCell).join(",") + CRLF).join("");
