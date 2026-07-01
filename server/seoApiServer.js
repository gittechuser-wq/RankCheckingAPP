import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.SEO_API_PORT || 8787);
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

const COUNTRY_CODES = {
  India: "in",
  "United States": "us",
  "United Kingdom": "gb",
  Canada: "ca",
  Australia: "au",
  "United Arab Emirates": "ae",
  Germany: "de",
  France: "fr",
  Argentina: "ar",
  Bolivia: "bo",
  Brazil: "br",
  Chile: "cl",
  Colombia: "co",
  "Costa Rica": "cr",
  Cuba: "cu",
  "Dominican Republic": "do",
  Ecuador: "ec",
  "El Salvador": "sv",
  Guatemala: "gt",
  Honduras: "hn",
  Mexico: "mx",
  Nicaragua: "ni",
  Panama: "pa",
  Paraguay: "py",
  Peru: "pe",
  "Puerto Rico": "pr",
  Uruguay: "uy",
  Venezuela: "ve",
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Only POST requests are supported." });
      return;
    }

    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const body = await readJsonBody(request);

    if (url.pathname === "/seo-api/research" || url.pathname === "/research") {
      const result = await researchKeywords(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/seo-api/ranking" || url.pathname === "/ranking") {
      const result = await checkRankings(body);
      sendJson(response, 200, result);
      return;
    }

    if (url.pathname === "/seo-api/extract-url" || url.pathname === "/extract-url") {
      const result = await extractFromUrl(body);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: "SEO API route not found." });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "SEO API failed." });
  }
});

server.listen(PORT, () => {
  console.log(`SEO API server running at http://localhost:${PORT}/seo-api`);
});

async function researchKeywords(body) {
  const seedKeywords = uniqueStrings(body.seedKeywords);
  const locations = uniqueStrings(body.locations);
  const languages = uniqueStrings(body.languages).length
    ? uniqueStrings(body.languages)
    : [cleanString(body.language) || "English"];

  if (seedKeywords.length === 0 || locations.length === 0 || languages.length === 0) {
    throw new Error("Seed keywords, locations, and languages are required.");
  }

  if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
    try {
      const apiRows = await dataForSeoKeywordIdeas(seedKeywords, locations, languages);
      if (apiRows.length > 0) {
        return { keywords: attachCombinedVolume(apiRows), providerMode: "DataForSEO API" };
      }
    } catch (error) {
      console.warn("DataForSEO keyword research failed. Falling back to estimates.", error);
    }
  }

  return {
    keywords: attachCombinedVolume(generateEstimatedKeywordRows(seedKeywords, locations, languages)),
    providerMode: "Estimate fallback - configure DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD for live data",
  };
}

async function dataForSeoKeywordIdeas(seedKeywords, locations, languages) {
  const credentials = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString("base64");
  const rows = [];

  for (const location of locations) {
    for (const language of languages) {
      const response = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keywords: seedKeywords,
            location_name: location,
            language_name: language,
            include_seed_keyword: true,
            limit: 100,
          },
        ]),
      });

      if (!response.ok) {
        throw new Error(`DataForSEO keyword ideas failed with ${response.status}.`);
      }

      const payload = await response.json();
      const items = payload?.tasks?.flatMap((task) => task?.result?.flatMap((result) => result?.items || []) || []) || [];

      for (const item of items) {
        const keyword = cleanString(item.keyword);
        if (!keyword) continue;
        const info = item.keyword_info || {};
        const searchVolume = Number(info.search_volume || 0);
        rows.push(makeKeywordRow({
          keyword,
          location,
          language,
          searchVolume,
          difficulty: Number(item.keyword_properties?.keyword_difficulty || estimateDifficulty(keyword, location, language)),
          cpc: Number(info.cpc || 0),
          competition: Number(info.competition || 0),
          trend: normalizeTrend(info.monthly_searches),
          source: "api",
        }));
      }
    }
  }

  return dedupeRows(rows);
}

async function checkRankings(body) {
  const keywords = uniqueStrings(body.keywords).slice(0, 20);
  const location = cleanString(body.location) || "India";
  const domainOrUrl = cleanString(body.domainOrUrl);

  if (keywords.length === 0) {
    throw new Error("At least one keyword is required for ranking check.");
  }

  if (SERPAPI_KEY) {
    const rankings = [];

    for (const keyword of keywords) {
      rankings.push(await serpApiRanking(keyword, location, domainOrUrl));
    }

    return { rankings, providerMode: "SerpAPI" };
  }

  return {
    rankings: keywords.map((keyword, index) => ({
      keyword,
      location,
      position: index % 4 === 0 ? null : index + 3,
      rankingUrl: domainOrUrl ? normalizeUrl(domainOrUrl) : "",
      serpUrl: googleSerpUrl(keyword, location),
      checkedAt: new Date().toISOString(),
    })),
    providerMode: "Estimate fallback - configure SERPAPI_KEY for live ranking checks",
  };
}

