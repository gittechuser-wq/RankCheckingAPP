export type ToolKey = "keyword" | "aliyan" | "seo";

export type AdminSettings = {
  modules: Record<ToolKey, {
    label: string;
    eyebrow: string;
    title: string;
    enabled: boolean;
  }>;
  keywordMapping: {
    batchSize: number;
  };
  aliyan: {
    defaultProxyUrl: string;
  };
  seo: {
    availableLocations: string[];
    defaultSelectedLocations: string[];
    defaultSeedKeywords: string;
    defaultLanguage: string;
    availableLanguages: string[];
    defaultSelectedLanguages: string[];
  };
};

export const LATIN_AMERICA_COUNTRIES = [
  "Argentina",
  "Bolivia",
  "Brazil",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Cuba",
  "Dominican Republic",
  "Ecuador",
  "El Salvador",
  "Guatemala",
  "Honduras",
  "Mexico",
  "Nicaragua",
  "Panama",
  "Paraguay",
  "Peru",
  "Puerto Rico",
  "Uruguay",
  "Venezuela",
];

export const DEFAULT_SEO_LOCATIONS = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "United Arab Emirates",
  "Germany",
  "France",
  ...LATIN_AMERICA_COUNTRIES,
];

export const DEFAULT_SEO_LANGUAGES = [
  "English",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Hindi",
  "Arabic",
  "Italian",
  "Dutch",
  "Chinese",
  "Japanese",
  "Korean",
];

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  modules: {
    keyword: {
      label: "Keyword Mapping",
      eyebrow: "Google Sheets Keyword Mapping Tool",
      title: "Compare keyword sheets and update matching destination rows.",
      enabled: true,
    },
    aliyan: {
      label: "Aliyan Product Matcher",
      eyebrow: "Aliyan Pharma",
      title: "Match product strengths and update your workbook.",
      enabled: true,
    },
    seo: {
      label: "SEO Keyword Research",
      eyebrow: "SEO Keyword Research Tool",
      title: "Research keywords by location, combine volume, check rankings, and find content gaps.",
      enabled: true,
    },
  },
  keywordMapping: {
    batchSize: 500,
  },
  aliyan: {
    defaultProxyUrl: "/aliyan-api",
  },
  seo: {
    availableLocations: DEFAULT_SEO_LOCATIONS,
    defaultSelectedLocations: ["India", "United States", "United Kingdom"],
    defaultSeedKeywords: "pharma suppliers",
    defaultLanguage: "English",
    availableLanguages: DEFAULT_SEO_LANGUAGES,
    defaultSelectedLanguages: ["English"],
  },
};

export const ADMIN_SETTINGS_KEY = "rank-checking-app-admin-settings";

export function loadAdminSettings(): AdminSettings {
  try {
    const saved = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (!saved) return DEFAULT_ADMIN_SETTINGS;
    return mergeSettings(DEFAULT_ADMIN_SETTINGS, JSON.parse(saved) as Partial<AdminSettings>);
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveAdminSettings(settings: AdminSettings) {
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
}

function mergeSettings(defaults: AdminSettings, saved: Partial<AdminSettings>): AdminSettings {
  return {
    modules: {
      keyword: { ...defaults.modules.keyword, ...saved.modules?.keyword },
      aliyan: { ...defaults.modules.aliyan, ...saved.modules?.aliyan },
      seo: { ...defaults.modules.seo, ...saved.modules?.seo },
    },
    keywordMapping: { ...defaults.keywordMapping, ...saved.keywordMapping },
    aliyan: { ...defaults.aliyan, ...saved.aliyan },
    seo: {
      ...defaults.seo,
      ...saved.seo,
      availableLocations: normalizeList(saved.seo?.availableLocations ?? defaults.seo.availableLocations),
      defaultSelectedLocations: normalizeList(saved.seo?.defaultSelectedLocations ?? defaults.seo.defaultSelectedLocations),
      availableLanguages: normalizeList(saved.seo?.availableLanguages ?? defaults.seo.availableLanguages),
      defaultSelectedLanguages: normalizeList(saved.seo?.defaultSelectedLanguages ?? defaults.seo.defaultSelectedLanguages),
    },
  };
}

export function normalizeList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
