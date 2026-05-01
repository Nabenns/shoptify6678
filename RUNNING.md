# How to Run

## 1. Setup .env

Copy the example and fill in your values:

```
cp .env.example .env
```

Edit `.env`:
- `BASE_URL` — Spotify internal staging URL
- `OTP_API_KEY` — your otpku API key (from my.otpku.co.id dashboard)
- `OTP_SERVICE_CODE` — check otpku dashboard for the Spotify service code
- `OTP_COUNTRY` — country code from otpku (e.g. `6` for Indonesia)

## 2. Update Selectors

Run Playwright codegen against the staging URL to find real selectors:

```
npx playwright codegen $BASE_URL
```

Then update every `// SELECTOR` line in `pages/signup.page.ts` with the actual selectors from the inspector.

## 3. Run Tests

Run all 3 parallel instances:
```
npm run test:e2e
```

Run unit tests only:
```
npm run test:unit
```

## 4. View Results

Results are saved to `results/report.json` (NDJSON format — one JSON object per line):
```
cat results/report.json
```

View Playwright HTML report (screenshots/traces on failure):
```
npx playwright show-report
```
