import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useContest } from '../../context/ContestContext';
import { sound } from '../../engine/sound.js';
import { 
  Trophy, BookOpen, Shield, Code, User, LogOut, LogIn, 
  Volume2, VolumeX, Clock, Zap, Swords, BarChart3, Home 
} from 'lucide-react';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { phase, formattedTime } = useContest();
  const navigate = useNavigate();
  const location = useLocation();

  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
    if (next) sound.playTick();
  };

  const getRankBadgeColor = (role, rating) => {
    if (role === 'ADMIN') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (rating >= 2400) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (rating >= 2200) return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    if (rating >= 1900) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    if (rating >= 1600) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    if (rating >= 1400) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    if (rating >= 1200) return 'text-green-400 bg-green-500/10 border-green-500/30';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  };

  const isCurrent = (path) => location.pathname === path;

  return (
    <div className="flex flex-col select-none sticky top-0 z-50">
      
      {/* 1. ADMIN CONTESTANT PREVIEW BANNER (Hiện khi Admin đang sang xem góc nhìn thí sinh) */}
      {isAdmin && (
        <div className="h-7 bg-amber-500/15 border-b border-amber-500/30 px-4 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-1.5 font-medium text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Bạn đang ở chế độ xem của <b>Ban Giám Khảo (Contestant Preview Mode)</b>.</span>
          </div>
          <Link
            to="/admin"
            className="font-bold text-[11px] text-amber-400 hover:text-amber-200 flex items-center gap-1 underline transition"
          >
            Quay lại Admin Command Center →
          </Link>
        </div>
      )}

      {/* 2. MEMBER PORTAL MAIN NAVBAR */}
      <header className="h-12 bg-[#0c101c] border-b border-white/10 px-4 flex items-center justify-between">
        {/* Brand & Nav items */}
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="font-extrabold text-base tracking-tight flex items-center">
              <span className="text-white">DEVER</span>
              <span className="text-[#ff6600]">FORCES</span>
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-500/20 text-[#ff6600] border border-orange-500/30 tracking-wide uppercase">
                Arena
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            <Link
              to="/"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                isCurrent('/')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className="w-3.5 h-3.5 text-slate-400" />
              Trang Chủ
            </Link>

            <Link
              to="/arena"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                isCurrent('/arena')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-[#ff6600]" />
              Kỳ Thi
            </Link>

            <Link
              to="/problem/p102"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                location.pathname.startsWith('/problem')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-[#00f0ff]" />
              Workspace (LeetCode)
            </Link>

            <Link
              to="/standings"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                isCurrent('/standings')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              Standings
            </Link>

            <Link
              to="/hack-room"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                isCurrent('/hack-room')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-red-400" />
              Hack Room
            </Link>

            <Link
              to="/clans"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                isCurrent('/clans')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-purple-400" />
              Clan Wars
            </Link>
          </nav>
        </div>

        {/* Center Countdown Ticker */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-400 font-medium">{phase}</span>
          <span className="text-slate-600">|</span>
          <Clock className="w-3.5 h-3.5 text-[#ff6600]" />
          <span className="font-mono font-semibold text-orange-400">{formattedTime}</span>
        </div>

        {/* Right Section: Sound Toggle & User Profile */}
        <div className="flex items-center gap-3">
          {/* Sound Toggle Button */}
          <button
            onClick={toggleSound}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
            title={soundEnabled ? 'Tắt âm thanh Web Audio' : 'Bật âm thanh Web Audio'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline text-[11px]">{soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Member Profile Badge */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-6 h-6 rounded-full border border-white/20 bg-slate-800"
              />
              <div className="hidden sm:block text-left text-xs leading-none">
                <span className="font-bold text-slate-200 block truncate max-w-[100px]">
                  {user.username}
                </span>
                <span className={`text-[10px] border px-1 rounded inline-block mt-0.5 ${getRankBadgeColor(user.role, user.rating)}`}>
                  {user.role === 'ADMIN' ? 'Giám Khảo' : `${user.rating} Elo`}
                </span>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                title="Đăng xuất"
                className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-white/5 transition ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#ff6600] hover:bg-[#ff771a] text-white font-semibold text-xs transition shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              Đăng Nhập
            </Link>
          )}
        </div>
      </header>

    </div>
  );
};
