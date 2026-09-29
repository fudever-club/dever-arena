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

// Code-split nặng: Monaco workspace + Standings/Admin tải lazy để giảm bundle đầu
const ProblemWorkspace = lazy(() => import('./pages/ProblemWorkspace.jsx').then(m => ({ default: m.ProblemWorkspace })));
const StandingsPage = lazy(() => import('./pages/StandingsPage.jsx').then(m => ({ default: m.StandingsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx').then(m => ({ default: m.ProfilePage })));
const ComparePage = lazy(() => import('./pages/ComparePage.jsx').then(m => ({ default: m.ComparePage })));
const VirtualContestPage = lazy(() => import('./pages/VirtualContestPage.jsx').then(m => ({ default: m.VirtualContestPage })));
const ContestSummaryPage = lazy(() => import('./pages/ContestSummaryPage.jsx').then(m => ({ default: m.ContestSummaryPage })));
const RatingChangesPage = lazy(() => import('./pages/RatingChangesPage.jsx').then(m => ({ default: m.RatingChangesPage })));
const ProblemsetPage = lazy(() => import('./pages/ProblemsetPage.jsx').then(m => ({ default: m.ProblemsetPage })));

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

// Chặn non-ADMIN/ORGANIZER khỏi khu quản trị (Task 119: organizer vào được, backend vẫn gate theo kỳ thi).
const RequireAdmin = () => {
  const { user } = useAuth();
  if (!user || !['ADMIN', 'ORGANIZER'].includes(user.role)) {
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
                <Route path="/profile" element={<Suspense fallback={<PageFallback />}><ProfilePage /></Suspense>} />
                <Route path="/profile/:username" element={<Suspense fallback={<PageFallback />}><ProfilePage /></Suspense>} />
                <Route path="/compare" element={<Suspense fallback={<PageFallback />}><ComparePage /></Suspense>} />
                <Route path="/virtual/:slug" element={<Suspense fallback={<PageFallback />}><VirtualContestPage /></Suspense>} />
                <Route path="/contest/:slug/summary" element={<Suspense fallback={<PageFallback />}><ContestSummaryPage /></Suspense>} />
                <Route path="/contest/:slug/rating" element={<Suspense fallback={<PageFallback />}><RatingChangesPage /></Suspense>} />
                <Route path="/problemset" element={<Suspense fallback={<PageFallback />}><ProblemsetPage /></Suspense>} />
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
