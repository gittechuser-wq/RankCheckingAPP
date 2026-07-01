import { ChangeEvent, useRef, useState } from "react";
import { Download, FileSpreadsheet, Play, Square } from "lucide-react";
import { findAliyanProduct } from "./aliyanProductService";
import {
  AliyanWorkbook,
  downloadAliyanWorkbook,
  getCellValue,
  loadAliyanWorkbook,
  setCellValue,
} from "./aliyanWorkbookService";
import { AdminSettings } from "../admin/adminSettings";

interface RunSummary {
  matched: number;
  notFound: number;
  skipped: number;
}

export function AliyanProductMatcher({ settings }: { settings: AdminSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<AliyanWorkbook | null>(null);
  const [proxyUrl, setProxyUrl] = useState(settings.aliyan.defaultProxyUrl);
  const [status, setStatus] = useState("Select 58_Products_list.xlsx to begin.");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setData(null);
    setSummary(null);
    setProgress({ current: 0, total: 0 });
    if (!nextFile) return;
    try {
      const workbook = await loadAliyanWorkbook(nextFile);
      setData(workbook);
      setStatus(`Loaded ${nextFile.name}: ${workbook.rowNumbers.length} product rows from “${workbook.sheetName}”.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read the workbook.");
    }
  }

  async function processWorkbook() {
    if (!data || !file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setSummary(null);
    const totals = { matched: 0, notFound: 0, skipped: 0 };
    setProgress({ current: 0, total: data.rowNumbers.length });

    try {
      for (let index = 0; index < data.rowNumbers.length; index += 1) {
        if (controller.signal.aborted) throw new DOMException("Processing stopped by user.", "AbortError");
        const row = data.rowNumbers[index];
        const product = getCellValue(data, row, data.productHeader);
        const strength = getCellValue(data, row, data.strengthHeader);
        setProgress({ current: index + 1, total: data.rowNumbers.length });

        // rowNumbers is created from non-empty Product Name cells only. This guard
        // protects against an edited workbook while deliberately skipping blanks.
        if (!product) continue;
        if (!strength) {
          setCellValue(data, row, data.commentHeader, "MISSING STRENGTH / PACK");
          totals.skipped += 1;
          setStatus(`Row ${row + 1}: ${product} has no Strength / Pack.`);
          continue;
        }

        const match = await findAliyanProduct(product, strength, {
          proxyUrl,
          signal: controller.signal,
          onStatus: setStatus,
        });
        if (match) {
          setCellValue(data, row, data.urlHeader, match.url);
          setCellValue(data, row, data.commentHeader, "");
          totals.matched += 1;
          setStatus(`Matched ${product} (${strength}) using “${match.matchedQuery}”.`);
        } else {
          setCellValue(data, row, data.commentHeader, "NOT FOUND");
          totals.notFound += 1;
          setStatus(`No exact Strength / Pack match for ${product}; marked NOT FOUND.`);
        }
        // Gives React a chance to paint progress before the next network request.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      setSummary(totals);
      setStatus("Processing complete. Download the updated workbook below.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Processing stopped. Completed rows remain available for download.");
      } else {
        setStatus(error instanceof Error ? `Processing paused: ${error.message}` : "Processing failed.");
      }
    } finally {
      abortRef.current = null;
      setIsRunning(false);
    }
  }

  const percent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <main className="app-shell aliyan-tool">
      <section className="header-band">
        <div>
          <p className="eyebrow">{settings.modules.aliyan.eyebrow}</p>
          <h1>{settings.modules.aliyan.title}</h1>
          <p className="aliyan-intro">Every candidate is opened and its detail text is checked for the exact Strength / Pack before its product URL is written.</p>
        </div>
        <button className="primary-action" onClick={processWorkbook} disabled={!data || isRunning}>
          <Play size={18} /> Process products
        </button>
      </section>

      <section className="workspace-grid">
        <div className="control-panel">
          <div className="section-title"><FileSpreadsheet size={18} /><h2>Workbook</h2></div>
          <label className="field-label">
            <span>Products Excel file</span>
            <input type="file" accept=".xlsx,.xls" onChange={onFileChange} disabled={isRunning} />
            {file && <small>{file.name}</small>}
          </label>
          {data && <p className="aliyan-note">Detected: <strong>{data.productHeader}</strong> and <strong>{data.strengthHeader}</strong>. URL and Comment columns are created only when absent.</p>}
        </div>
        <div className="control-panel">
          <div className="section-title"><FileSpreadsheet size={18} /><h2>Website connection</h2></div>
          <label className="field-label">
            <span>Aliyan proxy URL</span>
            <input value={proxyUrl} onChange={(event) => setProxyUrl(event.target.value)} disabled={isRunning} />
          </label>
          <p className="aliyan-note">For Vite development leave <code>/aliyan-api</code>. A deployed app needs this path routed through its server to Aliyan Pharma.</p>
        </div>
      </section>

      <section className="status-grid">
        <div className="control-panel">
          <div className="section-title"><Play size={18} /><h2>Processing status</h2></div>
          <p className="aliyan-status" aria-live="polite">{status}</p>
          <div className="progress-row"><span>Progress: {percent}%</span><span>{progress.current} / {progress.total} products</span></div>
          <div className="progress-track"><div style={{ width: `${percent}%` }} /></div>
          {isRunning && <button className="stop-action" onClick={() => abortRef.current?.abort()}><Square size={16} /> Stop safely</button>}
        </div>
        <div className="control-panel">
          <div className="section-title"><Download size={18} /><h2>Updated Excel</h2></div>
          {summary ? <p className="aliyan-status">{summary.matched} matched · {summary.notFound} not found · {summary.skipped} skipped</p> : <p className="empty-state">The download becomes useful after at least one row is processed.</p>}
          <button className="secondary-action" onClick={() => data && file && downloadAliyanWorkbook(data, file.name)} disabled={!data || isRunning}>
            <Download size={17} /> Download updated workbook
          </button>
        </div>
      </section>
    </main>
  );
}
