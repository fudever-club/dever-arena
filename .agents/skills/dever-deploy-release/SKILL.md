---
name: dever-deploy-release
description: Deployment & Release Engineer for DEVER Arena. Specialized in CI pipelines, Docker production builds, nginx routing, health/readiness gates, versioned releases, and safe rollbacks. Triggers when shipping, releasing, containerizing, or rolling back.
---

# Deploy & Release Skill

## Overview
Owns everything between "tests pass on laptop" and "contest runs in production". Source of truth: `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `nginx.conf`, `.env.example`, `.github/workflows/ci.yml`.

## Release Pipeline (mandatory order)
1. **Verify local:** `npm run test` (139 pass) → `node detect.mjs` (0 error) → `npm run build` (sạch).
2. **CI gate:** push/PR chạy `.github/workflows/ci.yml` (npm ci + detect + test + build + `npm audit --audit-level=high`). Không merge khi đỏ.
3. **Version:** bump `package.json` theo semver (fix → patch, tính năng → minor, đổi luật contest → major). Ghi `docs/CHANGELOG.md` theo vòng.
4. **Ship:** `cp .env.example .env` (điền `DEVER_JWT_SECRET` + `DEVER_DB_PASSWORD` thật) → `docker compose up --build -d`.
5. **Gate:** `curl /api/health` (200 + `status:ok`) → `curl /api/ready` (200 + `ready:true`) → mở web kiểm tra standings live.

## Production Guards
- `server/index.js` từ chối khởi động khi thiếu `DEVER_JWT_SECRET` ở production.
- Compose: `healthcheck` API (poll `/api/health` 15s), web chỉ start khi api healthy; limits api 2CPU/2G, web 1CPU/512M.
- Secrets chỉ trong `.env` (không commit). CORS `DEVER_CORS_ORIGIN` theo domain web thật, không `*` ở production.

## Rollback (khi release lỗi giữa contest)
1. `docker compose logs --tail=100 api` xác định lỗi.
2. `git checkout <tag-cũ> && docker compose up --build -d api web`.
3. Nếu nghi mất dữ liệu: `npm run restore -- backups/db-<mới-nhất>.json && docker compose restart api`.
4. Ghi entry vào `docs/ops/INCIDENT_RUNBOOK.md` hậu kiểm.
