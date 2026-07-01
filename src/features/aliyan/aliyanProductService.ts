export interface AliyanMatch {
  url: string;
  matchedQuery: string;
}

export interface AliyanSearchOptions {
  proxyUrl: string;
  signal?: AbortSignal;
  onStatus?: (message: string) => void;
}

const SITE_ORIGIN = "https://aliyanpharma.com";
// A guard against malformed sites linking pages in a loop. Normal search pagination
// is fully traversed; this is deliberately far above any expected product result set.
const MAX_RESULT_PAGES = 250;
const MAX_PRODUCT_PAGES = 250;

/**
 * Searches WordPress-style result pages, then verifies the Strength / Pack on each
 * product/article detail page before returning its canonical URL.
 */
export async function findAliyanProduct(
  productName: string,
  strength: string,
  options: AliyanSearchOptions,
): Promise<AliyanMatch | null> {
  const expectedStrength = normalize(strength);
  if (!expectedStrength) return null;

  const queries = makeQueries(productName);
  const inspected = new Set<string>();

  for (const query of queries) {
    options.onStatus?.(`Searching Aliyan for “${query}”...`);
    const candidates = await collectSearchCandidates(query, options);

    for (const candidate of candidates) {
      if (inspected.has(candidate)) continue;
      inspected.add(candidate);
      options.onStatus?.(`Checking product details: ${candidate}`);
      const detail = await fetchHtml(candidate, options);
      if (pageHasStrength(detail, expectedStrength)) {
        return { url: canonicalUrl(detail, candidate), matchedQuery: query };
      }
    }
  }

  return null;
}

function makeQueries(value: string): string[] {
  const full = value.trim();
  const keywords = full
    .split(/[\/+]|\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  return [...new Set([full, ...keywords])];
}

async function collectSearchCandidates(query: string, options: AliyanSearchOptions): Promise<string[]> {
  const firstPage = `/?s=${encodeURIComponent(query)}`;
  const pending = [firstPage];
  const visited = new Set<string>();
  const candidates = new Map<string, number>();

  while (pending.length > 0 && visited.size < MAX_RESULT_PAGES) {
    const page = pending.shift()!;
    if (visited.has(page)) continue;
    visited.add(page);
    options.onStatus?.(`Searching result page ${visited.size} for “${query}”...`);

    const html = await fetchHtml(page, options);
    const document = new DOMParser().parseFromString(html, "text/html");
    if (!document) continue;

    for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
      const href = toSitePath(anchor.href);
      if (!href) continue;
      const label = `${anchor.textContent ?? ""} ${anchor.getAttribute("aria-label") ?? ""}`.trim();
      const context = `${label} ${anchor.closest("article, .post, .product, li")?.textContent ?? ""}`.trim();
      if (isSearchPaginationLink(anchor, href, query) && !visited.has(href) && !pending.includes(href)) {
        pending.push(href);
      }
      const score = relevance(context, query);
      if (isCandidateLink(href, label) && score > 0) {
        candidates.set(href, Math.max(candidates.get(href) ?? 0, score));
      }
    }
  }

  const orderedCandidates = [...candidates.entries()]
    .sort(([, left], [, right]) => right - left)
    .slice(0, MAX_PRODUCT_PAGES)
    .map(([url]) => url);
  options.onStatus?.(`Searched ${visited.size} result page${visited.size === 1 ? "" : "s"}; checking ${orderedCandidates.length} matching result links.`);
  return orderedCandidates;
}

async function fetchHtml(path: string, options: AliyanSearchOptions): Promise<string> {
  const endpoint = options.proxyUrl.replace(/\/$/, "");
  const response = await fetch(`${endpoint}${path}`, {
    signal: options.signal,
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`Aliyan returned ${response.status} for ${path}.`);
  const html = await response.text();
  if (/just a moment|cf-chl|enable javascript and cookies/i.test(html)) {
    throw new Error("Aliyan blocked this request. Use a server-side proxy that can access the site, then enter its URL.");
  }
  return html;
}

function toSitePath(href: string): string | null {
  try {
    const url = new URL(href, SITE_ORIGIN);
    if (!/^(www\.)?aliyanpharma\.com$/i.test(url.hostname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function isCandidateLink(href: string, label: string): boolean {
  if (href === "/" || href.startsWith("/?s=") || href.includes("/page/")) return false;
  if (/^(home|about|contact|privacy|terms|cart|checkout|my-account)$/i.test(label.trim())) return false;
  return Boolean(label) && !/^\d+$/.test(label.trim());
}

function isSearchPaginationLink(anchor: HTMLAnchorElement, href: string, query: string): boolean {
  const url = new URL(href, SITE_ORIGIN);
  const searchedFor = url.searchParams.get("s") ?? url.searchParams.get("search");
  if (normalize(searchedFor ?? "") !== normalize(query)) return false;

  const marker = `${anchor.rel} ${anchor.className} ${anchor.textContent} ${anchor.getAttribute("aria-label") ?? ""}`.toLowerCase();
  const isPaginationContainer = Boolean(anchor.closest(".pagination, .nav-links, .page-numbers, nav[role='navigation']"));
  const isPagedUrl = /\/page\/\d+\/?$/i.test(url.pathname) || url.searchParams.has("paged") || url.searchParams.has("page");
  return isPaginationContainer || isPagedUrl || /next|older|previous|newer|›|»|‹|«|^\s*\d+\s*$/.test(marker);
}

function relevance(label: string, query: string): number {
  const target = normalize(query);
  const source = normalize(label);
  if (source === target) return 100;
  if (source.includes(target)) return 80;
  return target.split(" ").filter((word) => source.includes(word)).length;
}

function pageHasStrength(html: string, expected: string): boolean {
  const document = new DOMParser().parseFromString(html, "text/html");
  return normalize(document?.body.textContent ?? "").includes(expected);
}

function canonicalUrl(html: string, fallbackPath: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const canonical = document?.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  return canonical || new URL(fallbackPath, SITE_ORIGIN).href;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/μ/g, "mc")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
