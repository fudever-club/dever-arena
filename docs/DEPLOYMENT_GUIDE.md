# HƯỚNG DẪN TRIỂN KHAI HẠ TẦNG & PRODUCTION DEPLOYMENT
> **Kiến trúc:** Microservices phân tán đóng gói qua Docker Compose, sẵn sàng chịu tải 500+ thí sinh nộp bài đồng thời trong kỳ thi toàn trường.

---

## 1. SƠ ĐỒ KIẾN TRÚC HẠ TẦNG (INFRASTRUCTURE OVERVIEW)

```mermaid
graph TD
    User([Thí sinh & Giám khảo]) -->|HTTPS / WSS| NGINX[Nginx Reverse Proxy & SSL Termination]
    
    subgraph App Cluster
        NGINX -->|HTTP API| WebApp1[DEVER Arena Web & API Server #1]
        NGINX -->|HTTP API| WebApp2[DEVER Arena Web & API Server #2]
        NGINX -->|WebSocket| WSGateway[Realtime WebSocket Gateway]
    end
    
    WebApp1 --> DB[(PostgreSQL 16 Primary)]
    WebApp2 --> DB
    
    WebApp1 --> Redis[(Redis Queue & Cache Cluster)]
    WebApp2 --> Redis
    WSGateway --> Redis
    
    subgraph Distributed Judge Cluster
        Redis -->|Pretest & Instant Hack Queue| Worker1[Judge Worker Node #1 - Isolate Sandbox]
        Redis -->|Pretest & Instant Hack Queue| Worker2[Judge Worker Node #2 - Isolate Sandbox]
        Redis -->|Batch System Test Queue| Worker3[Judge Worker Node #3 - Batch Rejudger]
    end
```

---

