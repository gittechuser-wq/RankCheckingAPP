# Google Sheets Keyword Mapping Tool

Modern React + TypeScript app for comparing Source and Destination keyword sheets, copying `Position` and `Top Ranking Page` for matched keywords, and exporting updated output files.

## Run locally

```bash
npm install --cache ./.npm-cache
npm run dev -- --port 5173
```

Open `http://localhost:5173`.

## Google Sheets mode

Create a `.env.local` file with:

```bash
VITE_GOOGLE_CLIENT_ID=your_oauth_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

Enable the Google Sheets API for the Google Cloud project and add the app origin to the OAuth client. The app requests the `https://www.googleapis.com/auth/spreadsheets` scope so it can read both sheets and update the destination sheet.

## Build

```bash
npm run build
```
