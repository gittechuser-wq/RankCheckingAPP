export type SearchIntent = "Informational" | "Commercial" | "Transactional" | "Navigational" | "Local";

export type SeoKeywordRow = {
  id: string;
  keyword: string;
  location: string;
  language: string;
  searchVolume: number;
  combinedSearchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  competition: number;
  intent: SearchIntent;
  trend: number[];
  relatedKeywords: string[];
  questionKeywords: string[];
  longTailKeywords: string[];
  serpFeatures: string[];
  priorityScore: number;
  source: "api" | "estimate";
};

export type CombinedKeywordRow = {
  keyword: string;
  totalSearchVolume: number;
  locations: Record<string, number>;
  rows: SeoKeywordRow[];
  avgDifficulty: number;
  avgCpc: number;
  intent: SearchIntent;
  priorityScore: number;
};

export type RankingResult = {
  keyword: string;
  location: string;
  position: number | null;
  rankingUrl: string;
  serpUrl: string;
  checkedAt: string;
};

export type UrlKeywordExtraction = {
  suggestedKeywords: string[];
  existingRankingKeywords: string[];
  missingKeywordOpportunities: string[];
  contentGaps: string[];
  sourceUrl: string;
};

export type SeoFilters = {
  country: string;
  language: string;
  intent: string;
  minVolume: string;
  maxDifficulty: string;
  maxCpc: string;
};
