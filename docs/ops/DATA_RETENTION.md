# DEVER Arena — Data Retention & Privacy

> Nguyên tắc: giữ ít nhất có thể để chấm + phúc khảo, xóa theo lịch để bảo vệ sinh viên.

| Dữ liệu | Giữ | Xóa / ẩn |
|---|---|---|
| Submissions + verdicts contest Rated | 12 tháng (phúc khảo, AST hậu kiểm) | Sau 12 tháng: chỉ giữ verdict + điểm, xóa `source_code` |
| Hack payloads + AST similarity | 12 tháng cùng submissions | Xóa cùng đợt |
| Tài khoản do admin cấp | Đến khi chủ nhân yêu cầu xóa | Xóa `password`, giữ username ẩn danh trong standings cũ |
| Logs request server (stdout/docker) | 30 ngày | Xoay log, không log `source_code`/password |
| Backups `backups/` | 3 bản gần nhất + 1 bản sau mỗi Round Rated | Mã hóa/mật khẩu khi copy ra khỏi máy chủ |

## Quyền của thí sinh
- Yêu cầu xuất dữ liệu của mình: Admin trích từ `/api/v1/submissions?` + profile.
- Yêu cầu xóa: Admin xóa user + submissions nguồn; standings lịch sử giữ dòng ẩn danh (`deleted_user_<id>`).
- Zero-AI (ADR-003): không gửi code thí sinh ra bất kỳ API ngoài nào — mọi quét AST chạy local/server CLB.
