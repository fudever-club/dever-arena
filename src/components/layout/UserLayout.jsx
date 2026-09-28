import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { AnnouncementBanner } from '../common/AnnouncementBanner';

/**
 * UserLayout — vỏ thí sinh đã đăng nhập (PARTICIPANT + ADMIN xem ké).
 * Routes: /arena, /problem/:id, /standings, /profile, /problemset. Bảo vệ bởi RequireAuth.
 */
export const UserLayout = () => {
  return (
    <div className="min-h-screen bg-[#010102] text-slate-100 flex flex-col font-sans">
      <Navbar />
      <AnnouncementBanner />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};
