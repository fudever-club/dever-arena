/**
 * Seed data cho IndexedDB (dev) — mirror production seed cho PostgreSQL
 * Chuẩn quốc tế: 3 phase, không Hack Phase, không phân phòng (ADR-005).
 */
import { PROBLEMS_DB } from '../data/problems.js';

export async function seedDatabase(db) {
  // Contests — format mặc định ICPC theo định hướng platform nội bộ CLB
  const contests = [
    {
      id: 'contest_dever_round1',
      title: 'DEVER Round #1 (Div. 3)',
      slug: 'dever-round-1-div3',
      contest_format: 'ICPC',
      start_time: new Date().toISOString(),
      duration_minutes: 120,
      status: 'CODING',
      is_rated: true,
      division: 'Div. 3',
      settings: { ratedFor: 'Div. 3 & Div. 4' }
    },
    {
      id: 'contest_dever_archive',
      title: 'DEVER Round #0 (Archive)',
      slug: 'dever-round-0-archive',
      contest_format: 'ICPC',
      start_time: new Date(Date.now() - 7 * 86400000).toISOString(),
      duration_minutes: 120,
      status: 'FINISHED',
      is_rated: true,
      is_virtual_available: true,
      division: 'Div. 3',
      settings: { ratedFor: 'Div. 3' }
    },
    {
      id: 'contest_dever_round2_div1',
      title: 'DEVER Round #2 (Div. 1)',
      slug: 'dever-round-2-div1',
      contest_format: 'ICPC',
      start_time: new Date(Date.now() + 2 * 86400000).toISOString(),
      duration_minutes: 120,
      status: 'REGISTRATION',
      is_rated: true,
      division: 'Div. 1',
      min_rating: 1900,
      settings: { ratedFor: 'Div. 1 (Rating >= 1900)' }
    },
    {
      id: 'contest_dever_round2_div2',
      title: 'DEVER Round #2 (Div. 2)',
      slug: 'dever-round-2-div2',
      contest_format: 'ICPC',
      start_time: new Date(Date.now() + 2 * 86400000).toISOString(),
      duration_minutes: 120,
      status: 'REGISTRATION',
      is_rated: true,
      division: 'Div. 2',
      max_rating: 1899,
      settings: { ratedFor: 'Div. 2 (Rating < 1900)' }
    },
    {
      id: 'contest_dever_beginner_cup',
      title: 'DEVER Beginner Cup #1',
      slug: 'dever-beginner-cup-1',
      contest_format: 'ICPC',
      start_time: new Date(Date.now() + 5 * 86400000).toISOString(),
      duration_minutes: 90,
      status: 'REGISTRATION',
      is_rated: true,
      division: 'Div. 4',
      max_rating: 1599,
      settings: { ratedFor: 'Beginner (Rating < 1600)' }
    }
  ];
  for (const c of contests) await db.put('contests', c);
  const contest = contests[0];

  // Problems (from PROBLEMS_DB) — base_points 500/1000/1500/1900/2400 cho A-E
  const basePointsMap = { A: 500, B: 1000, C: 1500, D: 1900, E: 2400 };
  for (const p of PROBLEMS_DB) {
    const base_points = basePointsMap[p.code] ?? 500;
    await db.put('problems', {
      id: p.id,
      contest_id: contest.id,
      code: p.code,
      title: p.title,
      statement_markdown: p.statement,
      editorial_markdown: p.editorial,
      time_limit_ms: parseInt(p.timeLimit) * 1000 || 1000,
      memory_limit_kb: parseInt(p.memoryLimit) || 262144,
      base_points,
      tags: p.tags,
      solved_count: p.solvedCount
    });
  }

  // Testcases — 3 testcases mẫu cho p101 (is_sample = test hiển thị trong đề)
  const testcases = [
    { id: 'tc_p101_1', problem_id: 'p101', order_index: 1, stdin: '5 3\n2 -1 4 8 -3', expected_stdout: '11', is_sample: true, subtask_id: 1 },
    { id: 'tc_p101_2', problem_id: 'p101', order_index: 2, stdin: '4 1\n-5 -2 -8 -1', expected_stdout: '-1', is_sample: true, subtask_id: 1 },
    { id: 'tc_p101_3', problem_id: 'p101', order_index: 3, stdin: '6 2\n1 2 3 4 5 6', expected_stdout: '11', is_sample: false, subtask_id: 2 },
  ];
  for (const tc of testcases) await db.put('testcases', tc);

  // Users (demo) cho mock layer
  const users = [
    { id: 'user_me', username: 'dever_hero', email: 'dever_hero@fpt.edu.vn', password_hash: 'mock', full_name: 'Dever Hero', clan_id: 'clan_k19', rating: 1540, max_rating: 1540, rank_tier: 'Specialist', role: 'PARTICIPANT', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120', statistics: { solved: 48 } },
    { id: 'c1', username: 'phuc_k19_icpc', email: 'phuc@fpt.edu.vn', password_hash: 'mock', full_name: 'Phuc K19', clan_id: 'clan_k19', rating: 1985, max_rating: 1985, rank_tier: 'Candidate Master', role: 'PARTICIPANT', avatar: '' },
    { id: 'c2', username: 'khoa_algo_k20', email: 'khoa@fpt.edu.vn', password_hash: 'mock', full_name: 'Khoa K20', clan_id: 'clan_k20', rating: 1680, max_rating: 1680, rank_tier: 'Expert', role: 'PARTICIPANT', avatar: '' },
    { id: 'c3', username: 'rookie_fresher_k21', email: 'rookie@fpt.edu.vn', password_hash: 'mock', full_name: 'Rookie K21', clan_id: 'clan_k21', rating: 1180, max_rating: 1180, rank_tier: 'Newbie', role: 'PARTICIPANT', avatar: '' },
    { id: 'c4', username: 'minh_matrix', email: 'minh_matrix@fpt.edu.vn', password_hash: 'mock', full_name: 'Minh Matrix', clan_id: 'clan_k20', rating: 1475, max_rating: 1475, rank_tier: 'Specialist', role: 'PARTICIPANT', avatar: '' },
    { id: 'c5', username: 'an_senior_k18', email: 'an_senior_k18@fpt.edu.vn', password_hash: 'mock', full_name: 'An Senior K18', clan_id: 'clan_k18', rating: 1890, max_rating: 1890, rank_tier: 'Expert', role: 'PARTICIPANT', avatar: '' },
  ];
  for (const u of users) await db.put('users', u);

  // Contest participants (không còn phân phòng)
  const participants = [
    { id: 'cp_contest_dever_round1_user_me', contest_id: contest.id, user_id: 'user_me', registered_at: new Date().toISOString() },
    { id: 'cp_contest_dever_round1_c1', contest_id: contest.id, user_id: 'c1', registered_at: new Date().toISOString() },
    { id: 'cp_contest_dever_round1_c2', contest_id: contest.id, user_id: 'c2', registered_at: new Date().toISOString() },
    { id: 'cp_contest_dever_round1_c3', contest_id: contest.id, user_id: 'c3', registered_at: new Date().toISOString() },
    { id: 'cp_contest_dever_round1_c4', contest_id: contest.id, user_id: 'c4', registered_at: new Date().toISOString() },
    { id: 'cp_contest_dever_round1_c5', contest_id: contest.id, user_id: 'c5', registered_at: new Date().toISOString() },
  ];
  for (const cp of participants) await db.put('contest_participants', cp);

  // Submissions mock
  const subs = [
    { id: 'sub_10482', user_id: 'c1', problem_id: 'p102', contest_id: contest.id, contest_minute: 25, language: 'CPP20', source_code: '// phuc\n#include <bits/stdc++.h>\nusing namespace std; int main(){ long long sum=0,sum_sq=0; }', verdict: 'AC', execution_time_ms: 45, memory_used_kb: 2450, points_awarded: 872, submitted_at: new Date(Date.now()-120000).toISOString() },
    { id: 'sub_10480', user_id: 'user_me', problem_id: 'p102', contest_id: contest.id, contest_minute: 12, language: 'CPP20', source_code: '// hero', verdict: 'WA', execution_time_ms: 18, memory_used_kb: 1800, points_awarded: 0, submitted_at: new Date(Date.now()-480000).toISOString() },
    // Historical ghost submissions for contest_dever_archive (Virtual Contest Replay)
    { id: 'sub_arch_c1_a', user_id: 'c1', problem_id: 'p101', contest_id: 'contest_dever_archive', contest_minute: 8, language: 'CPP20', source_code: 'int main(){}', verdict: 'AC', points_awarded: 484, submitted_at: new Date(Date.now() - 7 * 86400000 + 8 * 60000).toISOString() },
    { id: 'sub_arch_c2_a', user_id: 'c2', problem_id: 'p101', contest_id: 'contest_dever_archive', contest_minute: 14, language: 'PYTHON3', source_code: 'print(1)', verdict: 'AC', points_awarded: 472, submitted_at: new Date(Date.now() - 7 * 86400000 + 14 * 60000).toISOString() },
    { id: 'sub_arch_c5_b', user_id: 'c5', problem_id: 'p102', contest_id: 'contest_dever_archive', contest_minute: 28, language: 'CPP20', source_code: 'long long ans=0;', verdict: 'AC', points_awarded: 888, submitted_at: new Date(Date.now() - 7 * 86400000 + 28 * 60000).toISOString() },
    { id: 'sub_arch_c3_a', user_id: 'c3', problem_id: 'p101', contest_id: 'contest_dever_archive', contest_minute: 35, language: 'JS', source_code: 'console.log(1)', verdict: 'AC', points_awarded: 430, submitted_at: new Date(Date.now() - 7 * 86400000 + 35 * 60000).toISOString() },
    { id: 'sub_arch_c1_c', user_id: 'c1', problem_id: 'p103', contest_id: 'contest_dever_archive', contest_minute: 62, language: 'CPP20', source_code: 'int main(){}', verdict: 'AC', points_awarded: 1128, submitted_at: new Date(Date.now() - 7 * 86400000 + 62 * 60000).toISOString() },
    { id: 'sub_arch_c4_b', user_id: 'c4', problem_id: 'p102', contest_id: 'contest_dever_archive', contest_minute: 75, language: 'CPP20', source_code: 'int main(){}', verdict: 'AC', points_awarded: 700, submitted_at: new Date(Date.now() - 7 * 86400000 + 75 * 60000).toISOString() },
  ];
  for (const s of subs) await db.put('submissions', s);

  // Discussions — khớp discussions 3 threads (phuc/khoa/rookie) upvotes 12/5/2
  await db.put('discussions', { id: 'd1', problem_id: 'p102', author_id: 'c1', title: 'Tràn số', content: 'Bài B nhớ dùng __int128_t — Bài B này nếu ai không chú ý kiểu dữ liệu sẽ bị tràn số 32-bit ngay lập tức! Nhớ dùng __int128_t nhé các bạn.', upvotes: 12, created_at: new Date().toISOString() });
  await db.put('discussions', { id: 'd2', problem_id: 'p102', author_id: 'c2', title: 'Prefix sum', content: 'Có ai giải bài B bằng kỹ thuật nhân hai con trỏ prefix sum giống mình không?', upvotes: 5, created_at: new Date().toISOString() });
  await db.put('discussions', { id: 'd3', problem_id: 'p102', author_id: 'c3', title: 'Thắc mắc', content: 'Mình test trên máy test nhỏ ra đúng mà nộp cứ bị sai là sao nhỉ?', upvotes: 2, created_at: new Date().toISOString() });

  return { contest, users };
}
