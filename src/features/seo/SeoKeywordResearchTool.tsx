import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Filter, Globe2, Link2, Play, Search, Sparkles } from "lucide-react";
import { checkKeywordRankings, extractKeywordsFromUrl, researchKeywords } from "./seoApiClient";
import { exportSeoReport } from "./seoExport";
import { CombinedKeywordRow, RankingResult, SeoFilters, SeoKeywordRow, UrlKeywordExtraction } from "./types";
import { AdminSettings } from "../admin/adminSettings";

const HISTORY_KEY = "seo-keyword-research-history";

const defaultFilters: SeoFilters = {
  country: "",
  language: "",
  intent: "",
  minVolume: "",
  maxDifficulty: "",
  maxCpc: "",
};

export function SeoKeywordResearchTool({ settings }: { settings: AdminSettings }) {
  const locationOptions = settings.seo.availableLocations;
  const languageOptions = settings.seo.availableLanguages;
  const [seedText, setSeedText] = useState(settings.seo.defaultSeedKeywords);
  const [locations, setLocations] = useState<string[]>(settings.seo.defaultSelectedLocations);
  const [languages, setLanguages] = useState<string[]>(settings.seo.defaultSelectedLanguages.length ? settings.seo.defaultSelectedLanguages : [settings.seo.defaultLanguage]);
  const [targetUrl, setTargetUrl] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [rankingLocation, setRankingLocation] = useState("India");
  const [rows, setRows] = useState<SeoKeywordRow[]>([]);
  const [rankings, setRankings] = useState<RankingResult[]>([]);
  const [extraction, setExtraction] = useState<UrlKeywordExtraction | null>(null);
  const [filters, setFilters] = useState<SeoFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("Enter seed keywords and locations to begin.");
  const [error, setError] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [providerMode, setProviderMode] = useState("");
  const pageSize = 15;

  const seedKeywords = useMemo(() => parseLines(seedText), [seedText]);
  const competitorUrls = useMemo(() => parseLines(competitors), [competitors]);

  const combinedRows = useMemo(() => combineKeywordVolumes(rows), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.country && row.location !== filters.country) return false;
      if (filters.language && row.language !== filters.language) return false;
      if (filters.intent && row.intent !== filters.intent) return false;
      if (filters.minVolume && row.searchVolume < Number(filters.minVolume)) return false;
      if (filters.maxDifficulty && row.keywordDifficulty > Number(filters.maxDifficulty)) return false;
      if (filters.maxCpc && row.cpc > Number(filters.maxCpc)) return false;
      return true;
    });
  }, [filters, rows]);

  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filters, rows.length]);

  useEffect(() => {
    setLocations((current) => current.filter((location) => locationOptions.includes(location)));
    setRankingLocation((current) => locationOptions.includes(current) ? current : locationOptions[0] ?? "");
  }, [locationOptions]);

  useEffect(() => {
    setLanguages((current) => current.filter((language) => languageOptions.includes(language)));
  }, [languageOptions]);

  async function runResearch() {
    setError("");

    if (seedKeywords.length === 0) {
      setError("Enter at least one seed keyword.");
      return;
    }

    if (locations.length === 0) {
      setError("Select at least one target location.");
      return;
    }

    if (languages.length === 0) {
      setError("Select at least one target language.");
      return;
    }

    setIsResearching(true);
    setStatus(`Researching ${seedKeywords.length} seed keyword(s) across ${locations.length} location(s) and ${languages.length} language(s)...`);

    try {
      const response = await researchKeywords({ seedKeywords, locations, languages, competitorUrls });
      const withCombinedVolume = applyCombinedVolume(response.keywords);
      setRows(withCombinedVolume);
      setProviderMode(response.providerMode);
      setStatus(`Loaded ${withCombinedVolume.length.toLocaleString()} keyword/location rows. Duplicate keywords were grouped for combined volume.`);
      saveHistory(seedKeywords, locations);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Keyword research failed.");
      setStatus("Keyword research could not be completed.");
    } finally {
      setIsResearching(false);
    }
  }

  async function runRankingCheck() {
    const keywords = combinedRows.slice(0, 10).map((row) => row.keyword);

    if (keywords.length === 0) {
      setError("Run keyword research first before checking rankings.");
      return;
    }

    if (!targetUrl.trim()) {
      setError("Enter your website/domain URL to match ranking URLs.");
      return;
    }

    setError("");
    setStatus(`Checking rankings for ${keywords.length} keyword(s) in ${rankingLocation}...`);

    try {
      const response = await checkKeywordRankings({ keywords, location: rankingLocation, domainOrUrl: targetUrl.trim() });
      setRankings(response.rankings);
      setProviderMode((current) => current || response.providerMode);
      setStatus(`Ranking check completed for ${rankingLocation}.`);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Ranking check failed.");
    }
  }

  async function runUrlExtraction() {
    if (!targetUrl.trim()) {
      setError("Enter a website URL for keyword extraction.");
      return;
    }

    setError("");
    setStatus(`Analyzing ${targetUrl.trim()} for keyword opportunities...`);

    try {
      const response = await extractKeywordsFromUrl({
        url: targetUrl.trim(),
        seedKeywords,
        competitors: competitorUrls,
        languages,
      });
      setExtraction(response);
      setStatus("URL keyword extraction completed.");
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "URL keyword extraction failed.");
    }
  }

  return (
    <main className="app-shell seo-module">
      <section className="header-band">
        <div>
          <p className="eyebrow">{settings.modules.seo.eyebrow}</p>
          <h1>{settings.modules.seo.title}</h1>
          <p className="seo-intro">
            API keys stay on the backend. If no provider credentials are configured, the tool returns clearly marked estimates so the workflow remains testable.
          </p>
        </div>
        <button className="primary-action" onClick={runResearch} disabled={isResearching}>
          <Play size={18} />
          {isResearching ? "Researching..." : "Run Research"}
        </button>
      </section>

      <section className="workspace-grid">
        <div className="control-panel">
          <SectionHeading icon={<Search size={18} />} title="Inputs" />
          <label className="field-label">
            <span>Seed Keywords (one per line or comma separated)</span>
            <textarea value={seedText} onChange={(event) => setSeedText(event.target.value)} rows={5} />
          </label>

          <MultiSelectDropdown
            label="Target Locations/Countries"
            options={locationOptions}
            selected={locations}
            onChange={setLocations}
            placeholder="Select countries"
          />

          <MultiSelectDropdown
            label="Target Languages"
            options={languageOptions}
            selected={languages}
            onChange={setLanguages}
            placeholder="Select languages"
          />

          <label className="field-label">
            <span>Website URL / Domain for Ranking & URL Extraction</span>
            <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://example.com" />
          </label>

          <label className="field-label">
            <span>Competitor URLs (optional, one per line)</span>
            <textarea value={competitors} onChange={(event) => setCompetitors(event.target.value)} rows={3} />
          </label>
        </div>

        <div className="control-panel">
          <SectionHeading icon={<Sparkles size={18} />} title="Actions & Status" />
          <p className="seo-status">{status}</p>
          {providerMode && <p className="seo-provider">Provider mode: {providerMode}</p>}
          {error && <div className="error-list"><p>{error}</p></div>}
          <div className="seo-action-grid">
            <button className="secondary-action" onClick={runRankingCheck} disabled={isResearching || rows.length === 0}>
              <BarChart3 size={17} />
              Ranking Check
            </button>
            <button className="secondary-action" onClick={runUrlExtraction} disabled={isResearching}>
              <Link2 size={17} />
              Extract From URL
            </button>
            <button
              className="secondary-action"
              onClick={() => exportSeoReport({ keywordRows: filteredRows, combinedRows, rankings, extraction, format: "xlsx" })}
              disabled={rows.length === 0}
            >
              <Download size={17} />
              Export Excel
            </button>
            <button
              className="secondary-action"
              onClick={() => exportSeoReport({ keywordRows: filteredRows, combinedRows, rankings, extraction, format: "csv" })}
              disabled={rows.length === 0}
            >
              <Download size={17} />
              Export CSV
            </button>
          </div>
          <label className="field-label compact">
            <span>Ranking Location</span>
            <select value={rankingLocation} onChange={(event) => setRankingLocation(event.target.value)}>
              {locations.map((location) => <option key={location}>{location}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="control-panel seo-filter-panel">
        <SectionHeading icon={<Filter size={18} />} title="Filters" />
        <div className="seo-filter-grid">
          <select value={filters.country} onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))}>
            <option value="">All countries</option>
            {locations.map((location) => <option key={location}>{location}</option>)}
          </select>
          <select value={filters.language} onChange={(event) => setFilters((current) => ({ ...current, language: event.target.value }))}>
            <option value="">All languages</option>
            {languages.map((language) => <option key={language}>{language}</option>)}
          </select>
          <select value={filters.intent} onChange={(event) => setFilters((current) => ({ ...current, intent: event.target.value }))}>
            <option value="">All intents</option>
            <option>Informational</option>
            <option>Commercial</option>
            <option>Transactional</option>
            <option>Navigational</option>
            <option>Local</option>
          </select>
          <input placeholder="Min volume" value={filters.minVolume} onChange={(event) => setFilters((current) => ({ ...current, minVolume: event.target.value }))} />
          <input placeholder="Max difficulty" value={filters.maxDifficulty} onChange={(event) => setFilters((current) => ({ ...current, maxDifficulty: event.target.value }))} />
          <input placeholder="Max CPC" value={filters.maxCpc} onChange={(event) => setFilters((current) => ({ ...current, maxCpc: event.target.value }))} />
        </div>
      </section>

      <section className="seo-summary-grid">
        <Metric label="Keyword/location rows" value={rows.length} />
        <Metric label="Unique keywords" value={combinedRows.length} />
        <Metric label="Combined volume" value={combinedRows.reduce((sum, row) => sum + row.totalSearchVolume, 0)} />
        <Metric label="Ranking checks" value={rankings.length} />
      </section>

      <section className="control-panel">
        <SectionHeading icon={<Globe2 size={18} />} title="Location-wise Keyword Results" />
        <KeywordTable rows={visibleRows} />
        <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filteredRows.length} />
      </section>

      <section className="workspace-grid">
        <CombinedVolumePanel rows={combinedRows} />
        <RankingPanel rankings={rankings} />
      </section>

      {extraction && <UrlExtractionPanel extraction={extraction} />}
    </main>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="section-title">{icon}<h2>{title}</h2></div>;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedSummary = selected.length ? selected.join(", ") : placeholder;

  return (
    <div className="multi-select">
      <span>{label}</span>
      <button type="button" className="multi-select-trigger" onClick={() => setIsOpen((current) => !current)}>
        <span>{selectedSummary}</span>
        <b>{selected.length}</b>
      </button>
      {isOpen && (
        <div className="multi-select-menu">
          <div className="multi-select-actions">
            <button type="button" onClick={() => onChange(options)}>Select all</button>
            <button type="button" onClick={() => onChange([])}>Clear</button>
          </div>
          <div className="multi-select-options">
            {options.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onChange(toggleValue(selected, option))}
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KeywordTable({ rows }: { rows: SeoKeywordRow[] }) {
  if (rows.length === 0) {
    return <p className="empty-state">No keyword rows to show yet.</p>;
  }

  return (
    <div className="seo-table-wrap">
      <table className="seo-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Location</th>
            <th>Language</th>
            <th>Volume</th>
            <th>Combined</th>
            <th>KD</th>
            <th>CPC</th>
            <th>Competition</th>
            <th>Intent</th>
            <th>Trend</th>
            <th>SERP</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.keyword}</td>
              <td>{row.location}</td>
              <td>{row.language}</td>
              <td>{row.searchVolume.toLocaleString()}</td>
              <td>{row.combinedSearchVolume.toLocaleString()}</td>
              <td>{row.keywordDifficulty}</td>
              <td>${row.cpc.toFixed(2)}</td>
              <td>{row.competition.toFixed(2)}</td>
              <td>{row.intent}</td>
              <td>{row.trend.join(" → ")}</td>
              <td>{row.serpFeatures.join(", ")}</td>
              <td>{row.priorityScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CombinedVolumePanel({ rows }: { rows: CombinedKeywordRow[] }) {
  return (
    <div className="control-panel">
      <SectionHeading icon={<BarChart3 size={18} />} title="Combined Search Volume" />
      <div className="seo-mini-list">
        {rows.slice(0, 12).map((row) => (
          <div key={row.keyword}>
            <strong>{row.keyword}</strong>
            <span>{Object.entries(row.locations).map(([location, volume]) => `${location}: ${volume.toLocaleString()}`).join(" | ")}</span>
            <b>Total: {row.totalSearchVolume.toLocaleString()}</b>
          </div>
        ))}
        {rows.length === 0 && <p className="empty-state">Combined volumes appear after research runs.</p>}
      </div>
    </div>
  );
}

function RankingPanel({ rankings }: { rankings: RankingResult[] }) {
  return (
    <div className="control-panel">
      <SectionHeading icon={<BarChart3 size={18} />} title="Ranking Check" />
      <div className="seo-mini-list">
        {rankings.map((ranking) => (
          <div key={`${ranking.keyword}-${ranking.location}`}>
            <strong>{ranking.keyword}</strong>
            <span>{ranking.location} · Position {ranking.position ?? "Not found"}</span>
            <a href={ranking.serpUrl} target="_blank" rel="noreferrer">Open SERP</a>
            {ranking.rankingUrl && <a href={ranking.rankingUrl} target="_blank" rel="noreferrer">Ranking URL</a>}
            <small>{new Date(ranking.checkedAt).toLocaleString()}</small>
          </div>
        ))}
        {rankings.length === 0 && <p className="empty-state">Run a ranking check after keyword research.</p>}
      </div>
    </div>
  );
}

function UrlExtractionPanel({ extraction }: { extraction: UrlKeywordExtraction }) {
  return (
    <section className="control-panel">
      <SectionHeading icon={<Link2 size={18} />} title="URL Keyword Extraction & Content Gaps" />
      <div className="seo-opportunity-grid">
        <OpportunityList title="Suggested Keywords" items={extraction.suggestedKeywords} />
        <OpportunityList title="Existing Ranking Keywords" items={extraction.existingRankingKeywords} />
        <OpportunityList title="Missing Opportunities" items={extraction.missingKeywordOpportunities} />
        <OpportunityList title="Content Gaps" items={extraction.contentGaps} />
      </div>
    </section>
  );
}

function OpportunityList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

function Pagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (page: number) => void }) {
  return (
    <div className="seo-pagination">
      <span>{total.toLocaleString()} filtered rows</span>
      <button className="icon-button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
      <span>Page {page} of {pageCount}</span>
      <button className="icon-button" onClick={() => onPage(Math.min(pageCount, page + 1))} disabled={page === pageCount}>›</button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span>{label}</span><strong>{value.toLocaleString()}</strong></div>;
}

function parseLines(value: string) {
  return [...new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))];
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function applyCombinedVolume(keywordRows: SeoKeywordRow[]) {
  const totals = keywordRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.keyword.toLowerCase();
    acc[key] = (acc[key] ?? 0) + row.searchVolume;
    return acc;
  }, {});

  return keywordRows.map((row) => ({ ...row, combinedSearchVolume: totals[row.keyword.toLowerCase()] ?? row.searchVolume }));
}

function combineKeywordVolumes(keywordRows: SeoKeywordRow[]): CombinedKeywordRow[] {
  const groups = keywordRows.reduce<Record<string, SeoKeywordRow[]>>((acc, row) => {
    const key = row.keyword.toLowerCase();
    acc[key] = [...(acc[key] ?? []), row];
    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => {
      const totalSearchVolume = group.reduce((sum, row) => sum + row.searchVolume, 0);
      const locations = group.reduce<Record<string, number>>((acc, row) => {
        const key = row.language ? `${row.location} (${row.language})` : row.location;
        acc[key] = (acc[key] ?? 0) + row.searchVolume;
        return acc;
      }, {});

      return {
        keyword: group[0].keyword,
        totalSearchVolume,
        locations,
        rows: group,
        avgDifficulty: Math.round(group.reduce((sum, row) => sum + row.keywordDifficulty, 0) / group.length),
        avgCpc: Number((group.reduce((sum, row) => sum + row.cpc, 0) / group.length).toFixed(2)),
        intent: group[0].intent,
        priorityScore: Math.round(group.reduce((sum, row) => sum + row.priorityScore, 0) / group.length),
      };
    })
    .sort((a, b) => b.totalSearchVolume - a.totalSearchVolume);
}

function saveHistory(seedKeywords: string[], locations: string[]) {
  const entry = { seedKeywords, locations, createdAt: new Date().toISOString() };
  const current = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as unknown[];
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...current].slice(0, 20)));
}
