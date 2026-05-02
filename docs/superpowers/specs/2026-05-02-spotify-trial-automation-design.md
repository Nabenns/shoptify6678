# Design: Spotify Trial Signup Automation

**Date:** 2026-05-02  
**Stack:** Playwright + TypeScript, otpku.co.id API  
**Target:** Spotify internal staging environment

---

## Overview

Automation test yang menjalankan 3 instance paralel untuk flow trial signup Spotify:  
register → carrier billing → OTP verify → trial active.

---

## Project Structure

```
spotify-garap/
├── playwright.config.ts       # workers:3, baseURL, timeouts
├── .env                       # BASE_URL, OTP_API_KEY, OTP_SERVICE_CODE, OTP_COUNTRY
├── package.json
├── tests/
│   └── trial-signup.spec.ts   # 1 test, dijalankan 3x paralel via workers
├── fixtures/
│   └── otpku.fixture.ts       # getNumber, getStatus, cancelActivation
├── pages/
│   └── signup.page.ts         # selectors & actions untuk halaman Spotify staging
└── results/
    └── report.json            # output per instance
```

---

## Flow Per Instance

```
1. SETUP
   - Generate email: [random8char]@forapps.site (via faker)
   - getNumber dari otpku API → { id, number }

2. REGISTER
   - Buka halaman signup Spotify staging
   - Isi: email, nama (faker), password (random valid)
   - Submit form

3. LOGIN (jika tidak auto-login)
   - Deteksi: dashboard atau login page
   - Jika login page → isi credentials → submit

4. CARRIER BILLING
   - Navigasi ke halaman subscription/trial
   - Pilih metode: operator/carrier billing
   - Input nomor telepon dari getNumber

5. OTP VERIFICATION (dengan retry logic)
   - Poll getStatus tiap 5 detik, max 60 detik
   - Jika status=OK → input OTP ke form → submit
   - Jika timeout/gagal → cancelActivation (refund) → ulangi dari step 1
   - Max 3x retry per instance

6. VERIFIKASI SUKSES
   - Assert: "Trial Active" muncul di dashboard
   - Tulis hasil ke results/report.json
```

---

## API Integration — otpku.co.id

**Base URL:** `https://my.otpku.co.id/api/`  
**Auth:** `?api_key=<OTP_API_KEY>` di setiap request  

| Action | Params | Keterangan |
|--------|--------|------------|
| `getNumber` | `service`, `country` | Beli nomor virtual (destructive, kurangi saldo) |
| `getStatus` | `id` | Poll apakah SMS sudah masuk |
| `cancelActivation` | `id` | Batalkan & refund saldo |

**Polling strategy:** tiap 5 detik, max 12x (60 detik total)  
**Retry strategy:** max 3x per instance, cancelActivation sebelum retry

---

## Configuration (.env)

```
BASE_URL=https://staging.spotify.com        # URL Spotify internal staging
OTP_API_KEY=<api_key_otpku>
OTP_SERVICE_CODE=<kode_service_spotify>     # diisi setelah dicek di otpku dashboard
OTP_COUNTRY=<country_code>                  # contoh: 6 untuk Indonesia
```

---

## Reporting

Output `results/report.json`:

```json
[
  {
    "instance": 1,
    "email": "xkqp3mab@forapps.site",
    "phone": "628123xxx",
    "status": "trial_active",
    "timestamp": "2026-05-02T10:00:00Z"
  },
  {
    "instance": 2,
    "email": "jfvn9qzx@forapps.site",
    "phone": "628456xxx",
    "status": "failed",
    "error": "OTP timeout after 3 retries",
    "timestamp": "2026-05-02T10:00:05Z"
  }
]
```

Plus Playwright HTML report untuk screenshot & trace on failure.

---

## Error Handling

- OTP timeout → cancelActivation → retry (max 3x)
- Signup form error → log & fail instance (tidak retry, beda masalah)
- Nomor sudah dipakai Spotify → cancelActivation → getNumber baru
- Worker crash tidak mempengaruhi worker lain (isolated context)

---

## Run Command

```bash
npx playwright test --workers=3
```
