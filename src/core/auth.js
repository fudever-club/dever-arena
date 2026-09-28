/**
 * DEVER Arena - Role-Based Access Control (RBAC) & Authentication Module
 * Hỗ trợ 3 tầng phân quyền chuẩn eSports Competitive Programming:
 * 1. GUEST: Khách vãng lai xem đề bài, bảng xếp hạng công khai, thể lệ.
 * 2. PARTICIPANT: Thí sinh làm bài, nộp code, phòng Hack 1v1, xem profile cá nhân.
 * 3. ADMIN: Ban Tổ Chức & Giám Khảo điều khiển trạng thái kỳ thi, quản lý Polygon CMS, Radar chống gian lận.
 */

export const ROLES = Object.freeze({
  GUEST: 'GUEST',
  PARTICIPANT: 'PARTICIPANT',
  ADMIN: 'ADMIN'
});

export const PRESET_USERS = Object.freeze({
  [ROLES.GUEST]: {
    id: 'usr_guest',
    username: 'Guest',
    name: 'Khách Vãng Lai',
    role: ROLES.GUEST,
    rating: 0,
    title: 'Unrated',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest',
    clan: 'None'
  },
  [ROLES.PARTICIPANT]: {
    id: 'usr_participant',
    username: 'dever_hero',
    name: 'Nguyễn Thành Đạt (DEVER)',
    role: ROLES.PARTICIPANT,
    rating: 1742,
    title: 'Candidate Master',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
    clan: 'DEVER Core'
  },
  [ROLES.ADMIN]: {
    id: 'usr_admin',
    username: 'dever_admin',
    name: 'Ban Giám Khảo & Quản Trị Viên',
    role: ROLES.ADMIN,
    rating: 2450,
    title: 'International Grandmaster',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120',
    clan: 'Ban Tổ Chức CLB'
  }
});

const STORAGE_KEY = 'dever_arena_auth_session';

// In-memory fallback cho môi trường test Node.js
let inMemoryCurrentUser = { ...PRESET_USERS[ROLES.PARTICIPANT] };

/**
 * Lấy thông tin user hiện tại
 * @returns {object} Thông tin người dùng hiện tại
 */
export function getCurrentUser() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Cannot read from localStorage:', e);
    }
  }
  return inMemoryCurrentUser;
}

/**
 * Cập nhật thông tin user hiện tại
 * @param {object} user 
 */
export function setCurrentUser(user) {
  if (!user || !user.role) {
    throw new Error('User object must include a valid role');
  }
  inMemoryCurrentUser = { ...user };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Cannot write to localStorage:', e);
    }
  }
  return inMemoryCurrentUser;
}

/**
 * Chuyển nhanh vai trò (Role Switcher dùng cho demo / dev / production testing)
 * @param {string} role ROLES.GUEST | ROLES.PARTICIPANT | ROLES.ADMIN
 */
export function switchRole(role) {
  if (!ROLES[role] && !Object.values(ROLES).includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  const targetRole = ROLES[role] || role;
  const user = PRESET_USERS[targetRole];
  return setCurrentUser(user);
}

export function sanitizeUsername(u){ return String(u).replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,30) }

/**
 * Đăng nhập giả lập hệ thống
 * @param {string} username 
 * @param {string} password 
 * @param {string} targetRole 
 */
export function login(username, password, targetRole = ROLES.PARTICIPANT) {
  if (!username) {
    throw new Error('Tên đăng nhập không được để trống');
  }
  username = sanitizeUsername(username);

  // Tự động nhận diện admin nếu username chứa admin
  let resolvedRole = targetRole;
  if (username.toLowerCase().includes('admin')) {
    resolvedRole = ROLES.ADMIN;
  }

  const baseUser = PRESET_USERS[resolvedRole] || PRESET_USERS[ROLES.PARTICIPANT];
  const user = {
    ...baseUser,
    username: username,
    name: resolvedRole === ROLES.ADMIN ? 'Ban Giám Khảo (' + username + ')' : username + ' (FPTU)'
  };

  return setCurrentUser(user);
}

/**
 * Đăng xuất tài khoản, chuyển về quyền GUEST
 */
export function logout() {
  return setCurrentUser(PRESET_USERS[ROLES.GUEST]);
}

/**
 * PERMISSION GUARDS (Kiểm soát phân quyền)
 */

export function canSubmit(user = getCurrentUser()) {
  return user.role === ROLES.PARTICIPANT || user.role === ROLES.ADMIN;
}

export function canAccessAdmin(user = getCurrentUser()) {
  return user.role === ROLES.ADMIN;
}

export function canManageContest(user = getCurrentUser()) {
  return user.role === ROLES.ADMIN;
}

export function canAuthorProblems(user = getCurrentUser()) {
  return user.role === ROLES.ADMIN;
}

export function canAccessAntiCheat(user = getCurrentUser()) {
  return user.role === ROLES.ADMIN;
}

export function canViewProblem(user = getCurrentUser()) {
  // Bất kỳ ai cũng có thể xem đề
  return true;
}

export function canViewStandings(user = getCurrentUser()) {
  // Bảng điểm công khai
  return true;
}

/**
 * Trả về header Authorization cho mọi fetch — mock cho `Authorization: Bearer <JWT>`
 * Real impl: đọc JWT từ localStorage / cookie:
 *   const token = localStorage.getItem('access_token');
 *   return token ? { Authorization: `Bearer ${token}` } : {};
 * Mock hiện tại dùng `Bearer mock-<user.id>` để frontend chỉ cần thay body.
 * @endpoint Header Authorization: Bearer <token> (dùng cho mọi GET/POST /api/v1/*)
 * @param {object} [user] - mặc định getCurrentUser()
 * @returns {{Authorization: string}} header object — ví dụ { Authorization: 'Bearer mock-usr_participant' }
 * @example
 * // Real fetch:
 * // fetch('/api/v1/contests', { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } })
 */
export function getAuthHeaders(user = getCurrentUser()) {
  const u = user || getCurrentUser();
  if (!u || !u.id) return {};
  return { Authorization: `Bearer mock-${u.id}` };
}

/**
 * Trả về thông tin hiển thị huy hiệu vai trò
 * @param {string} role 
 */
export function getRoleBadgeInfo(role) {
  switch (role) {
    case ROLES.ADMIN:
      return {
        label: 'Ban Giám Khảo',
        className: 'badge-admin',
        icon: 'fas fa-shield-halved',
        color: '#ff3366'
      };
    case ROLES.PARTICIPANT:
      return {
        label: 'Thí Sinh',
        className: 'badge-participant',
        icon: 'fas fa-user-graduate',
        color: '#d0d6e0'
      };
    case ROLES.GUEST:
    default:
      return {
        label: 'Khách Vãng Lai',
        className: 'badge-guest',
        icon: 'fas fa-eye',
        color: '#94a3b8'
      };
  }
}
