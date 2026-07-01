export function isValidGoogleSheetUrl(url: string): boolean {
  if (!url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("docs.google.com") && parsed.pathname.includes("/spreadsheets/");
  } catch {
    return false;
  }
}

export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}
