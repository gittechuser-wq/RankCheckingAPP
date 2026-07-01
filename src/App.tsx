import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Link2,
  ListRestart,
  Play,
  Trash2,
} from "lucide-react";
import { parseWorkbookFiles } from "./services/excelService";
import { readGoogleSheets, updateGoogleDestination, validateGoogleSheetRequest } from "./services/googleSheetsService";
import { processKeywordMapping } from "./services/keywordProcessor";
import { ColumnMapping, InputMode, LogEntry, ParsedSheet, ProcessingResult, ProgressState, RequiredField, WorkbookInput } from "./types";
import { autoMapColumns, fieldLabel, requiredFields, validateMapping } from "./utils/columns";
import { downloadLogs, downloadNotFoundReport, downloadUpdatedDestination } from "./utils/downloads";

const emptyProgress: ProgressState = { processed: 0, total: 0, percent: 0 };

export function App() {
  const [mode, setMode] = useState<InputMode>("excel");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [destinationFile, setDestinationFile] = useState<File | null>(null);
  const [singleWorkbook, setSingleWorkbook] = useState<File | null>(null);
  const [googleSourceUrl, setGoogleSourceUrl] = useState("");
  const [googleDestinationUrl, setGoogleDestinationUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [workbook, setWorkbook] = useState<WorkbookInput | null>(null);
  const [sourceMapping, setSourceMapping] = useState<Partial<ColumnMapping>>({});
  const [destinationMapping, setDestinationMapping] = useState<Partial<ColumnMapping>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const logId = useRef(0);

  const canConfigureMapping = Boolean(workbook);
  const sourceHeaders = workbook?.source.headers ?? [];
  const destinationHeaders = workbook?.destination.headers ?? [];

  const addLog = (entry: Omit<LogEntry, "id" | "timestamp">) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-IN", { hour12: false });
    setLogs((current) => [
      ...current,
      {
        ...entry,
        id: String(logId.current++),
        timestamp,
      },
    ]);
  };

  const resolvedErrors = useMemo(() => {
    if (!workbook) {
      return errors;
    }

    return [
      ...errors,
      ...validateMapping(workbook.source, sourceMapping, "Source"),
      ...validateMapping(workbook.destination, destinationMapping, "Destination"),
    ];
  }, [destinationMapping, errors, sourceMapping, workbook]);

  async function loadData() {
    setIsBusy(true);
    setErrors([]);
    setResult(null);
    setProgress(emptyProgress);

    try {
      addLog({ level: "info", message: mode === "excel" ? "Loading Excel input..." : "Connecting to Google Sheets..." });
      const nextWorkbook =
        mode === "excel"
          ? await parseWorkbookFiles(sourceFile, destinationFile, singleWorkbook)
          : await loadGoogleData();

      setWorkbook(nextWorkbook);
      setSourceMapping(autoMapColumns(nextWorkbook.source.headers));
      setDestinationMapping(autoMapColumns(nextWorkbook.destination.headers));
      addLog({ level: "success", message: "Columns auto-mapped from headers." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load data.";
      setErrors([message]);
      addLog({ level: "error", message });
    } finally {
      setIsBusy(false);
    }
  }

  async function loadGoogleData(): Promise<WorkbookInput> {
    const request = { sourceUrl: googleSourceUrl, destinationUrl: googleDestinationUrl, sheetName };
    const validationErrors = validateGoogleSheetRequest(request);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(" "));
    }

    return readGoogleSheets(request);
  }

  async function runProcessing() {
    if (!workbook) {
      setErrors(["Load Source and Destination data before processing."]);
      return;
    }

    const validationErrors = [
      ...validateMapping(workbook.source, sourceMapping, "Source"),
      ...validateMapping(workbook.destination, destinationMapping, "Destination"),
    ];

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsBusy(true);
    setErrors([]);
    setResult(null);

    try {
      const processingResult = await processKeywordMapping({
        source: workbook.source,
        destination: workbook.destination,
        sourceMapping: sourceMapping as ColumnMapping,
        destinationMapping: destinationMapping as ColumnMapping,
        batchSize: 500,
        onProgress: setProgress,
        onLog: addLog,
      });

      if (mode === "google") {
        addLog({ level: "info", message: "Updating Destination Google Sheet..." });
        await updateGoogleDestination(googleDestinationUrl, sheetName, processingResult.updatedDestination);
        addLog({ level: "success", message: "Destination Google Sheet updated." });
      }

      setResult(processingResult);
      setWorkbook((current) =>
        current ? { ...current, destination: processingResult.updatedDestination } : current,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Processing failed.";
      setErrors([message]);
      addLog({ level: "error", message });
    } finally {
      setIsBusy(false);
    }
  }

  function updateMapping(kind: "source" | "destination", field: RequiredField, value: string) {
    const setter = kind === "source" ? setSourceMapping : setDestinationMapping;
    setter((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="app-shell">
      <section className="header-band">
        <div>
          <p className="eyebrow">Google Sheets Keyword Mapping Tool</p>
          <h1>Compare keyword sheets and update matching destination rows.</h1>
        </div>
        <button className="primary-action" onClick={runProcessing} disabled={isBusy || !workbook}>
          <Play size={18} />
          Process
        </button>
      </section>

      <section className="workspace-grid">
        <div className="control-panel">
          <SectionTitle icon={<FileSpreadsheet size={18} />} title="Source Selection" />
          <div className="segmented">
            <label>
              <input type="radio" checked={mode === "excel"} onChange={() => setMode("excel")} />
              Upload Excel Files
            </label>
            <label>
              <input type="radio" checked={mode === "google"} onChange={() => setMode("google")} />
              Google Sheets URLs
            </label>
          </div>

          {mode === "excel" ? (
            <ExcelInputs
              sourceFile={sourceFile}
              destinationFile={destinationFile}
              singleWorkbook={singleWorkbook}
              onSource={fileSetter(setSourceFile)}
              onDestination={fileSetter(setDestinationFile)}
              onSingle={fileSetter(setSingleWorkbook)}
            />
          ) : (
            <GoogleInputs
              sourceUrl={googleSourceUrl}
              destinationUrl={googleDestinationUrl}
              sheetName={sheetName}
              onSourceUrl={setGoogleSourceUrl}
              onDestinationUrl={setGoogleDestinationUrl}
              onSheetName={setSheetName}
            />
          )}

          <button className="secondary-action" onClick={loadData} disabled={isBusy}>
            <Link2 size={17} />
            Load Data
          </button>

          {resolvedErrors.length > 0 && (
            <div className="error-list">
              {resolvedErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}
        </div>

        <div className="control-panel">
          <SectionTitle icon={<ListRestart size={18} />} title="Mapping Information" />
          {canConfigureMapping ? (
            <div className="mapping-grid">
              <MappingEditor title="Source Columns" headers={sourceHeaders} mapping={sourceMapping} onChange={(field, value) => updateMapping("source", field, value)} />
              <MappingEditor title="Destination Columns" headers={destinationHeaders} mapping={destinationMapping} onChange={(field, value) => updateMapping("destination", field, value)} />
            </div>
          ) : (
            <p className="empty-state">Load workbook data to review auto-mapped columns and adjust headers.</p>
          )}
        </div>
      </section>

      <section className="status-grid">
        <ProgressPanel progress={progress} />
        <LogsPanel logs={logs} onDownload={() => downloadLogs(logs)} onClear={() => setLogs([])} />
      </section>

      {result && (
        <SummaryPanel
          result={result}
          destination={result.updatedDestination}
          logs={logs}
        />
      )}
    </main>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="section-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function ExcelInputs(props: {
  sourceFile: File | null;
  destinationFile: File | null;
  singleWorkbook: File | null;
  onSource: (event: ChangeEvent<HTMLInputElement>) => void;
  onDestination: (event: ChangeEvent<HTMLInputElement>) => void;
  onSingle: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="input-stack">
      <FileInput label="Single Workbook Upload" file={props.singleWorkbook} onChange={props.onSingle} />
      <div className="divider">OR</div>
      <FileInput label="Source File Upload" file={props.sourceFile} onChange={props.onSource} />
      <FileInput label="Destination File Upload" file={props.destinationFile} onChange={props.onDestination} />
    </div>
  );
}

function GoogleInputs(props: {
  sourceUrl: string;
  destinationUrl: string;
  sheetName: string;
  onSourceUrl: (value: string) => void;
  onDestinationUrl: (value: string) => void;
  onSheetName: (value: string) => void;
}) {
  return (
    <div className="input-stack">
      <TextInput label="Source Sheet URL" value={props.sourceUrl} onChange={props.onSourceUrl} />
      <TextInput label="Destination Sheet URL" value={props.destinationUrl} onChange={props.onDestinationUrl} />
      <TextInput label="Sheet Name (optional)" value={props.sheetName} onChange={props.onSheetName} />
    </div>
  );
}

function FileInput({ label, file, onChange }: { label: string; file: File | null; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input type="file" accept=".xlsx,.xls" onChange={onChange} />
      {file && <small>{file.name}</small>}
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function MappingEditor({
  title,
  headers,
  mapping,
  onChange,
}: {
  title: string;
  headers: string[];
  mapping: Partial<ColumnMapping>;
  onChange: (field: RequiredField, value: string) => void;
}) {
  return (
    <div className="mapping-block">
      <h3>{title}</h3>
      {requiredFields.map((field) => (
        <label className="field-label compact" key={field}>
          <span>{fieldLabel(field)}</span>
          <select value={mapping[field] ?? ""} onChange={(event) => onChange(field, event.target.value)}>
            <option value="">Select column</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function ProgressPanel({ progress }: { progress: ProgressState }) {
  return (
    <div className="control-panel">
      <SectionTitle icon={<Play size={18} />} title="Progress Tracking" />
      <div className="progress-row">
        <span>Progress: {progress.percent}%</span>
        <span>
          {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} Keywords Processed
        </span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}

function LogsPanel({ logs, onDownload, onClear }: { logs: LogEntry[]; onDownload: () => void; onClear: () => void }) {
  const streamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="control-panel logs-panel">
      <div className="toolbar-title">
        <SectionTitle icon={<ListRestart size={18} />} title="Live Logs" />
        <div className="toolbar-actions">
          <button className="icon-button" onClick={onDownload} title="Download Logs" disabled={logs.length === 0}>
            <Download size={17} />
          </button>
          <button className="icon-button" onClick={onClear} title="Clear Logs" disabled={logs.length === 0}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      <div className="log-stream" ref={streamRef}>
        {logs.length === 0 ? (
          <p className="empty-state">Logs will appear as files are loaded and processed.</p>
        ) : (
          logs.map((log) => (
            <p className={log.level} key={log.id}>
              [{log.timestamp}] {log.message}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryPanel({ result, destination, logs }: { result: ProcessingResult; destination: ParsedSheet; logs: LogEntry[] }) {
  const summary = result.summary;

  return (
    <section className="summary-band">
      <div>
        <p className="eyebrow">Processing Summary</p>
        <h2>{summary.successRate}% success rate</h2>
      </div>
      <div className="metric-grid">
        <Metric label="Total Keywords in Source" value={summary.totalKeywords} />
        <Metric label="Keywords Matched" value={summary.matched} />
        <Metric label="Keywords Not Found" value={summary.notFound} />
        <Metric label="Rows Updated" value={summary.rowsUpdated} />
        <Metric label="Processing Time" value={`${summary.processingTimeSeconds} seconds`} />
      </div>
      <div className="export-actions">
        <button className="secondary-action" onClick={() => downloadUpdatedDestination(destination)}>
          <Download size={17} />
          Updated Destination File
        </button>
        <button className="secondary-action" onClick={() => downloadNotFoundReport(result.notFound)}>
          <Download size={17} />
          Not Found Report
        </button>
        <button className="secondary-action" onClick={() => downloadLogs(logs)}>
          <Download size={17} />
          Processing Log File
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
    </div>
  );
}

function fileSetter(setter: (file: File | null) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.files?.[0] ?? null);
  };
}
