import React from 'react';
import { calculateClanPowerScore } from '../core/clanRating.js';
import { Shield, Trophy, Users, Award, Sparkles, Swords, Star } from 'lucide-react';

const CLANS_DATA = [
  {
    id: 'c1',
    name: 'House of Buggy (K19)',
    tag: 'BUGGY',
    cohort: 'K19',
    description: 'Thế hệ kỳ cựu với bề dày thành tích ICPC Regional và Olympic Tin học Sinh viên.',
    color: '#ff6600',
    icon: '🐛',
    members: [
      { id: 'u1', username: 'dever_hero', rating: 1742, role: 'Leader' },
      { id: 'u4', username: 'buggy_coder', rating: 1490, role: 'Core' },
      { id: 'u11', username: 'k19_veteran', rating: 1620, role: 'Core' },
      { id: 'u12', username: 'buggy_master', rating: 1810, role: 'Core' },
      { id: 'u13', username: 'segment_tree', rating: 1530, role: 'Member' }
    ]
  },
  {
    id: 'c2',
    name: 'Cyber Warriors (K20)',
    tag: 'WARRIORS',
    cohort: 'K20',
    description: 'Biệt đội bẻ khóa Hack Room hung hãn nhất, chuyên săn các lỗi tràn số và thuật toán sai.',
    color: '#00f0ff',
    icon: '⚔️',
    members: [
      { id: 'u2', username: 'hacker_pro', rating: 1680, role: 'Leader' },
      { id: 'u21', username: 'cyber_ninja', rating: 1590, role: 'Core' },
      { id: 'u22', username: 'bitmask_dp', rating: 1640, role: 'Core' },
      { id: 'u23', username: 'graph_rider', rating: 1480, role: 'Member' },
      { id: 'u24', username: 'overflow_troll', rating: 1510, role: 'Member' }
    ]
  },
  {
    id: 'c3',
    name: 'AI & Data Lab (K21)',
    tag: 'AI_LAB',
    cohort: 'K21',
    description: 'Tân binh quái kiệt K21, đam mê thuật toán đồ thị, quy hoạch động và toán học số học.',
    color: '#10b981',
    icon: '🤖',
    members: [
      { id: 'u3', username: 'alice_ninja', rating: 1540, role: 'Leader' },
      { id: 'u31', username: 'math_wizard', rating: 1610, role: 'Core' },
      { id: 'u32', username: 'tree_centroid', rating: 1470, role: 'Member' },
      { id: 'u33', username: 'greedy_boy', rating: 1390, role: 'Member' },
      { id: 'u5', username: 'newbie_fpt', rating: 1180, role: 'Member' }
    ]
  }
];

export const ClansPage = () => {
  const rankedClans = CLANS_DATA.map((clan) => {
    const power = calculateClanPowerScore(clan.members, 'top5_harmonic');
    return {
      ...clan,
      powerScore: power.score,
      memberCount: clan.members.length,
      top5: power.topMembers
    };
  }).sort((a, b) => b.powerScore - a.powerScore);

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#0b0f19] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-[#ff6600] border border-orange-500/30 flex items-center gap-1">
              <Swords className="w-3.5 h-3.5" />
              Clan Wars Arena
            </span>
            <span className="text-xs text-slate-400">Bảng Tổng Sắp Liên Khóa CLB FU-DEVER</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            🛡️ Đại Chiến Bang Hội — Top-5 Harmonic Sum
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Điểm sức mạnh bang hội tính theo công thức điều hòa của 5 thành viên có Elo cao nhất: <code className="text-orange-400 font-mono">S = Σ (Rating_i / √i)</code>.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[#0c101c] p-3 rounded-xl border border-white/10 text-xs font-mono">
          <div>
            <span className="text-slate-500 block text-[11px]">Bang Hội Dẫn Đầu</span>
            <span className="font-bold text-[#ff6600] text-sm">{rankedClans[0]?.name}</span>
          </div>
        </div>
      </div>

      {/* Clan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rankedClans.map((clan, idx) => {
          const isFirst = idx === 0;
          return (
            <div
              key={clan.id}
              className={`rounded-2xl p-6 flex flex-col justify-between border transition-all ${
                isFirst
                  ? 'bg-gradient-to-b from-[#141b2d] to-[#0d1222] border-orange-500/40 shadow-xl shadow-orange-500/10'
                  : 'bg-[#0e1424] border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                {/* Badge Rank */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{clan.icon}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    isFirst
                      ? 'bg-orange-500/20 text-[#ff6600] border-orange-500/30'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    {idx === 0 ? '🏆 Hạng 1' : idx === 1 ? '🥈 Hạng 2' : '🥉 Hạng 3'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">{clan.name}</h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">{clan.description}</p>

                {/* Power Score Box */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 mb-4 text-center font-mono">
                  <span className="text-[11px] text-slate-500 block uppercase tracking-wider">Điểm Sức Mạnh Bang Hội</span>
                  <span className="text-2xl font-black text-orange-400">
                    {clan.powerScore.toLocaleString()}đ
                  </span>
                </div>

                {/* Top Members List */}
                <div className="space-y-2">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                    Top 5 Coder Gánh Điểm:
                  </span>
                  {clan.top5?.map((member, mIdx) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[11px]">#{mIdx + 1}</span>
                        <span className="font-bold text-slate-200">{member.username}</span>
                        <span className="text-[10px] text-slate-500">({member.role})</span>
                      </div>
                      <span className="font-mono text-[#ff6600] font-semibold">{member.rating} Elo</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                <span>Khóa: <b className="text-slate-300">{clan.cohort}</b></span>
                <span>Thành viên: <b className="text-slate-300">{clan.memberCount} Coder</b></span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
