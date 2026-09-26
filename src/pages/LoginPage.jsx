import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { loginWithPreset, loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/arena';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleFastSwitch = (roleKey) => {
    const loggedUser = loginWithPreset(roleKey);
    if (loggedUser.role === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate(redirectUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Vui lòng nhập Tên đăng nhập hoặc Email FPT!');
      return;
    }
    setError('');
    const loggedUser = await loginWithCredentials(username, password);
    if (loggedUser.role === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate(redirectUrl);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] grid grid-cols-1 lg:grid-cols-12 bg-[#010102] text-slate-100">
      {/* Left Branding Hero */}
      <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#23252a] relative overflow-hidden bg-[#0f1011]">

        <div className="relative z-10">
          <img
            src="/brand/logo-dark.png"
            alt="CLB FU-DEVER — Work hard, Play hard"
            className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/10 shadow-xl mb-6"
          />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[#ff6600] text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Hệ Thống Đấu Trường Giải Thuật CLB FU-DEVER
          </div>

          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-[#f7f8f8] mb-4 leading-tight">
            Thi đấu theo thể thức <span className="text-[#ff6600]">Codeforces</span>
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed max-w-lg mb-8">
            Nền tảng thi đấu của CLB FU-DEVER: làm bài 120 phút, bẻ khóa bài đối thủ cùng phòng, chấm lại toàn bộ rồi xếp hạng Elo.
          </p>

          <div className="space-y-3.5 max-w-md">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Không gian làm bài</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Soạn code, chạy thử testcase và nộp bài chấm điểm ngay trên trình duyệt.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Phòng thách đấu</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Đọc code đối thủ cùng phòng, tìm input làm code sai để được cộng điểm.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Chống gian lận mã nguồn</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">So khớp cây cú pháp để phát hiện bài sao chép. Cấm dùng AI sinh code trong giờ thi tính điểm.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof Footer */}
        <div className="pt-8 mt-8 border-t border-white/10 flex items-center justify-between text-xs text-slate-500 relative z-10">
          <span>CLB FU-DEVER • FPT University</span>
          <span>Hỗ trợ C++20 / Python / Java / JS</span>
        </div>
      </div>

      {/* Right Login & Fast Switch Form */}
      <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-center items-center bg-[#090d18]">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-white tracking-tight">Đăng Nhập Đấu Trường</h2>
            <p className="text-xs text-slate-400 mt-1">Chọn tài khoản kiểm thử nhanh hoặc đăng nhập bằng tài khoản FPT</p>
          </div>

          {/* 1-Click Fast Switch Panel */}
          <div className="mb-6 p-4 rounded-xl bg-slate-900 border border-orange-500/20 shadow-lg relative overflow-hidden">
            <div className="mb-3">
              <span className="text-xs font-bold text-orange-400 tracking-wide uppercase">
                Đăng nhập nhanh
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleFastSwitch('GUEST')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition group text-center"
              >
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Khách</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Chỉ xem, không thi</span>
              </button>

              <button
                type="button"
                onClick={() => handleFastSwitch('PARTICIPANT')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 hover:border-orange-500/50 transition group text-center"
              >
                <span className="text-xs font-bold text-orange-400 group-hover:text-orange-300">dever_hero</span>
                <span className="text-[10px] text-orange-400/70 mt-0.5">Thí sinh — làm bài</span>
              </button>

              <button
                type="button"
                onClick={() => handleFastSwitch('ADMIN')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition group text-center"
              >
                <span className="text-xs font-bold text-red-400 group-hover:text-red-300">dever_admin</span>
                <span className="text-[10px] text-red-400/70 mt-0.5">Giám khảo — quản trị</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-white/10 w-full"></div>
            <span className="bg-[#090d18] px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold absolute">
              Hoặc nhập tài khoản cá nhân
            </span>
          </div>

          {/* Form Credentials */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tên tài khoản / Mã sinh viên FPTU (MSSV)
              </label>
              <input
                type="text"
                placeholder="VD: SE180123 hoặc dever_coder"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] text-sm text-white placeholder-slate-500 outline-none transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Mật khẩu
                </label>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600] text-sm text-white placeholder-slate-500 outline-none transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#ff6600] hover:bg-[#ff771a] font-medium text-sm text-white transition"
            >
              Đăng Nhập Vào Arena
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Chưa có tài khoản? Liên hệ ban tổ chức CLB để được cấp tài khoản thi đấu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