async function serpApiRanking(keyword, location, domainOrUrl) {
  const gl = COUNTRY_CODES[location] || "us";
  const serpUrl = new URL("https://serpapi.com/search.json");
  serpUrl.searchParams.set("engine", "google");
  serpUrl.searchParams.set("q", keyword);
  serpUrl.searchParams.set("gl", gl);
  serpUrl.searchParams.set("num", "100");
  serpUrl.searchParams.set("api_key", SERPAPI_KEY);

  const response = await fetch(serpUrl);
  if (!response.ok) {
    throw new Error(`SerpAPI ranking check failed with ${response.status}.`);
  }

  const payload = await response.json();
  const organic = payload.organic_results || [];
  const targetHost = hostFromUrl(domainOrUrl);
  const match = organic.find((result) => {
    if (!targetHost) return false;
    return hostFromUrl(result.link || "").includes(targetHost) || targetHost.includes(hostFromUrl(result.link || ""));
  });

  return {
    keyword,
    location,
    position: match?.position ?? null,
    rankingUrl: match?.link || "",
    serpUrl: googleSerpUrl(keyword, location),
    checkedAt: new Date().toISOString(),
  };
}

async function extractFromUrl(body) {
  const sourceUrl = normalizeUrl(cleanString(body.url));
  const seedKeywords = uniqueStrings(body.seedKeywords);

  if (!sourceUrl) {
    throw new Error("A valid URL is required.");
  }

  const html = await fetchHtmlForExtraction(sourceUrl);
  const pageText = extractPageText(html);
  const suggestedKeywords = topPhrases(pageText, 30);
  const missingKeywordOpportunities = seedKeywords
    .filter((keyword) => !pageText.toLowerCase().includes(keyword.toLowerCase()))
    .flatMap((keyword) => [`${keyword} services`, `best ${keyword}`, `${keyword} near me`])
    .slice(0, 20);

  return {
    sourceUrl,
    suggestedKeywords,
    existingRankingKeywords: suggestedKeywords.slice(0, 10),
    missingKeywordOpportunities,
    contentGaps: buildContentGaps(seedKeywords, suggestedKeywords),
  };
}

