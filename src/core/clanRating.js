/**
 * DEVER Arena — Clan Rating & Wars Aggregator Engine
 * Tổng hợp xếp hạng sức mạnh các Clan (Bang hội) theo mô hình Top-5 Harmonic Sum
 * và quản lý bảng xếp hạng đại chiến Clan Wars.
 */

/**
 * Tính toán điểm sức mạnh của Clan dựa trên danh sách thành viên
 * @param {Array<object>} members - Danh sách thành viên ({ id, username, rating, ... })
 * @param {string} method - 'top5_harmonic' hoặc 'top5_average'
 * @returns {object} { score, memberCount, topMembers }
 */
export function calculateClanPowerScore(members = [], method = 'top5_harmonic') {
  if (!Array.isArray(members) || members.length === 0) {
    return { score: 0, memberCount: 0, topMembers: [] };
  }

  // Sắp xếp thành viên theo rating giảm dần
  const sorted = [...members].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const topMembers = sorted.slice(0, 5);

  if (method === 'top5_average') {
    const sum = topMembers.reduce((acc, m) => acc + (m.rating || 0), 0);
    const avg = Math.round(sum / topMembers.length);
    return {
      score: avg,
      memberCount: members.length,
      topMembers
    };
  }

  // Mặc định: Top-5 Harmonic Sum (S = sum(R_i / sqrt(i)))
  let harmonicSum = 0;
  topMembers.forEach((m, idx) => {
    const rankIndex = idx + 1;
    const r = m.rating || 0;
    harmonicSum += r / Math.sqrt(rankIndex);
  });

  return {
    score: Math.round(harmonicSum),
    memberCount: members.length,
    topMembers
  };
}

/**
 * Tạo bảng xếp hạng Clan Wars từ danh sách Clan và danh sách Users
 * @param {Array<object>} clans - Danh sách clan ({ id, name, tag, color, icon })
 * @param {Array<object>} users - Danh sách người dùng ({ id, username, clan, rating })
 * @param {string} method - Phương pháp tính ('top5_harmonic' hoặc 'top5_average')
 * @returns {Array<object>} Bảng xếp hạng Clan có rank và chi tiết top tuyển thủ
 */
export function generateClanLeaderboard(clans = [], users = [], method = 'top5_harmonic') {
  if (!Array.isArray(clans)) return [];

  // Gom nhóm users theo clan id hoặc clan tag
  const clanUsersMap = {};
  clans.forEach(c => {
    clanUsersMap[c.id] = [];
    if (c.tag) clanUsersMap[c.tag] = clanUsersMap[c.id];
  });

  users.forEach(u => {
    const userClan = u.clan || u.clan_id;
    if (userClan && clanUsersMap[userClan]) {
      clanUsersMap[userClan].push(u);
    }
  });

  // Tính điểm cho từng clan
  const leaderboard = clans.map(c => {
    const members = clanUsersMap[c.id] || [];
    const stats = calculateClanPowerScore(members, method);
    return {
      id: c.id,
      name: c.name || c.id,
      tag: c.tag || c.id,
      description: c.description || '',
      color: c.color || '#ff6600',
      icon: c.icon || '🛡️',
      score: stats.score,
      memberCount: stats.memberCount,
      topMembers: stats.topMembers
    };
  });

  // Sắp xếp điểm giảm dần
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    return a.name.localeCompare(b.name);
  });

  // Gán rank 1, 2, 3...
  leaderboard.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return leaderboard;
}
