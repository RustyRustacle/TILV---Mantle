# TILV — Setup Guide

## Daftar Isi

1. [GitHub Actions CI](#1-github-actions-ci)
2. [Monitoring Stack (Prometheus + Grafana)](#2-monitoring-stack-prometheus--grafana)
3. [Deploy ke VPS / Cloud VM](#3-deploy-ke-vps--cloud-vm)
4. [Sentry Error Tracking](#4-sentry-error-tracking)
5. [Cron Backup Database](#5-cron-backup-database)
6. [Environment Checklist](#6-environment-checklist)

---

## 1. GitHub Actions CI

CI sudah dikonfigurasi di `.github/workflows/ci.yml`. Ada 3 job: **Contracts**, **Backend**, **Frontend**.

### Cara Aktifkan

1. **Push ke GitHub** — CI otomatis terdeteksi setelah repo di-push
2. **Buka tab Actions** di repo GitHub — akan muncul workflow `CI`
3. Pada pertama jalan, mungkin fail karena belum ada **secrets**. Yang perlu di-set:
   - Pergi ke Settings → Secrets and variables → Actions
   - `JWT_SECRET` — `openssl rand -hex 32`
   - `PRIVATE_KEY` — private key deployer wallet
   - `MANTLE_RPC_URL` — `https://rpc.mantle.xyz`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — project ID dari WalletConnect Cloud
   - `NEXT_PUBLIC_VAULT_MANAGER_ADDRESS` — alamat VaultManager

4. Edit `.github/workflows/ci.yml` — tambah `env:` di job `backend` dan `frontend`:
   ```yaml
   backend:
     steps:
       - run: npm ci
       - run: npm run build
         env:
           JWT_SECRET: ${{ secrets.JWT_SECRET }}
           PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
       - run: npm test
   ```
   ```yaml
   frontend:
     steps:
       - run: npm ci
       - run: npm run build
         env:
           NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: ${{ secrets.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID }}
           NEXT_PUBLIC_VAULT_MANAGER_ADDRESS: ${{ secrets.NEXT_PUBLIC_VAULT_MANAGER_ADDRESS }}
           NEXT_PUBLIC_MANTLE_RPC: ${{ secrets.MANTLE_RPC_URL }}
           NEXT_PUBLIC_MANTLE_CHAIN_ID: "5000"
           NEXT_PUBLIC_MAINNET: "true"
       - run: npm run lint
   ```

5. Commit & push — CI akan jalan otomatis di tiap PR ke `main`.

> **Catatan:** Untuk frontend `build`, env vars harus diisi karena Next.js membaca `NEXT_PUBLIC_*` saat build time.

---

## 2. Monitoring Stack (Prometheus + Grafana)

Backend sudah punya endpoint `GET /metrics` yang expose Prometheus metrics.

### Cara Jalankan

```bash
cd docker

# Start semua services + monitoring
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Atau kalau mau monitoring aja tanpa rebuild services lain:
docker compose -f docker-compose.prod.yml up -d prometheus grafana
```

### Akses Dashboard

| Service   | URL                          | Login              |
|-----------|------------------------------|--------------------|
| Grafana   | http://localhost:3002         | admin / admin      |
| Prometheus | http://localhost:9090        | —                  |

### Setup Grafana

1. Buka http://localhost:3002, login `admin` / `admin` (ganti password pas pertama login)
2. Masuk ke **Dashboards** → pilih **TILV Overview**
3. Panel yang tersedia:
   - **HTTP Request Rate** — rate request per method/route
   - **Request Duration (p99)** — latency percentile 99
   - **Active Connections** — koneksi aktif real-time
   - **Contract Calls per Method** — rate panggilan smart contract

### Cara Tambah Alert (Opsional)

Di Grafana:
1. Buka dashboard → Edit panel → Alert tab
2. Contoh: alert kalau `tilv_active_connections > 100` untuk 5 menit
3. Pilih notification channel (email, Slack, Telegram)

---

## 3. Deploy ke VPS / Cloud VM

### Prasyarat

- VM dengan Docker & docker compose terinstall
- Domain (opsional, bisa pake IP)
- Nginx reverse proxy (untuk SSL)

### Langkah

```bash
# 1. Clone repo di VPS
git clone https://github.com/<username>/tilv.git /opt/tilv
cd /opt/tilv

# 2. Copy & edit environment
cp docker/.env docker/.env.prod
nano docker/.env.prod
# Isi semua CHANGE_ME_* password
# Set MAINNET=true, MANTLE_CHAIN_ID=5000, dll

# 3. Build & start
cd docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. Verify
curl http://localhost:3001/health
curl http://localhost:5000/health
curl http://localhost:3000
curl http://localhost:3002  # Grafana
```

### Nginx + SSL (Opsional)

```nginx
# /etc/nginx/sites-available/tilv
server {
    listen 80;
    server_name tilv.domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Install SSL dengan certbot
sudo certbot --nginx -d tilv.domain.com
```

---

## 4. Sentry Error Tracking

Sentry **belum terinstall**. Berikut cara setup:

### Backend

```bash
cd backend
npm install @sentry/node @sentry/profiling-node
```

Tambahkan di `src/index.ts` (paling atas, sebelum import lain):

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.1,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

Tambah `SENTRY_DSN=` ke `backend/.env` dan `docker/.env`.

### Frontend

```bash
cd frontend
npm install @sentry/nextjs
npx sentry-wizard -i nextjs
```

---

## 5. Cron Backup Database

Buat script backup di server:

```bash
# /opt/tilv/scripts/backup.sh
#!/bin/bash
BACKUP_DIR="/opt/tilv/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Backup MongoDB
docker exec tilv-mongodb mongodump \
  --username admin \
  --password $MONGO_ROOT_PASSWORD \
  --authenticationDatabase admin \
  --out /tmp/mongodump_$DATE

docker cp tilv-mongodb:/tmp/mongodump_$DATE $BACKUP_DIR/mongodb/
docker exec tilv-mongodb rm -rf /tmp/mongodump_$DATE

# Backup Redis
docker exec tilv-redis redis-cli --raw incr ping
docker exec tilv-redis redis-cli SAVE

# Compress & cleanup
tar -czf $BACKUP_DIR/tilv_backup_$DATE.tar.gz -C $BACKUP_DIR mongodb/
rm -rf $BACKUP_DIR/mongodb/

# Delete backups older than RETENTION_DAYS
find $BACKUP_DIR -name "tilv_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

Crontab (jalan tiap hari jam 3 pagi):

```bash
crontab -e
# Tambahkan:
0 3 * * * /opt/tilv/scripts/backup.sh >> /var/log/tilv-backup.log 2>&1
```

---

## 6. Environment Checklist

Sebelum production, pastikan semua ini terisi:

### `docker/.env`

| Variable | Status | Notes |
|----------|--------|-------|
| `MONGO_ROOT_PASSWORD` | ❌ CHANGE_ME | Generate: `openssl rand -base64 24` |
| `REDIS_PASSWORD` | ❌ CHANGE_ME | Generate: `openssl rand -base64 24` |
| `JWT_SECRET` | ✅ Terisi | Tapi ganti untuk prod |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ Terisi | Dari WalletConnect Cloud |
| `GRAFANA_ADMIN_PASSWORD` | ❌ Default | Ganti di docker-compose.prod.yml env |
| `MONGO_EXPRESS_PASSWORD` | ❌ CHANGE_ME | Ganti atau hapus mongo-express |

### `backend/.env`

| Variable | Status | Notes |
|----------|--------|-------|
| `JWT_SECRET` | ✅ Hardcoded | Ganti untuk prod |
| `PRIVATE_KEY` | ✅ Hardcoded | Ganti untuk prod!! |
| `AI_SHARED_SECRET` | ✅ Hardcoded | Ganti untuk prod |
| `SENTRY_DSN` | ❌ Belum ada | Tambah kalau pake Sentry |

### Yang Perlu Diganti untuk Production

```bash
# Generate semua secret baru
openssl rand -hex 32          # JWT_SECRET
openssl rand -base64 24       # MONGO_ROOT_PASSWORD
openssl rand -base64 24       # REDIS_PASSWORD
openssl rand -base64 32       # AI_SHARED_SECRET

# Generate wallet baru untuk backend
# (bikin wallet baru, kirim sedikit MNT, ganti PRIVATE_KEY)
```
