import { GoogleSheetRequest, ParsedSheet, WorkbookInput } from "../types";
import { extractSpreadsheetId, isValidGoogleSheetUrl } from "../utils/validation";

const DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
    gapi?: {
      load: (name: string, callback: () => void) => void;
      client: {
        init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        setToken: (token: { access_token: string }) => void;
        sheets: {
          spreadsheets: {
            values: {
              get: (request: { spreadsheetId: string; range: string }) => Promise<{ result: { values?: string[][] } }>;
              update: (request: {
                spreadsheetId: string;
                range: string;
                valueInputOption: "USER_ENTERED" | "RAW";
                resource: { values: unknown[][] };
              }) => Promise<unknown>;
            };
          };
        };
      };
    };
  }
}

export function validateGoogleSheetRequest(request: GoogleSheetRequest): string[] {
  const errors: string[] = [];

  if (!isValidGoogleSheetUrl(request.sourceUrl)) {
    errors.push("Enter a valid Source Google Sheet URL.");
  }

  if (!isValidGoogleSheetUrl(request.destinationUrl)) {
    errors.push("Enter a valid Destination Google Sheet URL.");
  }

  return errors;
}

export async function readGoogleSheets(request: GoogleSheetRequest): Promise<WorkbookInput> {
  const sourceId = extractSpreadsheetId(request.sourceUrl);
  const destinationId = extractSpreadsheetId(request.destinationUrl);

  if (!sourceId || !destinationId) {
    throw new Error("Could not read one or both spreadsheet IDs from the provided URLs.");
  }

  await initializeGoogleClient();
  const range = request.sheetName?.trim() || "Sheet1";

  const [sourceResponse, destinationResponse] = await Promise.all([
    window.gapi!.client.sheets.spreadsheets.values.get({ spreadsheetId: sourceId, range }),
    window.gapi!.client.sheets.spreadsheets.values.get({ spreadsheetId: destinationId, range }),
  ]);

  return {
    source: valuesToParsedSheet(request.sheetName || "Source", sourceResponse.result.values ?? []),
    destination: valuesToParsedSheet(request.sheetName || "Destination", destinationResponse.result.values ?? []),
  };
}

export async function updateGoogleDestination(
  destinationUrl: string,
  sheetName: string | undefined,
  updatedSheet: ParsedSheet,
): Promise<void> {
  const destinationId = extractSpreadsheetId(destinationUrl);
  if (!destinationId) {
    throw new Error("Could not read the destination spreadsheet ID from the provided URL.");
  }

  await initializeGoogleClient();
  const values = [
    updatedSheet.headers,
    ...updatedSheet.rows.map((row) => updatedSheet.headers.map((header) => row[header] ?? "")),
  ];

  await window.gapi!.client.sheets.spreadsheets.values.update({
    spreadsheetId: destinationId,
    range: sheetName?.trim() || updatedSheet.name || "Sheet1",
    valueInputOption: "USER_ENTERED",
    resource: { values },
  });
}

async function initializeGoogleClient(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

  if (!clientId || !apiKey) {
    throw new Error("Google Sheets mode requires VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY.");
  }

  await Promise.all([
    loadScript("https://apis.google.com/js/api.js", "google-api-script"),
    loadScript("https://accounts.google.com/gsi/client", "google-identity-script"),
  ]);

  await new Promise<void>((resolve) => window.gapi!.load("client", resolve));
  await window.gapi!.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] });

  const token = await new Promise<string>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || "Google OAuth did not return an access token."));
          return;
        }
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken();
  });

  window.gapi!.client.setToken({ access_token: token });
}

function loadScript(src: string, id: string): Promise<void> {
  const existing = document.getElementById(id);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function valuesToParsedSheet(name: string, values: string[][]): ParsedSheet {
  const headers = (values[0] ?? []).map((header) => String(header).trim()).filter(Boolean);
  const rows = values.slice(1).map((row) =>
    headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = row[index] ?? "";
      return record;
    }, {}),
  );

  return { name, headers, rows };
}
