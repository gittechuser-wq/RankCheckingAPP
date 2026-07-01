import { RankingResult, SeoKeywordRow, UrlKeywordExtraction } from "./types";

const API_BASE_URL = import.meta.env.VITE_SEO_API_BASE_URL || "/seo-api";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `SEO API request failed with status ${response.status}.`);
  }

  return payload as T;
}

export function researchKeywords(request: {
  seedKeywords: string[];
  locations: string[];
  languages: string[];
  competitorUrls: string[];
}): Promise<{ keywords: SeoKeywordRow[]; providerMode: string }> {
  return postJson("/research", request);
}

export function checkKeywordRankings(request: {
  keywords: string[];
  location: string;
  domainOrUrl: string;
}): Promise<{ rankings: RankingResult[]; providerMode: string }> {
  return postJson("/ranking", request);
}

export function extractKeywordsFromUrl(request: {
  url: string;
  seedKeywords: string[];
  competitors: string[];
  languages: string[];
}): Promise<UrlKeywordExtraction> {
  return postJson("/extract-url", request);
}
