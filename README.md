<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/FU_DEVER_Logo_White_Layers_Red_Accent.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/logodever-01.png">
  <img alt="CLB FU-DEVER Logo" src="docs/assets/logodever-01.png" width="260">
</picture>

# ⚔️ DEVER Arena (DEVER-Forces)

**Nền tảng thi đấu lập trình giải thuật trực tuyến chuẩn Codeforces & ICPC của CLB FU-DEVER — Trường Đại học FPT Đà Nẵng**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-157%2F157%20Passed%20(100%25)-success?logo=checkmarx&logoColor=white)](tests/)
[![Website](https://img.shields.io/badge/Website-fudever.com-FF6600?logo=google-chrome&logoColor=white)](https://fu-dever-landingpage-v2.vercel.app/)
[![GitHub Org](https://img.shields.io/badge/GitHub-fudever--club-181717?logo=github&logoColor=white)](https://github.com/fudever-club)

[Tổng Quan](#gioi-thieu-tong-quan) • [Tính Năng Nổi Bật](#tinh-nang-noi-bat) • [Kiến Trúc Hệ Thống](#kien-truc-he-thong) • [Vòng Đời Contest](#vong-doi-contest) • [Sổ Bộ ADR](#so-bo-adr) • [Cài Đặt & Khởi Chạy](#cai-dat-khoi-chay) • [Kiểm Thử](#kiem-thu-chat-luong) • [Cấu Trúc Thư Mục](#cau-truc-thu-muc) • [Ban Phát Triển](#ban-phat-trien)

---

</div>

<a id="gioi-thieu-tong-quan"></a>
## 📌 Giới Thiệu Tổng Quan

**DEVER Arena** (mật danh: *DEVER-Forces*) là nền tảng thi đấu thuật toán và luyện tập Competitive Programming chuyên sâu được nghiên cứu và phát triển bởi **CLB Lập trình FU-DEVER (Trường Đại học FPT Đà Nẵng)**.

Hệ thống được thiết kế nhằm mục đích:
1. **Vòng đời thi đấu theo thể thức Codeforces**: phân phòng 25 người, chấm pretest, phase bẻ khóa bài đối thủ (hack +100/−50) và chấm lại toàn bộ (system test) trước khi chốt Elo.
2. **Liêm chính học thuật**: quét tương đồng mã nguồn AST sau contest, cấm AI sinh code trong các round tính điểm (ADR-003).
3. **Học qua phản biện**: đọc code bạn cùng phòng, tìm ca biên, tràn số và lỗi độ phức tạp trong Hack Phase.
4. **Tổ chức linh hoạt**: tài khoản cá nhân hoặc đội thi do admin cấp trước giờ contest, không đăng ký công khai.

---

<a id="tinh-nang-noi-bat"></a>
## ⚡ Tính Năng Nổi Bật

### 1. 🎯 Chế Độ Thi Đấu Chuẩn Codeforces & ICPC
* **Dynamic Time-Decay Scoring**: Điểm bài nộp giảm dần theo thời gian làm bài theo công thức chính thống Codeforces:
  $$\text{Score} = \max\left(0.3 \cdot P_{\max},\; P_{\max} - \frac{P_{\max} \cdot t}{250} - 50 \cdot W\right)$$
  *(với $P_{\max}$ là điểm tối đa, $t$ là số phút thi trôi qua, $W$ là số lần nộp Wrong Answer).*
* **Phòng Thách Đấu (Hack Room 25 Thí Sinh)**: Xem mã nguồn đối thủ trong cùng phòng thi, nộp test phản biện (Generator/Custom Test). Thách đấu thành công nhận **+100 điểm**, thách đấu sai bị phạt **-50 điểm**.
* **System Testing Tự Động**: Chạy toàn bộ 45+ bộ test ngầm bí mật để xác định kết quả chung cuộc, lật ngược tình thế trước khi cập nhật điểm xếp hạng Elo.
* **ICPC Scoreboard Freeze & Dramatic Reveal**: Đóng băng bảng điểm ở 60 phút cuối trận và công cụ mô phỏng giải băng kịch tính từng bài thi.

### 2. 🛡️ AST Winnowing Anti-Cheat Sentinel (ADR-004)
* **AST Tokenizer**: Phân tích cú pháp trừu tượng, loại bỏ bình luận, khoảng trắng, chuẩn hóa tên biến/hàm về token định danh đồng nhất `ID`.
* **Winnowing Fingerprinting Algorithm**: Tạo dấu vân tay mã nguồn k-gram/3-gram với chi phí bộ nhớ tối ưu.
* **Jaccard Distance Matrix**: Đối soát chéo toàn bộ lời giải trong cùng contest; tự động gắn cờ cảnh báo giám khảo khi độ tương đồng vượt ngưỡng 85%.
* **Zero-AI Client Contract**: Cam kết không tích hợp AI sinh code tự động vào workspace trong các contest Rated để bảo vệ liêm chính học thuật Olympic/ICPC.

### 3. 🧪 DEVER Polygon Problemsetter Studio
* **Testlib Input Validator**: Kiểm tra định dạng testcase cực kỳ nghiêm ngặt (kiểm tra newline cuối file, cấm trailing whitespace, kiểm soát biên $N$ và từng phần tử).
* **Custom Checker Suite**: Hỗ trợ 3 cơ chế chấm:
  - *Token Matcher*: So khớp từ vựng bỏ qua khoảng trắng/xuống dòng.
  - *Float Tolerance*: So khớp số thực với sai số $\epsilon = 10^{-6}$ hoặc $10^{-9}$.
  - *Multiple Solutions Verifier*: Trình chấm tùy biến cho bài toán có nhiều nghiệm hợp lệ.
* **KaTeX Math Typography**: Hiển thị công thức toán học LaTeX sắc nét trong đề bài và bộ test ví dụ.

### 4. 🕹️ Virtual Contest Simulator (Ghost Replay)
* Tái hiện lại bất kỳ contest đã diễn ra trong quá khứ.
* Hệ thống sinh dữ liệu ảo (Ghost Participants) với timeline nộp bài và tỉ lệ AC/WA theo từng phút thực tế.

---

<a id="kien-truc-he-thong"></a>
## 🏛️ Kiến Trúc Hệ Thống (Single-Stack React SPA)

DEVER Arena là single-stack React SPA duy nhất:

```
DEVER Arena (React 19 + Vite)
├── app.html         # Single Page Application Shell
├── src/             # Toàn bộ mã nguồn React 19 & Tailwind CSS v4
│   ├── components/  # Monaco Workspace, Resizable Splitters, KaTeX Math
│   ├── core/        # Pure Engine: Scoring, Rating, State Machine, Freeze
│   ├── engine/      # AST Winnowing, Isolate Sandbox, Testlib Validator
│   └── pages/       # Landing, ContestHub, Workspace, Standings, HackRoom, Admin
└── tests/           # Test suites native (xem mục Kiểm Thử)
```

1. **Single-stack React SPA**: Xây dựng trên nền **React 19**, **Vite 8**, **Tailwind CSS v4**, tích hợp **Monaco Editor Pro** (bộ gõ chuẩn VS Code), hỗ trợ **Resizable Splitters (20-80%)**, **Zen Mode**, **KaTeX Math Typography** và đồng bộ đa tab qua **BroadcastChannel**.

---

<a id="vong-doi-contest"></a>
## 🔄 Vòng Đời Thi Đấu Chuẩn Codeforces

```mermaid
stateDiagram-v2
    [*] --> Registration: Đăng ký & Phân phòng
    Registration --> CodingPhase: Bắt đầu Contest (120 phút)
    
    state CodingPhase {
        [*] --> SubmitCode: Nộp bài
        SubmitCode --> Pretests: Chấm Pretests
        Pretests --> PassedPretests: Chấp nhận tạm thời
        Pretests --> Rejected: Wrong Answer / TLE / MLE
    }
    
    CodingPhase --> HackPhase: Hết giờ Code (15 phút Hack)
    
    state HackPhase {
        [*] --> ReadOpponentCode: Soi code phòng 25 người
        ReadOpponentCode --> LaunchHack: Nộp Test phản biện
        LaunchHack --> SuccessHack: Hack Đúng (+100 điểm)
        LaunchHack --> FailedHack: Hack Sai (-50 điểm)
    }
    
    HackPhase --> SystemTesting: Chấm toàn bộ bài nộp (45 Tests)
    
    state SystemTesting {
        [*] --> RunHiddenTests: Kiểm thử ngầm
        RunHiddenTests --> Accepted: Trọn vẹn điểm
        RunHiddenTests --> FailedSystemTest: Mất điểm hoàn toàn
    }
    
    SystemTesting --> RatingUpdate: Tính toán lại Elo & Rank Badge
    RatingUpdate --> [*]: Hoàn tất Contest
```

---

<a id="so-bo-adr"></a>
## 📜 Sổ Bộ Quyết Định Kiến Trúc (ADR)

Mọi quyết định thiết kế quan trọng của hệ thống đều được lưu trữ minh bạch tại [`docs/decisions/`](docs/decisions/README.md):

| Mã số | Tiêu đề quyết định | Trạng thái | Tóm tắt tác động kỹ thuật |
|---|---|---|---|
| [**ADR-001**](docs/decisions/ADR-001-three-page-architecture.md) | Kiến trúc 3 trang HTML độc lập | **Accepted** | Tối ưu SEO (1 H1/trang), FCP < 360ms, cô lập ranh giới an ninh Thí sinh và Giám khảo. |
| [**ADR-002**](docs/decisions/ADR-002-isolate-sandbox-execution.md) | Cơ chế Isolate Sandbox & Dừng sớm | **Accepted** | Chặn 18 API trình duyệt độc hại, TLE 1.0s, MLE 256MB, Fail-Fast khi WA test đầu. |
| [**ADR-003**](docs/decisions/ADR-003-pure-core-engine-and-zero-ai.md) | Core Engine hàm thuần & Zero-AI Client | **Accepted** | Tách biệt logic nghiệp vụ khỏi DOM, 150/150 test pass, giữ vững liêm chính thi đấu. |
| [**ADR-004**](docs/decisions/ADR-004-ast-winnowing-anti-cheat.md) | AST Tokenizer & Thuật toán Winnowing 3-Gram | **Accepted** | Khử đổi tên biến và comment rác, tính khoảng cách Jaccard phát hiện gian lận tự động. |

---

<a id="cai-dat-khoi-chay"></a>
## 🚀 Cài Đặt & Khởi Chạy

### Yêu Cầu Tiên Quyết
* **Node.js**: Phiên bản `>= 18.0.0`
* **npm**: Phiên bản `>= 9.0.0`

### 1. Cài đặt các gói phụ thuộc
```bash
# Clone kho mã nguồn
git clone https://github.com/fudever-club/dever-arena.git
cd dever-arena

# Cài đặt thư viện
npm install
```

### 2. Chạy môi trường phát triển (Development)
```bash
# Terminal 1 — Backend API + máy chấm (port 8787, DB tự seed)
npm run server

# Terminal 2 — Web React SPA (proxy /api sẵn về backend)
npm run dev
# Mở trình duyệt tại: http://localhost:5173/app.html
```
Tài khoản seed: `dever_hero/hero123` (thí sinh), `dever_admin/admin123` (giám khảo).
Tài khoản thi đấu do admin cấp trong tab “Cấp tài khoản”, không có đăng ký công khai.

# Phục vụ bản build production:
npm run serve

### 3. Triển khai production (Docker)
```bash
cp .env.example .env   # điền DEVER_JWT_SECRET thật
docker compose up --build -d
# Web: http://localhost  •  API: http://localhost:8787
```
Chi tiết: `Dockerfile.api`, `Dockerfile.web`, `nginx.conf`, `docs/DEPLOYMENT_GUIDE.md`.

### 4. Đóng gói frontend (Production Build)
```bash
npm run build
```
Bản build tối ưu hóa sẽ được tạo tại thư mục `dist/`.

---

<a id="kiem-thu-chat-luong"></a>
## 🧪 Kiểm Thử & Chất Lượng Mã Nguồn

Dự án áp dụng quy chuẩn kiểm thử nghiêm ngặt với bộ Test Runner tích hợp sẵn trong Node.js (Zero external test runner bloatware):

```bash
# Chạy toàn bộ Test Suites (157 tests / 25 suites)
npm run test

# Chạy chế độ theo dõi (Watch mode)
npm run test:watch

# Quét kiểm tra kiến trúc bất biến (Linter)
npm run lint
```

### Kết quả kiểm thử tự động mẫu:
```
✔ DEVER-Forces Rating Engine Tests
✔ DEVER Server API Lifecycle Tests (judge thật, hack oracle, Elo, SSE)
...
ℹ tests 157
ℹ suites 21
ℹ pass 157
ℹ fail 0
```

---

<a id="cau-truc-thu-muc"></a>
## 📂 Cấu Trúc Thư Mục Dự Án

```
dever-arena/
├── .agents/                    # Bộ Agent Skills (orchestrator, anti-cheat sentinel, polygon-problemsetter, deploy-release, live-ops, ui-craft, quality-gate)
├── docs/                       # Tài liệu thiết kế, assets & đặc tả hệ thống
│   ├── assets/                 # Logo nhận diện thương hiệu (Light & Dark mode)
│   ├── decisions/              # Sổ bộ ADR (ADR-001 -> ADR-004)
│   ├── ops/                    # INCIDENT_RUNBOOK, BACKUP_RESTORE, DATA_RETENTION
│   ├── PAGE_BRANCHES.md        # Manifest chương trình nhánh page/* + quy trình merge về main
│   ├── ANTI_CHEAT_POLICY.md    # Quy chuẩn chống gian lận & liêm chính
│   ├── CONTEST_RULEBOOK.md     # Luật thi đấu, thang điểm & hack room
│   ├── DATABASE_SCHEMA.md      # Thiết kế cơ sở dữ liệu PostgreSQL + IndexedDB
│   ├── DESIGN_SYSTEM.md        # Tokens Luxury-Minimal, component specs & WCAG contracts
│   ├── PROBLEM_SETTING_GUIDE.md # Chuẩn Polygon: generator + stress + blind-tester
│   └── JUDGE_ARCHITECTURE.md   # Fork pool queue.js/judgeWorker.js + hợp đồng mở rộng Redis/Isolate
├── db/
│   └── schema.sql              # Cấu trúc bảng SQL chuẩn cho production
├── src/                        # Mã nguồn chính của ứng dụng (React 19 + Tailwind v4)
│   ├── components/layout/      # GuestLayout, UserLayout, AdminLayout (+StressPanel), Navbar
│   ├── components/common/      # MathRenderer (KaTeX, escape XSS)
│   ├── context/                # AuthContext, ContestContext (BroadcastChannel sync)
│   ├── core/                   # Scoring, rating, contest state machine, freeze, contestResults, virtualContest
│   ├── engine/                 # AST diff, runner, workerQueue, isolateRunner, testlibValidator, testGenerator
│   ├── lib/                    # apiClient (fetch + JWT + SSE)
│   ├── pages/                  # LandingPage, LoginPage, ContestHub (+TestingQueue), ProblemWorkspace, StandingsPage, HackRoomPage
│   └── index.css               # Tailwind v4 + Luxury-Minimal tokens (canvas #010102, accent #ff6600)
├── server/                     # Backend API thật (REST + SSE + judge JS/Python/Java/C++)
│   ├── index.js                # Router, phase machine, system test, Elo, rate-limit
│   ├── queue.js + judgeWorker.js # Fork pool chấm riêng (FIFO, timeout 60s + respawn)
│   ├── judge.js                # Thực thi code thật (tự phát hiện toolchain)
│   ├── oracles.js              # Lời giải chuẩn chấm hack
│   ├── auth.js                 # SHA-256 + JWT HS256
│   ├── pg.js                   # Adapter Postgres (KV + meta)
│   └── db.js                   # JSON store (server/data, tự seed)
├── public/brand/               # Logo CLB (nguồn thật duy nhất cho web)
├── public/icons/               # SVG ngôn ngữ từ svgl.app (python/java/js/node)
├── Dockerfile.api              # Image backend Node 22 + toolchains chấm
├── Dockerfile.web              # Image nginx phục vụ SPA
├── nginx.conf                  # SPA fallback + proxy /api + SSE
├── docker-compose.yml          # Production: web + api + db (Postgres)
├── .env.example                # Mẫu biến môi trường production
├── DESIGN.md                   # Design library (Linear consensus)
├── tests/                      # Bộ test suites kiểm thử tự động (157 tests / 25 suites)
├── app.html                    # Giao diện ứng dụng SPA (duy nhất)
├── detect.mjs                  # Bộ kiểm tra ràng buộc kiến trúc bất biến
├── package.json
└── README.md
```

---

<a id="ban-phat-trien"></a>
## 👥 Ban Phát Triển & Bản Quyền

Dự án được xây dựng và duy trì bởi **CLB Lập Trình FU-DEVER** — Trường Đại học FPT Đà Nẵng.

* **Email chính thức**: [club.dever@gmail.com](mailto:club.dever@gmail.com)
* **Fanpage chính thức**: [https://www.facebook.com/FPTUDever](https://www.facebook.com/FPTUDever)
* **Website chính thức**: [https://fu-dever-landingpage-v2.vercel.app/](https://fu-dever-landingpage-v2.vercel.app/)
* **GitHub Organization**: [@fudever-club](https://github.com/fudever-club)

Mã nguồn được phát hành theo giấy phép **MIT License**. Mọi đóng góp (Pull Requests, Issue Reports) từ cộng đồng sinh viên FPT và lập trình viên đều được chào đón nồng nhiệt!