## 2. FILE CẤU HÌNH DOCKER COMPOSE MẪU (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  # CƠ SỞ DỮ LIỆU POSTGRESQL
  postgres:
    image: postgres:16-alpine
    container_name: dever_postgres
    restart: always
    environment:
      POSTGRES_DB: dever_arena
      POSTGRES_USER: dever_admin
      POSTGRES_PASSWORD: ${DB_STRONG_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - dever_internal

  # REDIS QUEUE & LEADERBOARD CACHE
  redis:
    image: redis:7-alpine
    container_name: dever_redis
    restart: always
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_STRONG_PASSWORD}"]
    volumes:
      - redis_data:/data
    networks:
      - dever_internal

  # MÁY CHỦ WEB & API
  api_server:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: dever_api
    restart: always
    environment:
      DATABASE_URL: postgres://dever_admin:${DB_STRONG_PASSWORD}@postgres:5432/dever_arena
      REDIS_URL: redis://:${REDIS_STRONG_PASSWORD}@redis:6379/0
      JWT_SECRET: ${JWT_SECRET_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - dever_internal

  # MÁY CHỦ CHẤM CÔ LẬP (JUDGE WORKER)
  judge_worker:
    build:
      context: .
      dockerfile: Dockerfile.judge
    container_name: dever_judge_worker
    restart: always
    privileged: true # Cần quyền để Isolate sandbox quản lý Linux namespaces và cgroups
    environment:
      REDIS_URL: redis://:${REDIS_STRONG_PASSWORD}@redis:6379/0
      MAX_CONCURRENT_JOBS: 4
    depends_on:
      - redis
    networks:
      - dever_internal

  # NGINX REVERSE PROXY
  nginx:
    image: nginx:alpine
    container_name: dever_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api_server
    networks:
      - dever_internal

networks:
  dever_internal:
    driver: bridge

volumes:
  pg_data:
  redis_data:
```

---

### 2.1 CẤU HÌNH BẢO MẬT NGINX (`nginx.conf`) — PRODUCTION HARDENING

Tuân thủ quy chuẩn **OWASP Top 10** và kỹ năng `security-and-hardening`:

```nginx
# Rate Limiting: Chống DoS và brute-force
limit_req_zone $binary_remote_addr zone=dever_api_limit:10m rate=15r/s;
limit_req_zone $binary_remote_addr zone=dever_auth_limit:10m rate=5r/s;

server {
    listen 80;
    server_name arena.fu-dever.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name arena.fu-dever.com;

    ssl_certificate /etc/letsencrypt/live/arena.fu-dever.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/arena.fu-dever.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ==========================================
    # SECURITY HEADERS (OWASP Standard)
    # ==========================================
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self' ws: wss:;" always;

    # Client code uploads & testcase payload guard (Max 10MB)
    client_max_body_size 10M;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        limit_req zone=dever_api_limit burst=20 nodelay;
        proxy_pass http://api_server:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/v1/auth/ {
        limit_req zone=dever_auth_limit burst=5 nodelay;
        proxy_pass http://api_server:3000;
    }
}
```

---

## 3. CHECKLIST TRƯỚC GIỜ KHỞI TRANH (PRE-CONTEST CHECKLIST)

1. **Kiểm tra dung lượng ổ đĩa:** Đảm bảo thư mục `/var/tmp/isolate` còn trống ít nhất 10GB để chứa file nhị phân biên dịch.
2. **Kiểm tra giới hạn hệ điều hành (`ulimit`):**
   * Mở file descriptors: `ulimit -n 65535`
   * Giới hạn tiến trình: `ulimit -u 4096`
3. **Kiểm tra đồng bộ thời gian máy chủ (NTP):** Bắt buộc chạy `systemd-timesyncd` hoặc `chrony` để đảm bảo thời gian máy chủ lệch không quá 10ms so với giờ quốc gia.
4. **Warm-up Redis Cache:** Nạp trước toàn bộ metadata đề bài và tập Pretests vào RAM của Redis trước giờ thi 15 phút.
5. **Kiểm tra manifest.json và og:image (PWA & SEO):** Xác thực `manifest.json` hợp lệ (`name`, `short_name`, `icons` 192/512, `start_url`, `display: standalone`, `theme_color`), `og:title`/`og:description`/`og:image` hiển thị đúng preview khi share link, `theme-color` khớp brand, icon không 404; Lighthouse PWA ≥90 trước giờ thi.

---

## 4. PWA & SEO

> **Trạng thái Vòng 8:** Đã thêm PWA manifest + Open Graph cho 3 trang. Không cần cài đặt bổ sung — chỉ verify trước contest.

### 4.1 `manifest.json` (PWA)

* **Vị trí:** `/manifest.json` (root, cùng cấp `index.html`), được liên kết từ cả 3 trang qua `<link rel="manifest" href="manifest.json">`.
* **Nội dung hiện tại (`manifest.json:1`):**
  ```json
  {
    "name": "DEVER Arena",
    "short_name": "DEVER",
    "icons": [
      { "src": "data:image/png;base64,...", "sizes": "192x192", "type": "image/png" },
      { "src": "data:image/png;base64,...", "sizes": "512x512", "type": "image/png" }
    ],
    "start_url": "index.html",
    "display": "standalone",
    "theme_color": "#ff6600"
  }
  ```
* **Ý nghĩa:** Cho phép “Add to Home Screen” (standalone display), splash icon 192/512, theme màu cam `#ff6600` đồng bộ `meta theme-color`.
* **Nginx:** Serve `manifest.json` với `Content-Type: application/manifest+json`, cache 1h (`expires 1h; add_header Cache-Control "public"`). Không cần service worker ở vòng này.

### 4.2 `og:*` & SEO meta (3 trang)

* **Đã thêm trong `<head>` của `index.html:7`, `arena.html:7`, `admin.html:7`:**
  ```html
  <meta name="theme-color" content="#ff6600"> <!-- admin.html dùng #ff3366 -->
  <meta name="color-scheme" content="dark light">
  <link rel="manifest" href="manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta property="og:title" content="DEVER Arena — Thi đấu thuật toán">
  <meta property="og:description" content="... (mô tả riêng per-page: Landing / Arena / Admin)">
  <meta property="og:image" content="data:image/png;base64,..."> <!-- placeholder 1x1, thay bằng /og-image.png khi có asset thật -->
  <meta name="description" content="...">
  ```
* **Kiểm tra:** Dùng [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) hoặc `curl -s https://arena.fu-dever.com | grep og:` và DevTools → Application → Manifest. Đảm bảo `og:image` không 404, kích thước khuyến nghị 1200×630 khi thay placeholder.
* **SEO phụ:** Mỗi trang có `<title>` riêng, 1 `<h1>` duy nhất, `lang="vi"`, `viewport`, `skip-link`, semantic `<nav><main><section>` đã có.
