import { ColumnMapping, LogEntry, ParsedSheet, ProcessingResult, ProgressState } from "../types";
import { normalizeKeyword } from "../utils/columns";

interface ProcessOptions {
  source: ParsedSheet;
  destination: ParsedSheet;
  sourceMapping: ColumnMapping;
  destinationMapping: ColumnMapping;
  batchSize?: number;
  onProgress: (progress: ProgressState) => void;
  onLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
}

export async function processKeywordMapping({
  source,
  destination,
  sourceMapping,
  destinationMapping,
  batchSize = 500,
  onProgress,
  onLog,
}: ProcessOptions): Promise<ProcessingResult> {
  const startedAt = performance.now();
  const destinationRows = destination.rows.map((row) => ({ ...row }));
  const destinationIndex = new Map<string, number>();
  const notFound = [];
  let matched = 0;
  let rowsUpdated = 0;

  onLog({ level: "info", message: "Reading Source Sheet..." });
  onLog({ level: "info", message: "Reading Destination Sheet..." });
  onLog({ level: "info", message: "Building destination keyword lookup..." });

  destinationRows.forEach((row, index) => {
    const key = normalizeKeyword(row[destinationMapping.keyword]);
    if (key && !destinationIndex.has(key)) {
      destinationIndex.set(key, index);
    }
  });

  for (let index = 0; index < source.rows.length; index += 1) {
    const sourceRow = source.rows[index];
    const rawKeyword = sourceRow[sourceMapping.keyword];
    const keyword = String(rawKeyword ?? "").trim();
    const lookupKey = normalizeKeyword(rawKeyword);

    if (!lookupKey) {
      notFound.push({ keyword: "", reason: "Blank keyword in source row." });
      onLog({ level: "warning", message: "Not Found: blank keyword in source row" });
    } else {
      const destinationIndexMatch = destinationIndex.get(lookupKey);

      if (destinationIndexMatch === undefined) {
        notFound.push({ keyword, reason: "Keyword not found in destination sheet." });
        onLog({ level: "warning", message: `Not Found: "${keyword}"` });
      } else {
        const destinationRow = destinationRows[destinationIndexMatch];
        destinationRow[destinationMapping.position] = sourceRow[sourceMapping.position];
        destinationRow[destinationMapping.topRankingPage] = sourceRow[sourceMapping.topRankingPage];
        matched += 1;
        rowsUpdated += 1;
        onLog({ level: "success", message: `Found: "${keyword}"` });
        onLog({ level: "info", message: `Updated Position = ${sourceRow[sourceMapping.position] ?? ""}` });
        onLog({ level: "info", message: "Updated URL" });
      }
    }

    if ((index + 1) % batchSize === 0 || index + 1 === source.rows.length) {
      onProgress({
        processed: index + 1,
        total: source.rows.length,
        percent: source.rows.length === 0 ? 0 : Math.round(((index + 1) / source.rows.length) * 100),
      });
      await yieldToBrowser();
    }
  }

  const processingTimeSeconds = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
  const successRate = source.rows.length === 0 ? 0 : Math.round((matched / source.rows.length) * 100);

  onLog({ level: "success", message: "Processing completed." });

  return {
    updatedDestination: {
      ...destination,
      rows: destinationRows,
    },
    notFound,
    summary: {
      totalKeywords: source.rows.length,
      matched,
      notFound: notFound.length,
      rowsUpdated,
      processingTimeSeconds,
      successRate,
    },
  };
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
