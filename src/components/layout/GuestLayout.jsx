import React from 'react';
import { Link, Outlet } from 'react-router-dom';

/**
 * GuestLayout — vỏ công khai cho khách chưa đăng nhập.
 * Chỉ: Landing (/), Login (/login). Không timer, không tabs thí sinh, không sidebar admin.
 */
export const GuestLayout = () => {
  return (
    <div className="min-h-screen bg-[#010102] text-slate-100 flex flex-col font-sans">
      <header className="h-14 bg-[#010102] border-b border-[#23252a] px-4 flex items-center justify-between shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/brand/icon-192.png"
            alt="CLB FU-DEVER"
            className="h-7 w-7 rounded-md object-cover ring-1 ring-[#23252a]"
          />
          <div className="font-bold text-base tracking-tight flex items-center">
            <span className="text-white">DEVER</span>
            <span className="text-[#ff6600]">FORCES</span>
          </div>
        </Link>
        <Link
          to="/login"
          className="px-3 py-1.5 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] text-white font-medium text-xs transition"
        >
          Đăng Nhập
        </Link>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <footer className="border-t border-[#23252a] py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <span>© 2026 DEVER Arena • CLB FU-DEVER • Tài khoản thi đấu do ban tổ chức cấp</span>
          <div className="flex items-center gap-4">
            <span>Thể thức Codeforces • Hack Room • Elo</span>
            <span>club.dever@gmail.com</span>
            <a href="https://github.com/fudever-club" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
