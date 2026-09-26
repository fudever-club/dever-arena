import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ContestProvider } from './context/ContestContext';
import { GuestLayout } from './components/layout/GuestLayout';
import { UserLayout } from './components/layout/UserLayout';
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

// Chặn khách (GUEST) khỏi khu thí sinh — giữ nguyên hành vi demo (mặc định PARTICIPANT).
const RequireAuth = () => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user || user.role === 'GUEST') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
};

// Chặn non-ADMIN khỏi khu quản trị (AdminLayout cũng tự guard phía trong).
const RequireAdmin = () => {
  const { user } = useAuth();
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  }
  return <Outlet />;
};

export function App() {
  return (
    <AuthProvider>
      <ContestProvider>
        <HashRouter>
          <Routes>
            {/* KHU CÔNG KHAI (GuestLayout): chỉ Landing + Login */}
            <Route element={<GuestLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* KHU THÍ SINH (UserLayout + RequireAuth): vòng CF core */}
            <Route element={<RequireAuth />}>
              <Route element={<UserLayout />}>
                <Route path="/arena" element={<ContestHub />} />
                <Route path="/problem/:id" element={<Suspense fallback={<PageFallback />}><ProblemWorkspace /></Suspense>} />
                <Route path="/standings" element={<Suspense fallback={<PageFallback />}><StandingsPage /></Suspense>} />
                <Route path="/hack-room" element={<Suspense fallback={<PageFallback />}><HackRoomPage /></Suspense>} />
              </Route>
            </Route>

            {/* KHU QUẢN TRỊ (RequireAdmin + AdminLayout riêng) */}
            <Route element={<RequireAdmin />}>
              <Route path="/admin/*" element={<AdminLayout />} />
              <Route path="/admin" element={<AdminLayout />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ContestProvider>
    </AuthProvider>
  );
}

export default App;
