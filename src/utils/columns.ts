import { ColumnMapping, ParsedSheet, RequiredField } from "../types";

const REQUIRED_FIELDS: RequiredField[] = ["keyword", "position", "topRankingPage"];

const HEADER_ALIASES: Record<RequiredField, string[]> = {
  keyword: ["keyword", "keywords", "query", "search term", "search keyword"],
  position: ["position", "rank", "ranking", "current position", "google position"],
  topRankingPage: [
    "top ranking page",
    "top ranking url",
    "ranking page",
    "page",
    "url",
    "landing page",
  ],
};

export const requiredFields = REQUIRED_FIELDS;

export function normalizeKeyword(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function autoMapColumns(headers: string[]): Partial<ColumnMapping> {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return REQUIRED_FIELDS.reduce<Partial<ColumnMapping>>((mapping, field) => {
    const aliases = HEADER_ALIASES[field];
    const match = normalizedHeaders.find((header) => aliases.includes(header.normalized));
    if (match) {
      mapping[field] = match.original;
    }
    return mapping;
  }, {});
}

export function validateMapping(sheet: ParsedSheet, mapping: Partial<ColumnMapping>, label: string): string[] {
  const errors: string[] = [];

  if (sheet.rows.length === 0) {
    errors.push(`${label} sheet is empty.`);
  }

  for (const field of REQUIRED_FIELDS) {
    const mappedHeader = mapping[field];
    if (!mappedHeader) {
      errors.push(`${label} is missing ${fieldLabel(field)} column mapping.`);
      continue;
    }

    if (!sheet.headers.includes(mappedHeader)) {
      errors.push(`${label} mapped ${fieldLabel(field)} column was not found in the sheet.`);
    }
  }

  return errors;
}

export function fieldLabel(field: RequiredField): string {
  if (field === "topRankingPage") {
    return "Top Ranking Page";
  }

  return field.charAt(0).toUpperCase() + field.slice(1);
}
