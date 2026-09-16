import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ContestProvider } from './context/ContestContext';
import { Navbar } from './components/layout/Navbar';
import { AdminLayout } from './components/layout/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { ContestHub } from './pages/ContestHub';
import { ProblemWorkspace } from './pages/ProblemWorkspace';
import { StandingsPage } from './pages/StandingsPage';
import { HackRoomPage } from './pages/HackRoomPage';
import { ClansPage } from './pages/ClansPage';

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

            {/* DEDICATED MEMBER & CONTESTANT PORTAL ROUTES */}
            <Route element={<MemberLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/arena" element={<ContestHub />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/problem/:id" element={<ProblemWorkspace />} />
              <Route path="/standings" element={<StandingsPage />} />
              <Route path="/hack-room" element={<HackRoomPage />} />
              <Route path="/clans" element={<ClansPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ContestProvider>
    </AuthProvider>
  );
}

export default App;

