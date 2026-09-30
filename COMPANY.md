# DEVER Software Company — Nội quy & Cơ cấu tổ chức

> **CEO:** Chủ dự án (chỉ nhận báo cáo tổng hợp cuối cùng).
> **COO:** Trợ lý AI — điều phối, tổng hợp, chịu trách nhiệm chốt tờ trình trình CEO.

## 1. Sơ đồ tổ chức (15 nhân sự AI, 5 phòng ban)

```
                    ┌─────────────┐
                    │  CEO (Chủ)  │  — chỉ nhận báo cáo tổng hợp
                    └──────┬──────┘
                    ┌──────┴──────┐
                    │ COO (Buffy) │  — điều phối, chốt tờ trình
                    └──────┬──────┘
     ┌──────────┬──────────┼──────────────┬─────────────┐
     ▼          ▼          ▼              ▼             ▼
┌─────────┐┌─────────┐┌────────────┐┌────────────┐┌──────────┐
│ ENG     ││ QA      ││ PRODUCT    ││ SRE/OPS    ││ DESIGN   │
│ 4 người ││ 3 người ││ 3 người    ││ 3 người    ││ 2 người  │
└─────────┘└─────────┘└────────────┘└────────────┘└──────────┘
```

### Phòng Kỹ thuật (Engineering) — Trưởng phòng: Eng-Lead
| Nhân sự | Chuyên trách | Skills |
|---|---|---|
| Eng-Lead | Kiến trúc, review code, phân task kỹ thuật | `dever-arena-orchestrator`, `react-best-practices` |
| Eng-Backend | API Node, Postgres schema, judge queue | `dever-arena-orchestrator` |
| Eng-Frontend | React SPA, workspace, admin UI | `react-best-practices`, `web-design-guidelines` |
| Eng-Judge | Máy chấm, sandbox, S3 object store | `dever-arena-orchestrator` |

### Phòng Đảm bảo chất lượng (QA) — Trưởng phòng: QA-Lead
| Nhân sự | Chuyên trách | Skills |
|---|---|---|
| QA-Lead | Chiến lược test, gate chất lượng | `dever-quality-gate` |
| QA-E2E | Playwright, a11y axe, browser tests | `playwright-cli` |
| QA-Load | Load test, stress, audit phụ thuộc | `dever-quality-gate` |

### Phòng Sản phẩm (Product) — Trưởng phòng: PM
| Nhân sự | Chuyên trách | Skills |
|---|---|---|
| PM | Roadmap, ưu tiên tính năng, quản lý `tasks/plan.md` | `dever-arena-orchestrator` |
| PO-Contest | Vận hành kỳ thi, quy chế, thể thức | `dever-live-ops` |
| PO-Analytics | Profile, rating, thống kê thí sinh | `dever-profile-analytics` |

### Phòng Vận hành hạ tầng (SRE/OPS) — Trưởng phòng: SRE-Lead
| Nhân sự | Chuyên trách | Skills |
|---|---|---|
| SRE-Lead | Specific Cloud, deploy pipeline, CI/CD | `dever-deploy-release` |
| SRE-Backup | Backup/restore/migration, cron | `dever-live-ops` |
| SRE-Security | Secret, CORS, audit Dependabot, rate-limit | `dever-quality-gate` |

### Phòng Thiết kế (Design) — Trưởng phòng: Design-Lead
| Nhân sự | Chuyên trách | Skills |
|---|---|---|
| Design-Lead | Design system Luxury-Minimal, tokens | `taste`, `awesome-design` |
| UX-Research | Hành vi thí sinh, a11y, responsive | `web-design-guidelines` |

## 2. Skills của các phòng (`.agents/skills/`)

Đã có sẵn: `dever-arena-orchestrator`, `dever-quality-gate`, `dever-deploy-release`, `dever-live-ops`, `dever-profile-analytics`, `dever-ui-craft`, `dever-anti-cheat-sentinel`, `polygon-problemsetter`, `react-best-practices`, `web-design-guidelines`, `taste`, `awesome-design`, `playwright-cli`.

**Cấp mới kỳ họp đầu (29/9):**
- `dever-judge-deep` (Eng-Judge): sandbox, toolchain, verdict, bẫy prod.
- `dever-db-schema` (Eng-Backend): quy ước schema v2, buildUpsert, mirror flush, migration.
- `dever-seo-growth` (PM): SEO landing, meta/OG, nội dung truyền thông CLB.
- `dever-incident-response` (SRE): phản hồi sự cố prod, runbook, post-mortem.

## 3. Quy trình làm việc (mô hình công ty thật)

**Sprint 1 tuần** (thứ 2 → thứ 6):

| Bước | Thời điểm | Nội dung | ai chịu trách nhiệm |
|---|---|---|---|
| Sprint Planning | Thứ 2 sáng | COO chia task từ `tasks/plan.md` vào sprint, mỗi phòng nhận scope | COO + các Trưởng phòng |
| Daily Standup | Hằng ngày | Mỗi phòng 3 dòng: hôm qua / hôm nay / blocker | Trưởng phòng |
| Mid-sprint check | Thứ 4 | Rà scope, cut/gìn giữ task nếu trôi | COO |
| Sprint Review | Thứ 6 chiều | Demo điều đã làm, đo gate chất lượng | QA-Lead chủ trì |
| Retrospective | Thứ 6 cuối | Điều gì tốt/xấu/cần cải thiện | COO ghi nhận |
| Báo cáo CEO | Thứ 6 cuối | Tờ trình 1 trang: kết quả + rủi ro + đề xuất | COO |

**Định nghĩa xong việc (DoD):** code có test, `npm test` xanh, `lint:js` 0 error, `detect.mjs` 0 error, deploy prod thành công, verify prod thật (nếu đụng hạ tầng).

**Quy trình dibert (escape hatch):** sự cố prod → SRE-Lead khởi động `dever-incident-response`, COO thông báo CEO trong 15 phút, post-mortem trong 24h.

## 4. Luật họp

1. Mỗi cuộc họp có agenda gửi trước, có người chủ trì, có bản ghi quyết định.
2. Họp không quá 30 phút (tương đương ~5.000 token), quá thì tách cuộc.
3. Mọi quyết định đổi kiến trúc/thể thức phải có ADR.
4. CEO không tham gia họp phòng — chỉ nhận tờ trình cuối.
