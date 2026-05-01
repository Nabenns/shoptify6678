# Spotify Trial Automation

Automation testing untuk flow trial signup Spotify internal staging — register, carrier billing, OTP verify, trial active — dengan 3 instance paralel.

---

## Arsitektur

```
spotify-garap/
├── playwright.config.ts        # Config utama: workers:3, fullyParallel, 2 project (unit + e2e)
├── .env.example                # Template env vars yang wajib diisi
│
├── fixtures/
│   └── otpku.ts                # HTTP client untuk API otpku.co.id (beli nomor, poll OTP)
│
├── pages/
│   └── signup.page.ts          # Page object Spotify staging (selector placeholder — wajib diupdate)
│
├── utils/
│   └── reporter.ts             # Tulis hasil test ke results/report.json (NDJSON, paralel-safe)
│
├── tests/
│   ├── trial-signup.spec.ts    # E2E utama: 3 instance paralel, retry logic, OTP flow
│   ├── otpku.unit.spec.ts      # Unit tests: API client (11 test total)
│   └── reporter.unit.spec.ts   # Unit tests: reporter utility
│
└── results/
    └── report.json             # Output hasil setiap instance (dibuat saat run)
```

---

## Flow Per Instance

```
1. Generate email: [random8char]@forapps.site
2. Beli nomor virtual dari otpku API (getNumber) → dapat {id, number}
3. Buka halaman signup Spotify staging → isi form → submit
4. Cek apakah auto-login atau perlu login manual
5. Navigasi ke halaman subscription/premium
6. Pilih metode: carrier/operator billing
7. Input nomor telepon dari otpku
8. Poll OTP setiap 5 detik, max 60 detik (getStatus)
9. Input OTP → submit
10. Assert "Trial Active" muncul di dashboard
11. Simpan hasil ke results/report.json

Jika gagal di step manapun:
→ cancelActivation (refund saldo otpku)
→ Retry dari awal dengan kredensial + nomor baru
→ Max 3x retry per instance
```

3 instance jalan **bersamaan** di 3 browser context terpisah.

---

## Stack

| Tool | Versi | Fungsi |
|------|-------|--------|
| Playwright | ^1.45 | Browser automation, test runner |
| TypeScript | ^5.4 | Bahasa utama |
| @faker-js/faker | ^9 | Generate random email, nama, password |
| dotenv | ^16 | Load `.env` ke `process.env` |
| otpku.co.id API | — | Virtual phone number + SMS OTP |
| Node.js | >=18 | Runtime (wajib 18+) |

---

## Cara Run

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Setup `.env`

```bash
cp .env.example .env
```

Isi `.env`:

```env
BASE_URL=https://<url-staging-spotify-internal>
OTP_API_KEY=<api-key-dari-dashboard-otpku>
OTP_SERVICE_CODE=<kode-layanan-spotify-di-otpku>
OTP_COUNTRY=<kode-negara-otpku>
```

### 3. Update selectors

Selectors di `pages/signup.page.ts` masih **placeholder**. Jalankan codegen untuk dapat selector nyata:

```bash
npx playwright codegen $BASE_URL
```

Ganti setiap baris `// SELECTOR` di [pages/signup.page.ts](pages/signup.page.ts) dengan selector dari inspector.

### 4. Run

```bash
# E2E (3 instance paralel)
npm run test:e2e

# Unit tests saja
npm run test:unit

# Semua (unit + e2e)
npm test
```

### 5. Lihat hasil

```bash
# Raw output per instance
cat results/report.json

# HTML report dengan screenshot/trace
npx playwright show-report
```

**Format `results/report.json`** (NDJSON — satu baris per instance):
```
{"instance":1,"email":"xkqp3mab@forapps.site","phone":"628111xxx","status":"trial_active","timestamp":"..."}
{"instance":2,"email":"jfvn9qzx@forapps.site","phone":"628222xxx","status":"trial_active","timestamp":"..."}
{"instance":3,"email":"ywbm2lkp@forapps.site","phone":"628333xxx","status":"failed","error":"OTP timeout after 3 retries","timestamp":"..."}
```

---

## API otpku

Base URL: `https://my.otpku.co.id/api/`  
Auth: `?api_key=<OTP_API_KEY>` di setiap request

| Action | Params | Keterangan |
|--------|--------|------------|
| `getNumber` | `service`, `country` | Beli nomor virtual (kurangi saldo) |
| `getStatus` | `id` | Cek apakah SMS sudah masuk |
| `cancelActivation` | `id` | Batalkan & refund saldo |

Cek saldo sebelum run: [my.otpku.co.id](https://my.otpku.co.id)

---

## Todolist Sebelum Bisa Run

> Checklist ini wajib selesai semua sebelum `npm run test:e2e` bisa jalan.

### Konfigurasi (wajib)

- [ ] **Isi `BASE_URL`** — URL internal staging Spotify (tanyakan ke tim)
- [ ] **Isi `OTP_API_KEY`** — ambil dari dashboard otpku.co.id (sudah ada di screenshot)
- [ ] **Cari `OTP_SERVICE_CODE`** — buka otpku dashboard → `getPrices` → cari service code untuk Spotify
- [ ] **Cari `OTP_COUNTRY`** — cek kode negara di otpku (Indonesia biasanya `6` atau `62`, konfirmasi di dashboard)
- [ ] **Pastikan saldo otpku cukup** — minimal 3x harga nomor (untuk 3 instance paralel)

### Selectors (wajib)

- [ ] **Jalankan `npx playwright codegen $BASE_URL`**
- [ ] **Update selector di `pages/signup.page.ts`:**
  - [ ] Path halaman signup (sekarang `/signup`)
  - [ ] Input email form registrasi
  - [ ] Input display name / nama
  - [ ] Input password
  - [ ] Tombol submit registrasi
  - [ ] Deteksi login form (untuk cek auto-login atau tidak)
  - [ ] Input username/email login
  - [ ] Input password login
  - [ ] Tombol login
  - [ ] Path halaman subscription (sekarang `/premium`)
  - [ ] Option carrier/operator billing
  - [ ] Input nomor telepon
  - [ ] Tombol submit nomor telepon
  - [ ] Input OTP
  - [ ] Tombol submit OTP
  - [ ] Elemen "Trial Active" di dashboard (untuk assertion sukses)

### Verifikasi

- [ ] **Run unit tests** — pastikan semua 11 test masih pass: `npm run test:unit`
- [ ] **Run 1 instance dulu** untuk smoke test: `npx playwright test --project=e2e --workers=1`
- [ ] **Cek `results/report.json`** setelah run — pastikan status `trial_active`
- [ ] **Run 3 instance paralel**: `npm run test:e2e`

---

## Troubleshooting

| Error | Kemungkinan Penyebab | Fix |
|-------|---------------------|-----|
| `Required env var OTP_API_KEY is not set` | `.env` belum dibuat atau variabel kosong | Buat `.env` dari `.env.example` |
| `getNumber failed` | Saldo otpku habis / service code salah | Cek saldo + konfirmasi `OTP_SERVICE_CODE` |
| `OTP not received after 12 attempts` | SMS tidak masuk dalam 60 detik | Cek nomor valid untuk Spotify, coba negara lain |
| `Timeout` di browser | Selector salah / halaman staging lambat | Update selector via codegen, naikkan timeout di config |
| `trial_active` tidak muncul | Flow berhasil tapi assertion gagal | Update selector `assertTrialActive` di page object |
