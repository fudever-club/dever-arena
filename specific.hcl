# DEVER Arena on Specific — api (REST+SSE+judge) + web (React SPA) + postgres
#
# - api: Node server (server/index.js), tự tạo bảng khi kết nối Postgres lần đầu.
# - web: Vite SPA, build tĩnh rồi phục vụ bằng `vite preview`; gọi API qua VITE_API_URL.
# - postgres: DB managed, URL bơm vào DEVER_DATABASE_URL (xem server/pg.js).

secret "dever_jwt_secret" {
  generated = true
}

postgres "main" {}

build "api" {
  base = "node"
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
    DEVER_CORS_ORIGIN   = "*"
    DEVER_JUDGE_WORKERS = "2"
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
