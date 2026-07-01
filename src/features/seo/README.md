# SEO Keyword Research Tool

This module is intentionally separate from the existing keyword mapping and Aliyan product matcher flows.

## Frontend

- Component: `SeoKeywordResearchTool.tsx`
- API client: `seoApiClient.ts`
- Export helpers: `seoExport.ts`

The browser calls `/seo-api/*` only. Provider credentials are never placed in Vite `VITE_*` variables.

## Backend

Run the local API server:

```bash
npm run dev:seo-api
```

Run Vite separately:

```bash
npm run dev
```

Optional environment variables:

```bash
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
SERPAPI_KEY=...
SEO_API_PORT=8788
```

When no provider credentials are configured, the backend returns deterministic estimate data marked with `source: "estimate"` so UI, filtering, combined volume, ranking, extraction, and export workflows can still be tested.
