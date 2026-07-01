import * as XLSX from "xlsx";
import { LogEntry, NotFoundRecord, ParsedSheet } from "../types";

export function downloadUpdatedDestination(sheet: ParsedSheet): void {
  const worksheet = XLSX.utils.json_to_sheet(sheet.rows, { header: sheet.headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name || "Destination");
  XLSX.writeFile(workbook, "updated_destination.xlsx");
}

export function downloadNotFoundReport(records: NotFoundRecord[]): void {
  const worksheet = XLSX.utils.json_to_sheet(records.map((record) => ({
    Keyword: record.keyword,
    Reason: record.reason,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Not Found");
  XLSX.writeFile(workbook, "not_found_keywords.xlsx");
}

export function downloadLogs(logs: LogEntry[]): void {
  const content = formatLogs(logs);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "process_log.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatLogs(logs: LogEntry[]): string {
  return logs.map((log) => `[${log.timestamp}] ${log.message}`).join("\n");
}
