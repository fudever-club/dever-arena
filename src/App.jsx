import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ContestProvider } from './context/ContestContext';
import { Navbar } from './components/layout/Navbar';
import { AdminLayout } from './components/layout/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { ContestHub } from './pages/ContestHub';

// Code-split nặng: Monaco workspace + Standings/Hack/Admin/Clans (frozen) tải lazy để giảm bundle đầu
const ProblemWorkspace = lazy(() => import('./pages/ProblemWorkspace.jsx').then(m => ({ default: m.ProblemWorkspace })));
const StandingsPage = lazy(() => import('./pages/StandingsPage.jsx').then(m => ({ default: m.StandingsPage })));
const HackRoomPage = lazy(() => import('./pages/HackRoomPage.jsx').then(m => ({ default: m.HackRoomPage })));

const PageFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center text-slate-400 text-sm">
    Đang tải đấu trường...
  </div>
);

// Member Portal Layout (clean CP Navbar, contestant workspace)
const MemberLayout = () => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <ContestProvider>
        <HashRouter>
          <Routes>
            {/* DEDICATED ADMIN PORTAL ROUTE (Completely separate layout with Sidebar & Protected Guard) */}
            <Route path="/admin/*" element={<AdminLayout />} />
            <Route path="/admin" element={<AdminLayout />} />

            {/* DEDICATED MEMBER & CONTESTANT PORTAL ROUTES — Core CF loop */}
            <Route element={<MemberLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/arena" element={<ContestHub />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/problem/:id" element={<Suspense fallback={<PageFallback />}><ProblemWorkspace /></Suspense>} />
              <Route path="/standings" element={<Suspense fallback={<PageFallback />}><StandingsPage /></Suspense>} />
              <Route path="/hack-room" element={<Suspense fallback={<PageFallback />}><HackRoomPage /></Suspense>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ContestProvider>
    </AuthProvider>
  );
}

export default App;

