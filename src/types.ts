export type InputMode = "excel" | "google";

export type RequiredField = "keyword" | "position" | "topRankingPage";

export type ColumnMapping = Record<RequiredField, string>;

export type SheetRow = Record<string, string | number | boolean | Date | null | undefined>;

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: SheetRow[];
}

export interface WorkbookInput {
  source: ParsedSheet;
  destination: ParsedSheet;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
}

export interface NotFoundRecord {
  keyword: string;
  reason: string;
}

export interface ProgressState {
  processed: number;
  total: number;
  percent: number;
}

export interface ProcessingSummary {
  totalKeywords: number;
  matched: number;
  notFound: number;
  rowsUpdated: number;
  processingTimeSeconds: number;
  successRate: number;
}

export interface ProcessingResult {
  updatedDestination: ParsedSheet;
  notFound: NotFoundRecord[];
  summary: ProcessingSummary;
}

export interface GoogleSheetRequest {
  sourceUrl: string;
  destinationUrl: string;
  sheetName?: string;
}
