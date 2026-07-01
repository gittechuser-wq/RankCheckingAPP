import * as XLSX from "xlsx";
import { ParsedSheet, SheetRow, WorkbookInput } from "../types";

export async function parseWorkbookFiles(
  sourceFile?: File | null,
  destinationFile?: File | null,
  singleWorkbook?: File | null,
): Promise<WorkbookInput> {
  if (singleWorkbook) {
    const workbook = await readWorkbook(singleWorkbook);
    if (workbook.SheetNames.length < 2) {
      throw new Error("Single workbook upload must contain at least two sheets: Source and Destination.");
    }

    return {
      source: parseWorksheet(workbook, workbook.SheetNames[0]),
      destination: parseWorksheet(workbook, workbook.SheetNames[1]),
    };
  }

  if (!sourceFile || !destinationFile) {
    throw new Error("Upload a single workbook or provide both Source and Destination files.");
  }

  const [sourceWorkbook, destinationWorkbook] = await Promise.all([
    readWorkbook(sourceFile),
    readWorkbook(destinationFile),
  ]);

  return {
    source: parseWorksheet(sourceWorkbook, sourceWorkbook.SheetNames[0]),
    destination: parseWorksheet(destinationWorkbook, destinationWorkbook.SheetNames[0]),
  };
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

function parseWorksheet(workbook: XLSX.WorkBook, sheetName: string): ParsedSheet {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" was not found.`);
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(worksheet, {
    defval: "",
    raw: false,
  });

  const headerRows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  const headers = (headerRows[0] ?? []).map((header) => String(header).trim()).filter(Boolean);

  return {
    name: sheetName,
    headers,
    rows,
  };
}
