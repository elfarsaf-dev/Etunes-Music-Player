# Panduan Build etunes ke expo.dev (EAS Build)

> Semua perintah dijalankan **di komputer lokal** kamu, di dalam folder `artifacts/etunes`.
> Bukan di Replit (Replit cuma buat dev, bukan buat build APK).

---

## 1. Persiapan (sekali aja)

### Install EAS CLI
```bash
npm install -g eas-cli
```

### Login ke akun Expo kamu
```bash
eas login
```
Cek udah login:
```bash
eas whoami
```

### Hubungkan project ke akun Expo kamu
Dari folder `artifacts/etunes`:
```bash
eas init
```
Perintah ini akan:
- Bikin project baru di expo.dev (atau pakai yang udah ada)
- Otomatis nambahin `extra.eas.projectId` & `owner` ke `app.json`

---

## 2. Build APK (paling sering dipakai — buat install langsung di HP)

```bash
pnpm run build:apk
```
atau langsung:
```bash
eas build --platform android --profile preview
```

**Yang terjadi:**
- File project di-upload ke server Expo (cloud build, ±10–20 menit)
- Setelah selesai, dapat link `.apk` di terminal & email
- Buka link di HP Android, download, install. Selesai.

---

## 3. Build AAB buat Google Play Store

```bash
pnpm run build:android
```
atau:
```bash
eas build --platform android --profile production
```

Hasilnya `.aab` (Android App Bundle) — formatnya yang dibutuhkan Play Store.

---

## 4. Build Development (buat ngetes pakai Expo Dev Client)

```bash
pnpm run build:dev
```
Pakai ini kalau mau debug fitur native (audio background, file system, dll) sambil tetap bisa hot-reload.

---

## 5. Submit ke Play Store (opsional)

Setelah punya akun Google Play Console + service account JSON:
```bash
pnpm run submit:android
```

---

## Profile Build (di `eas.json`)

| Profile      | Output | Kapan dipakai                             |
|--------------|--------|-------------------------------------------|
| `development`| APK    | Debug + Expo Dev Client                   |
| `preview`    | APK    | Test internal / kasih ke teman / install di HP sendiri |
| `production` | AAB    | Upload ke Play Store                      |

---

## Catatan Penting buat etunes

- **Free tier Expo** = 30 build/bulan. Cukup banget buat testing.
- Project ini pakai `newArchEnabled: true` + `expo-audio` v55 → 100% kompatibel EAS Build.
- Permission Android (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `READ_MEDIA_AUDIO`, dll) udah dikonfigurasi di `app.json`, jadi otomatis ke-bundle.
- Kalau pertama kali build, EAS akan minta generate **keystore** otomatis — pilih `Yes`. Keystore disimpan di server Expo (aman, ga bakal hilang).
- Versi app naik otomatis di profile `production` (`autoIncrement: true`).

---

## Troubleshooting

**"Project not configured"** → jalanin `eas init` dulu.

**"Invalid keystore"** → hapus credentials lama: `eas credentials` → pilih Android → Remove keystore.

**Build gagal di Gradle** → cek log di link yang dikasih EAS, biasanya soal versi package atau permission.

**APK ga bisa di-install** → pastikan setting HP Android: Settings → Security → Install unknown apps → izinin.
