import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/apiClient';

/**
 * CF-parity: trang Rating Changes của 1 kỳ thi (/contest/:slug/rating).
 * Kỳ đang thi → 403 từ server (chỉ ADMIN/organizer xem preview); FINISHED → công khai.
 * Kỳ unrated → bảng rỗng + thông báo.
 */
export function RatingChangesPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getRatingChanges(slug)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e?.message || 'Không tải được rating changes.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  const th = 'px-4 py-3 text-left text-[13px] font-medium uppercase tracking-[0.4px] text-slate-400 border-b border-[#23252a]';
  const td = 'px-4 py-3 border-b border-[#1c1e22]';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-[#23252a] pb-6">
        <div>
          <div className="text-[13px] font-medium uppercase tracking-[0.4px] text-[#ff6600] mb-1.5">Rating Changes</div>
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.6px]">{data?.contest_id || slug}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Biến động Elo của kỳ thi — tính theo thuật toán Codeforces chuẩn.
          </p>
        </div>
        <Link to="/arena" className="text-sm text-slate-400 hover:text-white transition whitespace-nowrap">← Về Arena</Link>
      </div>

      {loading && <div className="p-4 text-sm text-slate-400">Đang tải…</div>}

      {!loading && error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && data && data.is_rated === false && (
        <div className="p-4 rounded-lg border border-[#23252a] bg-[#0f1011] text-sm text-slate-400">
          Kỳ thi này <span className="text-slate-200 font-semibold">không tính Elo</span> (unrated) — không có biến động rating.
        </div>
      )}

      {!loading && data && data.is_rated === true && data.finished === false && (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm text-amber-300">
          Kỳ thi chưa kết thúc — đây là <span className="font-semibold">bản dự phòng</span> cho ban tổ chức. Bảng chính thức công khai khi kỳ thi FINISHED.
        </div>
      )}

      {!loading && data && data.is_rated === true && (
        <div className="rounded-xl border border-[#23252a] bg-[#0f1011] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Hạng</th>
                <th className={th}>Thí sinh</th>
                <th className={th}>Bài giải</th>
                <th className={th}>Cũ</th>
                <th className={th}>→</th>
                <th className={th}>Mới</th>
                <th className={th}>±</th>
              </tr>
            </thead>
            <tbody>
              {(data.changes || []).map((ch) => {
                const up = ch.delta >= 0;
                return (
                  <tr key={ch.user_id} className="hover:bg-white/[0.02] transition">
                    <td className={`${td} font-mono text-slate-400`}>#{ch.rank ?? '—'}</td>
                    <td className={td}>
                      <Link to={`/profile/${encodeURIComponent(ch.username)}`} className="text-slate-100 hover:text-[#ff6600] transition font-medium">
                        {ch.username}
                      </Link>
                    </td>
                    <td className={`${td} font-mono text-slate-400`}>{ch.solved}</td>
                    <td className={`${td} font-mono text-slate-300`}>{ch.old_rating}</td>
                    <td className={`${td} text-slate-600`}>→</td>
                    <td className={`${td} font-mono font-semibold text-slate-100`}>{ch.new_rating}</td>
                    <td className={`${td} font-mono font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                      {up ? '+' : ''}{ch.delta}
                    </td>
                  </tr>
                );
              })}
              {(data.changes || []).length === 0 && (
                <tr><td className={`${td} text-slate-500`} colSpan={7}>Chưa có dữ liệu rating cho kỳ này.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RatingChangesPage;
