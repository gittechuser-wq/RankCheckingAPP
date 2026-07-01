import * as XLSX from "xlsx";
import { CombinedKeywordRow, RankingResult, SeoKeywordRow, UrlKeywordExtraction } from "./types";

export function exportSeoReport(params: {
  keywordRows: SeoKeywordRow[];
  combinedRows: CombinedKeywordRow[];
  rankings: RankingResult[];
  extraction: UrlKeywordExtraction | null;
  format: "xlsx" | "csv";
}) {
  if (params.format === "csv") {
    downloadCsv("seo-keyword-research.csv", keywordRowsToSheetRows(params.keywordRows));
    return;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(keywordRowsToSheetRows(params.keywordRows)), "Location Keywords");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(combinedRowsToSheetRows(params.combinedRows)), "Combined Volume");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(params.rankings), "Ranking Check");

  if (params.extraction) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(extractionToSheetRows(params.extraction)),
      "URL Extraction",
    );
  }

  XLSX.writeFile(workbook, "seo-keyword-research-report.xlsx");
}

function keywordRowsToSheetRows(rows: SeoKeywordRow[]) {
  return rows.map((row) => ({
    Keyword: row.keyword,
    "Location/Country": row.location,
    Language: row.language,
    "Search Volume": row.searchVolume,
    "Combined Search Volume": row.combinedSearchVolume,
    "Keyword Difficulty": row.keywordDifficulty,
    CPC: row.cpc,
    Competition: row.competition,
    "Search Intent": row.intent,
    Trend: row.trend.join(", "),
    "Long-tail Keywords": row.longTailKeywords.join(", "),
    "Related Keywords": row.relatedKeywords.join(", "),
    "Question Keywords": row.questionKeywords.join(", "),
    "SERP Features": row.serpFeatures.join(", "),
    "Priority Score": row.priorityScore,
    Source: row.source,
  }));
}

function combinedRowsToSheetRows(rows: CombinedKeywordRow[]) {
  return rows.map((row) => ({
    Keyword: row.keyword,
    "Combined Search Volume": row.totalSearchVolume,
    "Location-wise Volume": Object.entries(row.locations).map(([location, volume]) => `${location}: ${volume}`).join("; "),
    "Average Difficulty": row.avgDifficulty,
    "Average CPC": row.avgCpc,
    Intent: row.intent,
    "Priority Score": row.priorityScore,
  }));
}

function extractionToSheetRows(extraction: UrlKeywordExtraction) {
  return [
    { Type: "Suggested Keywords", Values: extraction.suggestedKeywords.join(", ") },
    { Type: "Existing Ranking Keywords", Values: extraction.existingRankingKeywords.join(", ") },
    { Type: "Missing Keyword Opportunities", Values: extraction.missingKeywordOpportunities.join(", ") },
    { Type: "Content Gaps", Values: extraction.contentGaps.join(", ") },
  ];
}

function downloadCsv(fileName: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
