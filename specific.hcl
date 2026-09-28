# DEVER Arena on Specific — api (REST+SSE+judge) + web (React SPA) + postgres
#
# - api: Node server (server/index.js), tự tạo bảng khi kết nối Postgres lần đầu.
# - web: Vite SPA, build tĩnh rồi phục vụ bằng `vite preview`; gọi API qua VITE_API_URL.
# - postgres: DB managed, URL bơm vào DEVER_DATABASE_URL (xem server/pg.js).

secret "dever_jwt_secret" {
  generated = true
}

postgres "main" {}

# Task 118: object store cho source_code thí sinh (S3-compatible).
storage "sources" {}

# Custom Dockerfile: cần toolchain chấm thật (python3, JDK 17, g++) — xem Dockerfile.api.
build "api" {
  dockerfile = "Dockerfile.api"
}

service "api" {
  build = build.api
  command = "node server/index.js"

  endpoint {
    public = true

    health_check {
      path = "/api/health"
    }
  }

  env = {
    PORT                = port
    NODE_ENV            = "production"
    DEVER_JWT_SECRET    = secret.dever_jwt_secret
    DEVER_DATABASE_URL  = postgres.main.url
    DEVER_CORS_ORIGIN   = "https://${service.web.public_url}"
    DEVER_JUDGE_WORKERS = "2"
    S3_ENDPOINT         = storage.sources.endpoint
    S3_ACCESS_KEY       = storage.sources.access_key
    S3_SECRET_KEY       = storage.sources.secret_key
    S3_BUCKET           = storage.sources.bucket

    # Task 123: data thật cho CLB — không seed ghost/demo users và bài nộp ảo.
    # Bật lại demo (rồi deploy lại) bằng cách đổi thành "1".
    DEVER_SEED_DEMO     = "0"
  }
}

# Task 120: backup DB hằng ngày (02:00 UTC = 09:00 VN) — dump KV → JSON → S3 bucket.
cron "db-backup" {
  build    = build.api
  command  = "node scripts/backup_cron.mjs"
  schedule = "0 2 * * *"

  env = {
    DEVER_DATABASE_URL = postgres.main.url
    S3_ENDPOINT        = storage.sources.endpoint
    S3_ACCESS_KEY      = storage.sources.access_key
    S3_SECRET_KEY      = storage.sources.secret_key
    S3_BUCKET          = storage.sources.bucket
  }
}

build "web" {
  base    = "node"
  command = "npm run build"

  env = {
    VITE_API_URL = "https://${service.api.public_url}"
  }
}

service "web" {
  build   = build.web
  command = "npx vite preview"

  endpoint {
    public = true
  }

  env = {
    PORT = port
  }

  dev {
    command = "npm run dev"

    env = {
      # vite.config.js đọc biến này để proxy /api về đúng port API cục bộ.
      DEVER_API_PORT = service.api.port
    }
  }
}
