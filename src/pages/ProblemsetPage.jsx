import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { PROBLEMS_DB } from '../data/problems.js';

const PAGE_SIZE = 20;

const scoreOf = (p) => Number(p?.rating ?? p?.base_points ?? 1000);

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.problems)) return data.problems;
  return [];
};

const filterLocal = (list, search) => {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return [...list];
  return list.filter((p) => (
    String(p.title || '').toLowerCase().includes(q)
    || String(p.code || '').toLowerCase().includes(q)
    || (p.tags || []).some((t) => String(t).toLowerCase().includes(q))
  ));
};

export const ProblemsetPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dataSource, setDataSource] = useState('live');
  const [tagFilter, setTagFilter] = useState('');
  const [minRating, setMinRating] = useState('');
  const [maxRating, setMaxRating] = useState('');
  const [sortKey, setSortKey] = useState('code');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const params = debouncedSearch ? { search: debouncedSearch } : {};
        const data = await api.getProblems(params);
        const list = normalizeList(data);
        if (!cancelled) {
          setProblems(list);
          setDataSource('live');
        }
      } catch {
        if (!cancelled) {
          setProblems(filterLocal(PROBLEMS_DB, debouncedSearch));
          setDataSource('demo');
          setLoadError('Không nối được máy chủ, đang hiển thị đề mẫu local.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const availableTags = useMemo(() => {
    const set = new Set();
    problems.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return [...set].sort((a, b) => String(a).localeCompare(String(b)));
  }, [problems]);

  const visible = useMemo(() => {
    const min = minRating === '' ? null : Number(minRating);
    const max = maxRating === '' ? null : Number(maxRating);
    let list = problems.filter((p) => {
      if (tagFilter && !(p.tags || []).includes(tagFilter)) return false;
      const s = scoreOf(p);
      if (min !== null && !Number.isNaN(min) && s < min) return false;
      if (max !== null && !Number.isNaN(max) && s > max) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'rating') cmp = scoreOf(a) - scoreOf(b);
      else cmp = String(a.code || '').localeCompare(String(b.code || ''), 'en', { sensitivity: 'base' });
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [problems, tagFilter, minRating, maxRating, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sortMark = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#010102] text-slate-100 p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="border-b border-[#23252a] pb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-slate-400">Kho đề luyện tập</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${dataSource === 'demo' ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-white/5 text-slate-300 border-[#23252a]'}`}>
            {dataSource === 'demo' ? 'Đề mẫu local' : 'Máy chủ'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Kho đề Problemset</h1>
        <p className="text-xs text-slate-400 mt-1">Tìm kiếm, lọc theo tag và khoảng điểm, sắp xếp rồi chọn bài để làm.</p>
      </div>

      <div className="bg-[#0f1011] border border-[#23252a] rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã, tên bài hoặc tag..."
            aria-label="Tìm kiếm bài toán"
            className="flex-1 px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white placeholder-slate-500 outline-none"
          />
          <select
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(0); }}
            aria-label="Lọc theo tag"
            className="px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-slate-200 outline-none lg:w-56"
          >
            <option value="">Tất cả tags</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <label htmlFor="ps-min-rating" className="text-slate-400">Điểm từ</label>
            <input
              id="ps-min-rating"
              type="number"
              min="0"
              value={minRating}
              onChange={(e) => { setMinRating(e.target.value); setPage(0); }}
              placeholder="800"
              className="w-28 px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white placeholder-slate-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="ps-max-rating" className="text-slate-400">đến</label>
            <input
              id="ps-max-rating"
              type="number"
              min="0"
              value={maxRating}
              onChange={(e) => { setMaxRating(e.target.value); setPage(0); }}
              placeholder="2400"
              className="w-28 px-3 py-2 rounded-lg bg-[#141516] border border-[#23252a] text-white placeholder-slate-500 outline-none"
            />
          </div>
          {(tagFilter || minRating !== '' || maxRating !== '' || search) && (
            <button
              onClick={() => { setSearch(''); setTagFilter(''); setMinRating(''); setMaxRating(''); setPage(0); }}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium transition sm:ml-auto"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-[#0f1011] border border-[#23252a] text-slate-400 text-xs" role="status">
          {loadError}
        </div>
      )}

      <div className="bg-[#0f1011] border border-[#23252a] rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-[#141516] border-b border-[#23252a] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4 w-20">
                <button onClick={() => toggleSort('code')} className="hover:text-white transition" aria-label="Sắp xếp theo mã">
                  Mã{sortMark('code')}
                </button>
              </th>
              <th className="py-3 px-4">Tên</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4 w-32 text-right">
                <button onClick={() => toggleSort('rating')} className="hover:text-white transition" aria-label="Sắp xếp theo điểm">
                  Điểm{sortMark('rating')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 px-4 text-center text-slate-500">Đang tải danh sách bài...</td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 px-4 text-center text-slate-500">Không tìm thấy bài nào khớp bộ lọc.</td>
              </tr>
            ) : (
              paged.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/problem/${p.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/problem/${p.id}`); }}
                  tabIndex={0}
                  className="hover:bg-white/5 transition cursor-pointer"
                >
                  <td className="py-3.5 px-4 font-bold text-white text-sm font-mono">{p.code}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-200 text-sm">{p.title}</td>
                  <td className="py-3.5 px-4">
                    <span className="flex flex-wrap gap-1">
                      {(p.tags || []).map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 text-[10px] font-mono">
                          {t}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-200">{scoreOf(p)}đ</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono">Trang {safePage + 1}/{pageCount} • {visible.length} bài</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((v) => Math.max(0, v - 1))}
            disabled={safePage === 0}
            className="px-3 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] hover:bg-[#18191a] disabled:opacity-40"
          >
            ← Trước
          </button>
          <button
            onClick={() => setPage((v) => Math.min(pageCount - 1, v + 1))}
            disabled={safePage >= pageCount - 1}
            className="px-3 py-1.5 rounded-lg bg-[#141516] border border-[#23252a] hover:bg-[#18191a] disabled:opacity-40"
          >
            Sau →
          </button>
        </div>
      </div>
    </div>
  );
};
