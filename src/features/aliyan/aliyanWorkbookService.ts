import * as XLSX from "xlsx";

export interface AliyanWorkbook {
  workbook: XLSX.WorkBook;
  sheetName: string;
  worksheet: XLSX.WorkSheet;
  headers: string[];
  productHeader: string;
  strengthHeader: string;
  urlHeader: string;
  commentHeader: string;
  rowNumbers: number[];
}

export async function loadAliyanWorkbook(file: File): Promise<AliyanWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = findProductSheet(workbook.SheetNames);
  if (!sheetName) throw new Error('A product sheet was not found. Name the worksheet "Products" or "Product Sheet".');
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c + index })];
    return String(cell?.w ?? cell?.v ?? "").trim();
  });

  const productHeader = findHeader(headers, ["product name", "product", "product names", "name"]);
  const strengthHeader = findHeader(headers, ["strength / pack", "strength/pack", "strength pack"]);
  if (!productHeader || !strengthHeader) {
    throw new Error('Required headers were not found. The sheet needs a product-name column and "Strength / Pack".');
  }

  const urlHeader = ensureHeader(worksheet, headers, range.s.r, "Product Page URL - Aliyan");
  const commentHeader = ensureHeader(worksheet, headers, range.s.r, "Comment");
  // Excel's !ref often includes empty rows because of formatting or previously used
  // cells. The processing worklist must be based only on actual Product Name values.
  const productColumn = headers.indexOf(productHeader);
  const rowNumbers: number[] = [];
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    if (worksheet["!rows"]?.[row]?.hidden) continue;
    const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: productColumn })];
    if (String(cell?.w ?? cell?.v ?? "").trim()) {
      rowNumbers.push(row);
    }
  }

  return { workbook, sheetName, worksheet, headers, productHeader, strengthHeader, urlHeader, commentHeader, rowNumbers };
}

function findProductSheet(sheetNames: string[]): string | undefined {
  const normalized = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
  return sheetNames.find((name) => /^(products?|product sheet)$/.test(normalized(name)))
    ?? sheetNames.find((name) => normalized(name).includes("product"));
}

export function getCellValue(data: AliyanWorkbook, row: number, header: string): string {
  const column = data.headers.indexOf(header);
  const cell = data.worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
  return String(cell?.w ?? cell?.v ?? "").trim();
}

export function setCellValue(data: AliyanWorkbook, row: number, header: string, value: string): void {
  const column = data.headers.indexOf(header);
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const previous = data.worksheet[address];
  data.worksheet[address] = { ...(previous ?? {}), t: "s", v: value, w: value };
}

export function downloadAliyanWorkbook(data: AliyanWorkbook, originalName: string): void {
  const outputName = originalName.replace(/(\.xlsx?)$/i, "_aliyan_updated$1");
  XLSX.writeFile(data.workbook, outputName);
}

function findHeader(headers: string[], names: string[]): string | undefined {
  return headers.find((header) => names.includes(header.toLowerCase().replace(/\s+/g, " ")));
}

function ensureHeader(worksheet: XLSX.WorkSheet, headers: string[], headerRow: number, name: string): string {
  const existing = headers.find((header) => header.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const column = headers.length;
  const address = XLSX.utils.encode_cell({ r: headerRow, c: column });
  worksheet[address] = { t: "s", v: name, w: name };
  headers.push(name);
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  range.e.c = Math.max(range.e.c, column);
  worksheet["!ref"] = XLSX.utils.encode_range(range);
  return name;
}