async function fetchHtmlForExtraction(sourceUrl) {
  let response;

  try {
    response = await fetch(sourceUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 SEOKeywordResearchTool/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError"
      ? "the request timed out"
      : "the website could not be reached from the local SEO API server";
    throw new Error(`Unable to fetch URL for extraction: ${reason}. Check the URL, include https://, and try again. Some websites block automated server requests.`);
  }

  if (!response.ok) {
    throw new Error(`Unable to fetch URL for extraction. The website responded with HTTP ${response.status} ${response.statusText || ""}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !/text\/html|application\/xhtml\+xml|application\/xml/i.test(contentType)) {
    throw new Error(`Unable to extract keywords because the URL returned ${contentType}, not an HTML page.`);
  }

  const html = await response.text();
  if (!html.trim()) {
    throw new Error("Unable to extract keywords because the URL returned an empty page.");
  }

  return html;
}

function generateEstimatedKeywordRows(seedKeywords, locations, languages) {
  const modifiers = ["", " suppliers", " manufacturer", " near me", " price", " wholesale", " distributors", " questions"];
  const rows = [];

  for (const location of locations) {
    for (const language of languages) {
      for (const seed of seedKeywords) {
        for (const modifier of modifiers) {
          const keyword = `${seed}${modifier}`.trim();
          const searchVolume = estimateVolume(keyword, location, language);
          rows.push(makeKeywordRow({
            keyword,
            location,
            language,
            searchVolume,
            difficulty: estimateDifficulty(keyword, location, language),
            cpc: estimateCpc(keyword, location, language),
            competition: estimateCompetition(keyword, location, language),
            trend: estimateTrend(keyword, location, language),
            source: "estimate",
          }));
        }
      }
    }
  }

  return dedupeRows(rows);
}

function makeKeywordRow({ keyword, location, language, searchVolume, difficulty, cpc, competition, trend, source }) {
  const intent = classifyIntent(keyword);
  const priorityScore = Math.max(1, Math.min(100, Math.round((searchVolume / 120) + (100 - difficulty) * 0.45 + cpc * 3)));

  return {
    id: `${keyword.toLowerCase()}__${location.toLowerCase()}__${language.toLowerCase()}`,
    keyword,
    location,
    language,
    searchVolume,
    combinedSearchVolume: searchVolume,
    keywordDifficulty: Math.round(difficulty),
    cpc: Number(cpc.toFixed(2)),
    competition: Number(competition.toFixed(2)),
    intent,
    trend,
    relatedKeywords: [`${keyword} companies`, `${keyword} services`, `${keyword} market`],
    questionKeywords: [`what is ${keyword}`, `how to choose ${keyword}`, `where to find ${keyword}`],
    longTailKeywords: [`best ${keyword} in ${location}`, `affordable ${keyword} ${location}`],
    serpFeatures: detectSerpFeatures(keyword),
    priorityScore,
    source,
  };
}

function attachCombinedVolume(rows) {
  const totals = rows.reduce((acc, row) => {
    const key = row.keyword.toLowerCase();
    acc[key] = (acc[key] || 0) + row.searchVolume;
    return acc;
  }, {});

  return rows.map((row) => ({ ...row, combinedSearchVolume: totals[row.keyword.toLowerCase()] || row.searchVolume }));
}

function dedupeRows(rows) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function classifyIntent(keyword) {
  const lower = keyword.toLowerCase();
  if (/\b(near me|in |local)\b/.test(lower)) return "Local";
  if (/\b(buy|price|cost|quote|order)\b/.test(lower)) return "Transactional";
  if (/\b(best|top|compare|review|supplier|manufacturer|distributor)\b/.test(lower)) return "Commercial";
  if (/\b(login|official|website)\b/.test(lower)) return "Navigational";
  return "Informational";
}

function detectSerpFeatures(keyword) {
  const lower = keyword.toLowerCase();
  const features = ["Organic Results"];
  if (/\b(what|how|why|where|questions)\b/.test(lower)) features.push("People Also Ask");
  if (/\b(near me|local|in )\b/.test(lower)) features.push("Local Pack");
  if (/\b(price|buy|wholesale)\b/.test(lower)) features.push("Shopping/Ads");
  return features;
}

function extractPageText(html) {
  const title = matchAllText(html, /<title[^>]*>([\s\S]*?)<\/title>/gi);
  const meta = matchAllText(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/gi);
  const headings = matchAllText(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  const alts = matchAllText(html, /<img[^>]+alt=["']([^"']+)["'][^>]*>/gi);
  const links = matchAllText(html, /<a[^>]+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/gi);
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return decodeHtml([...title, ...meta, ...headings, ...alts, ...links, body].join(" "));
}

function topPhrases(text, limit) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

  const scores = new Map();
  for (let size = 1; size <= 3; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      const phrase = words.slice(index, index + size).join(" ");
      scores.set(phrase, (scores.get(phrase) || 0) + size);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .slice(0, limit);
}

function buildContentGaps(seedKeywords, suggestedKeywords) {
  const gaps = [];
  if (seedKeywords.length > 0) gaps.push("Create dedicated pages or sections for high-priority seed keywords not present on the page.");
  if (!suggestedKeywords.some((keyword) => keyword.includes("near"))) gaps.push("Add local SEO phrases where location-based searches matter.");
  if (!suggestedKeywords.some((keyword) => /price|cost|quote/.test(keyword))) gaps.push("Add pricing, quote, or purchase-intent content for transactional searches.");
  gaps.push("Add FAQ content to target question-based keywords and People Also Ask opportunities.");
  return gaps;
}

function estimateVolume(keyword, location, language) {
  return 50 + (hash(`${keyword}-${location}-${language}`) % 4800);
}

function estimateDifficulty(keyword, location, language = "English") {
  return 15 + (hash(`difficulty-${keyword}-${location}-${language}`) % 75);
}

function estimateCpc(keyword, location, language) {
  return 0.2 + (hash(`cpc-${keyword}-${location}-${language}`) % 1800) / 100;
}

function estimateCompetition(keyword, location, language) {
  return (hash(`competition-${keyword}-${location}-${language}`) % 100) / 100;
}

function estimateTrend(keyword, location, language) {
  return Array.from({ length: 6 }, (_, index) => 20 + (hash(`trend-${keyword}-${location}-${language}-${index}`) % 80));
}

function normalizeTrend(monthlySearches) {
  const trend = Array.isArray(monthlySearches) ? monthlySearches.slice(-6).map((item) => Number(item.search_volume || 0)) : [];
  return trend.length > 0 ? trend : [0, 0, 0, 0, 0, 0];
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function googleSerpUrl(keyword, location) {
  const gl = COUNTRY_CODES[location] || "us";
  return `https://www.google.com/search?q=${encodeURIComponent(keyword)}&gl=${gl}`;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanString).filter(Boolean))];
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(value) {
  if (!value) return "";
  try {
    return new URL(value).href;
  } catch {
    try {
      return new URL(`https://${value}`).href;
    } catch {
      return "";
    }
  }
}

function hostFromUrl(value) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchAllText(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => stripTags(match[1] || ""));
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  response.end(statusCode === 204 ? "" : JSON.stringify(payload));
}

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "been", "before", "being", "between", "both", "could", "from", "have",
  "into", "more", "most", "only", "other", "over", "some", "such", "than", "that", "their", "there", "these", "they",
  "this", "through", "with", "were", "what", "when", "where", "which", "while", "your", "will", "www", "https",
]);
