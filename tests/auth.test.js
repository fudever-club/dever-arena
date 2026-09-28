import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  ROLES,
  PRESET_USERS,
  getCurrentUser,
  setCurrentUser,
  switchRole,
  login,
  logout,
  canSubmit,
  canAccessAdmin,
  canManageContest,
  canAuthorProblems,
  canAccessAntiCheat,
  canViewProblem,
  canViewStandings,
  getRoleBadgeInfo
} from '../src/core/auth.js';

describe('DEVER Arena RBAC & Authentication Module Tests', () => {
  beforeEach(() => {
    // Reset to PARTICIPANT before each test
    switchRole(ROLES.PARTICIPANT);
  });

  it('xác định đúng 3 role chuẩn: GUEST, PARTICIPANT, ADMIN', () => {
    assert.strictEqual(ROLES.GUEST, 'GUEST');
    assert.strictEqual(ROLES.PARTICIPANT, 'PARTICIPANT');
    assert.strictEqual(ROLES.ADMIN, 'ADMIN');
  });

  it('lấy thông tin user hiện tại và chuyển đổi role thành công', () => {
    switchRole(ROLES.GUEST);
    let user = getCurrentUser();
    assert.strictEqual(user.role, ROLES.GUEST);
    assert.strictEqual(user.username, 'Guest');

    switchRole(ROLES.ADMIN);
    user = getCurrentUser();
    assert.strictEqual(user.role, ROLES.ADMIN);
    assert.strictEqual(user.username, 'dever_admin');

    switchRole(ROLES.PARTICIPANT);
    user = getCurrentUser();
    assert.strictEqual(user.role, ROLES.PARTICIPANT);
    assert.strictEqual(user.username, 'dever_hero');
  });

  it('kiểm tra quyền hạn chính xác cho GUEST (Khách vãng lai)', () => {
    switchRole(ROLES.GUEST);
    const guest = getCurrentUser();

    assert.strictEqual(canViewProblem(guest), true, 'Khách phải đọc được đề bài');
    assert.strictEqual(canViewStandings(guest), true, 'Khách phải xem được bảng điểm công khai');
    assert.strictEqual(canSubmit(guest), false, 'Khách KHÔNG được nộp bài trực tiếp');
    assert.strictEqual(canAccessAdmin(guest), false, 'Khách KHÔNG được vào Admin Portal');
    assert.strictEqual(canManageContest(guest), false, 'Khách KHÔNG được điều khiển kỳ thi');
    assert.strictEqual(canAuthorProblems(guest), false, 'Khách KHÔNG được sửa đề Polygon');
    assert.strictEqual(canAccessAntiCheat(guest), false, 'Khách KHÔNG được xem radar gian lận');
  });

  it('kiểm tra quyền hạn chính xác cho PARTICIPANT (Thí sinh DEVER)', () => {
    switchRole(ROLES.PARTICIPANT);
    const participant = getCurrentUser();

    assert.strictEqual(canViewProblem(participant), true);
    assert.strictEqual(canViewStandings(participant), true);
    assert.strictEqual(canSubmit(participant), true, 'Thí sinh được phép nộp bài');
    assert.strictEqual(canAccessAdmin(participant), false, 'Thí sinh KHÔNG được vào Admin Portal');
    assert.strictEqual(canManageContest(participant), false, 'Thí sinh KHÔNG được điều khiển contest');
    assert.strictEqual(canAuthorProblems(participant), false, 'Thí sinh KHÔNG được duyệt đề');
    assert.strictEqual(canAccessAntiCheat(participant), false, 'Thí sinh KHÔNG được xem dữ liệu chống gian lận');
  });

  it('kiểm tra quyền hạn chính xác cho ADMIN (Ban Tổ Chức & Giám Khảo)', () => {
    switchRole(ROLES.ADMIN);
    const admin = getCurrentUser();

    assert.strictEqual(canViewProblem(admin), true);
    assert.strictEqual(canViewStandings(admin), true);
    assert.strictEqual(canSubmit(admin), true);
    assert.strictEqual(canAccessAdmin(admin), true, 'Admin được vào Admin Portal');
    assert.strictEqual(canManageContest(admin), true, 'Admin được điều khiển Contest Phases');
    assert.strictEqual(canAuthorProblems(admin), true, 'Admin được tạo và duyệt đề Polygon');
    assert.strictEqual(canAccessAntiCheat(admin), true, 'Admin được sử dụng Radar Anti-Cheat và Hủy bài');
  });

  it('kiểm tra cơ chế login / logout mô phỏng', () => {
    // Đăng nhập thí sinh
    login('hoang_nam_se18000', 'password123', ROLES.PARTICIPANT);
    let user = getCurrentUser();
    assert.strictEqual(user.username, 'hoang_nam_se18000');
    assert.strictEqual(user.role, ROLES.PARTICIPANT);

    // Đăng xuất -> chuyển về GUEST
    logout();
    user = getCurrentUser();
    assert.strictEqual(user.role, ROLES.GUEST);
    assert.strictEqual(user.username, 'Guest');

    // Đăng nhập Admin
    login('super_admin_judge', 'secretpass', ROLES.ADMIN);
    user = getCurrentUser();
    assert.strictEqual(user.role, ROLES.ADMIN);
    assert.strictEqual(canAccessAdmin(user), true);
  });

  it('trả về đúng thông tin Badge cho từng Role', () => {
    const guestBadge = getRoleBadgeInfo(ROLES.GUEST);
    assert.strictEqual(guestBadge.className, 'badge-guest');

    const participantBadge = getRoleBadgeInfo(ROLES.PARTICIPANT);
    assert.strictEqual(participantBadge.className, 'badge-participant');

    const adminBadge = getRoleBadgeInfo(ROLES.ADMIN);
    assert.strictEqual(adminBadge.className, 'badge-admin');
  });
});
