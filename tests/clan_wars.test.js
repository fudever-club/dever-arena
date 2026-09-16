import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  calculateClanPowerScore,
  generateClanLeaderboard
} from '../src/core/clanRating.js';

describe('DEVER Clan Wars & Clan Rating Engine Tests', () => {
  test('Tính điểm Clan theo công thức Top-5 Harmonic Sum', () => {
    const members = [
      { id: 'u1', rating: 2200 }, // rank 1: 2200 / sqrt(1) = 2200
      { id: 'u2', rating: 1900 }, // rank 2: 1900 / sqrt(2) ≈ 1343.5
      { id: 'u3', rating: 1700 }, // rank 3: 1700 / sqrt(3) ≈ 981.5
      { id: 'u4', rating: 1600 }, // rank 4: 1600 / sqrt(4) = 800
      { id: 'u5', rating: 1500 }, // rank 5: 1500 / sqrt(5) ≈ 670.8
      { id: 'u6', rating: 1400 }  // rank 6: không tính vào top 5
    ];

    const stats = calculateClanPowerScore(members, 'top5_harmonic');
    assert.strictEqual(stats.memberCount, 6);
    assert.strictEqual(stats.topMembers.length, 5);
    // 2200 + 1343.5 + 981.5 + 800 + 670.8 = 5995.8 -> round 5996
    assert.strictEqual(stats.score, 5996);
  });

  test('Tính điểm Clan theo công thức Top-5 Average', () => {
    const members = [
      { id: 'u1', rating: 2000 },
      { id: 'u2', rating: 1800 },
      { id: 'u3', rating: 1600 }
    ];

    const stats = calculateClanPowerScore(members, 'top5_average');
    assert.strictEqual(stats.memberCount, 3);
    assert.strictEqual(stats.topMembers.length, 3);
    // Average: (2000 + 1800 + 1600) / 3 = 1800
    assert.strictEqual(stats.score, 1800);
  });

  test('Xử lý clan rỗng (0 thành viên)', () => {
    const stats = calculateClanPowerScore([], 'top5_harmonic');
    assert.strictEqual(stats.score, 0);
    assert.strictEqual(stats.memberCount, 0);
    assert.deepStrictEqual(stats.topMembers, []);
  });

  test('Tạo bảng xếp hạng Clan Wars hoàn chỉnh với nhiều Clans', () => {
    const clans = [
      { id: 'clan_k19', name: 'House of K19', tag: 'K19', color: '#ff6600' },
      { id: 'clan_ai', name: 'AI & Data Guild', tag: 'AI', color: '#00ccff' },
      { id: 'clan_icpc', name: 'ICPC Elite Team', tag: 'ICPC', color: '#ffcc00' }
    ];

    const users = [
      // ICPC members
      { id: 'u_icpc_1', clan: 'clan_icpc', rating: 2400 },
      { id: 'u_icpc_2', clan: 'clan_icpc', rating: 2200 },
      // AI members
      { id: 'u_ai_1', clan: 'clan_ai', rating: 1600 },
      // K19 members
      { id: 'u_k19_1', clan: 'clan_k19', rating: 1800 },
      { id: 'u_k19_2', clan: 'clan_k19', rating: 1700 }
    ];

    const leaderboard = generateClanLeaderboard(clans, users, 'top5_harmonic');

    assert.strictEqual(leaderboard.length, 3);
    // ICPC có 2 người rating rất cao (2400 + 2200/sqrt(2) ≈ 3956)
    assert.strictEqual(leaderboard[0].id, 'clan_icpc');
    assert.strictEqual(leaderboard[0].rank, 1);

    // K19 đứng thứ 2 (1800 + 1700/sqrt(2) ≈ 3002)
    assert.strictEqual(leaderboard[1].id, 'clan_k19');
    assert.strictEqual(leaderboard[1].rank, 2);

    // AI đứng thứ 3
    assert.strictEqual(leaderboard[2].id, 'clan_ai');
    assert.strictEqual(leaderboard[2].rank, 3);
  });
});
