import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useContest } from '../../context/ContestContext';
import { NotificationCenter } from '../common/NotificationCenter';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { phase, formattedTime } = useContest();
  const navigate = useNavigate();
  const location = useLocation();

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
            <span>Bạn đang xem với quyền giám khảo.</span>
          </div>
          <Link
            to="/admin"
            className="font-bold text-[11px] text-amber-400 hover:text-amber-200 flex items-center gap-1 underline transition"
          >
            Quay lại trang quản trị →
          </Link>
        </div>
      )}

      {/* 2. MEMBER PORTAL MAIN NAVBAR */}
      <header className="h-14 bg-[#010102] border-b border-[#23252a] px-4 flex items-center justify-between">
        {/* Brand & Nav items */}
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/brand/icon-192.png"
              alt="CLB FU-DEVER"
              className="h-7 w-7 rounded-md object-cover ring-1 ring-white/10"
            />
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
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                isCurrent('/')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Trang Chủ
            </Link>

            <Link
              to="/arena"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                isCurrent('/arena')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Kỳ Thi
            </Link>

            <Link
              to="/problemset"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                location.pathname.startsWith('/problem')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Workspace
            </Link>

            <Link
              to="/standings"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                isCurrent('/standings')
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Standings
            </Link>
          </nav>
        </div>

        {/* Center Countdown Ticker */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-400 font-medium">{phase}</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono font-semibold text-orange-400">{formattedTime}</span>
        </div>

        {/* Right Section: User Profile */}
        <div className="flex items-center gap-3">
          {/* Task 109: Notification center */}
          {isAuthenticated && <NotificationCenter />}
          {/* Member Profile Badge */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
              <a href="#/profile" title="Xem profile của bạn" className="hover:opacity-80 transition">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-6 h-6 rounded-full border border-white/20 bg-slate-800"
              />
              </a>
              <a href="#/profile" className="hidden sm:block text-left text-xs leading-none hover:opacity-80 transition">
                <span className="font-bold text-slate-200 block truncate max-w-[100px]">
                  {user.username}
                </span>
                <span className={`text-[10px] border px-1 rounded inline-block mt-0.5 ${getRankBadgeColor(user.role, user.rating)}`}>
                  {user.role === 'ADMIN' ? 'Giám Khảo' : `${user.rating} Elo`}
                </span>
              </a>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                title="Đăng xuất"
                className="px-2 py-1 rounded text-xs text-slate-400 hover:text-red-400 hover:bg-white/5 transition ml-1"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1 rounded bg-[#ff6600] hover:bg-[#ff771a] text-white font-semibold text-xs transition shadow-sm"
            >
              Đăng Nhập
            </Link>
          )}
        </div>
      </header>

    </div>
  );
};
