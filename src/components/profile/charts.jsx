// DEVER Arena — Profile charts (skill: dever-profile-analytics)
// SVG thuần JSX, zero dependency, props-only: không fetch, không context, không bịa số.

// ===== Helpers rank dùng chung (thang 7 bậc Elo) =====
export const getRankColor = (rating) => {
  const r = Number(rating || 0);
  if (r >= 2400) return 'text-red-500';
  if (r >= 2200) return 'text-orange-500';
  if (r >= 1900) return 'text-purple-400';
  if (r >= 1600) return 'text-blue-400';
  if (r >= 1400) return 'text-cyan-400';
  if (r >= 1200) return 'text-green-400';
  return 'text-gray-400';
};

export const getRankBadgeColor = (role, rating) => {
  if (role === 'ADMIN') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (rating >= 2400) return 'text-red-500 bg-red-500/10 border-red-500/30';
  if (rating >= 2200) return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
  if (rating >= 1900) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
  if (rating >= 1600) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  if (rating >= 1400) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
  if (rating >= 1200) return 'text-green-400 bg-green-500/10 border-green-500/30';
  return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
};

export const getTierName = (role, rating) => {
  if (role === 'ADMIN') return 'Giám Khảo';
  if (rating >= 2400) return 'Grandmaster';
  if (rating >= 2200) return 'Master';
  if (rating >= 1900) return 'Candidate Master';
  if (rating >= 1600) return 'Expert';
  if (rating >= 1400) return 'Specialist';
  if (rating >= 1200) return 'Pupil';
  return 'Newbie';
};

export const verdictBadge = (verdict) => {
  const v = String(verdict || '—').toUpperCase();
  if (v === 'AC' || v === 'ACCEPTED') {
    return 'px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold';
  }
  if (['WA', 'TLE', 'RTE', 'MLE', 'CE'].includes(v)) {
    return 'px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 font-mono font-bold';
  }
  return 'px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-mono font-bold';
};

const EMPTY_HINT = 'Chưa có dữ liệu — số liệu sẽ xuất hiện khi có bài nộp thật.';

// ===== RatingChart: đường rating từ rating_history thật =====
const TIER_LINES = [
  { v: 1200, label: 'Pupil' },
  { v: 1400, label: 'Specialist' },
  { v: 1600, label: 'Expert' },
  { v: 1900, label: 'CM' },
  { v: 2200, label: 'Master' },
  { v: 2400, label: 'GM' },
];

// ===== RatingChartOverlay (Task 108): nhiều series Elo trên cùng hệ trục, zero-dep =====
const SERIES_COLORS = ['#ff6600', '#3b82f6', '#10b981', '#a855f7'];

export const RatingChartOverlay = ({ series = [] }) => {
  const clean = series.filter((s) => s && Array.isArray(s.history) && s.history.length > 0);
  if (!clean.length) {
    return <p className="px-5 py-6 text-xs text-slate-500">Chưa có lịch sử rated để so sánh.</p>;
  }
  const W = 600;
  const H = 180;
  const PAD = { l: 40, r: 14, t: 12, b: 20 };
  const allValues = [];
  const paths = clean.map((s, si) => {
    const values = [s.history[0].old ?? s.history[0].new ?? 1200, ...s.history.map((h) => h.new)];
    values.forEach((v) => allValues.push(v));
    return { values, color: s.color || SERIES_COLORS[si % SERIES_COLORS.length], label: s.label };
  });
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(60, max - min);
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;
  const maxLen = Math.max(...paths.map((p) => p.values.length));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, maxLen - 1);
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const gridTiers = TIER_LINES.filter((t) => t.v >= lo && t.v <= hi);

  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex flex-wrap gap-3 text-[11px]">
        {paths.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-slate-300">
            <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            {p.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="So sánh lịch sử rating">
        {gridTiers.map((t) => (
          <g key={t.v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t.v)} y2={y(t.v)} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
            <text x={PAD.l - 6} y={y(t.v) + 3} textAnchor="end" fontSize="9" fill="#64748b">{t.v}</text>
          </g>
        ))}
        {paths.map((p) => (
          <polyline
            key={p.label}
            points={p.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={p.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
};

export const RatingChart = ({ history = [] }) => {
  if (!history.length) {
    return <p className="px-5 py-6 text-xs text-slate-500">Chưa có lịch sử rated — tham gia kỳ thi rated để có đường Elo.</p>;
  }
  const W = 600;
  const H = 170;
  const PAD = { l: 40, r: 14, t: 12, b: 20 };
  // Điểm đầu = mốc vào của contest đầu tiên, sau đó là từng giá trị mới.
  const values = [history[0].old ?? history[0].new ?? 1200, ...history.map((h) => h.new)];
  const min = Math.min(...values, ...TIER_LINES.filter((t) => t.v >= Math.min(...values) && t.v <= Math.max(...values)).map((t) => t.v));
  const max = Math.max(...values);
  const span = Math.max(60, max - min);
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, values.length - 1);
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const gridTiers = TIER_LINES.filter((t) => t.v >= lo && t.v <= hi);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Biểu đồ lịch sử rating">
      {gridTiers.map((t) => (
        <g key={t.v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t.v)} y2={y(t.v)} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" />
          <text x={PAD.l - 6} y={y(t.v) + 3} textAnchor="end" fontSize="9" fill="#64748b">{t.v}</text>
          <text x={W - PAD.r} y={y(t.v) - 4} textAnchor="end" fontSize="8" fill="#475569">{t.label}</text>
        </g>
      ))}
      <polyline points={points} fill="none" stroke="#ff6600" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#ff6600" stroke="#0f1011" strokeWidth="1.5">
          <title>{`${i === 0 ? 'Mốc vào' : `Contest ${i}`}: ${v} Elo`}</title>
        </circle>
      ))}
    </svg>
  );
};

// ===== Heatmap: 26 tuần × 7 ngày, cường độ theo số bài nộp/ngày =====
const heatColor = (count) => {
  if (!count) return 'rgba(255,255,255,0.05)';
  if (count <= 2) return 'rgba(255,102,0,0.28)';
  if (count <= 4) return 'rgba(255,102,0,0.5)';
  if (count <= 6) return 'rgba(255,102,0,0.72)';
  return 'rgba(255,102,0,1)';
};

export const Heatmap = ({ cells = [] }) => {
  if (!cells.length) {
    return <p className="px-5 py-6 text-xs text-slate-500">{EMPTY_HINT}</p>;
  }
  const CELL = 13;
  const GAP = 3;
  const total = cells.reduce((s, c) => s + c.count, 0);
  let streak = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) streak += 1; else break;
  }
  const dayLabel = ['T2', '', 'T4', '', 'T6', '', 'CN'];
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-400">
          <span className="font-mono font-bold text-white">{total}</span> bài nộp trong 26 tuần
        </span>
        <span className="text-slate-400">
          Chuỗi hiện tại: <span className="font-mono font-bold text-[#ff6600]">{streak}</span> ngày
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg width={26 * (CELL + GAP) + 26} height={7 * (CELL + GAP) + 8} role="img" aria-label="Heatmap bài nộp 26 tuần">
          {cells.map((c, idx) => {
            const week = Math.floor(idx / 7);
            const date = new Date(`${c.date}T00:00:00`);
            const dowJs = date.getDay();
            return (
              <rect
                key={c.date}
                x={26 + week * (CELL + GAP)}
                y={4 + dowJs * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx="2.5"
                fill={heatColor(c.count)}
              >
                <title>{`${c.date}: ${c.count} bài nộp`}</title>
              </rect>
            );
          })}
          {dayLabel.map((d, i) => (
            d ? (
              <text key={d} x={0} y={4 + i * (CELL + GAP) + 10} fontSize="8" fill="#475569">{d}</text>
            ) : null
          ))}
        </svg>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span>Ít</span>
        {[0, 1, 3, 5, 8].map((n) => (
          <span key={n} className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: heatColor(n) }} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
};

// ===== VerdictBars: phân bố verdict (AC xanh, lỗi đỏ, còn lại neutral) =====
export const VerdictBars = ({ verdicts = {} }) => {
  const entries = Object.entries(verdicts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="px-5 py-6 text-xs text-slate-500">{EMPTY_HINT}</p>;
  const max = Math.max(...entries.map(([, n]) => n));
  const colorOf = (v) => (v === 'AC' ? 'bg-emerald-500' : ['WA', 'TLE', 'RTE', 'MLE', 'CE'].includes(v) ? 'bg-red-500' : 'bg-slate-500');
  return (
    <div className="px-5 py-4 space-y-2.5">
      {entries.map(([v, n]) => (
        <div key={v} className="flex items-center gap-3">
          <span className="w-10 font-mono text-[11px] font-bold text-slate-300">{v}</span>
          <div className="flex-1 h-3.5 rounded bg-white/5 overflow-hidden">
            <div className={`h-full rounded ${colorOf(v)}`} style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
          </div>
          <span className="w-8 text-right font-mono text-[11px] font-bold text-white">{n}</span>
        </div>
      ))}
    </div>
  );
};

// ===== LanguageBars: ngôn ngữ dùng nhiều nhất =====
export const LanguageBars = ({ languages = [] }) => {
  if (!languages.length) return <p className="px-5 py-6 text-xs text-slate-500">{EMPTY_HINT}</p>;
  const max = Math.max(...languages.map((l) => l.count));
  return (
    <div className="px-5 py-4 space-y-2.5">
      {languages.map((l) => (
        <div key={l.language} className="flex items-center gap-3">
          <span className="w-14 font-mono text-[11px] text-slate-300 truncate" title={l.language}>{l.language}</span>
          <div className="flex-1 h-3.5 rounded bg-white/5 overflow-hidden">
            <div className="h-full rounded bg-[#ff6600]" style={{ width: `${Math.max(4, (l.count / max) * 100)}%` }} />
          </div>
          <span className="w-8 text-right font-mono text-[11px] font-bold text-white">{l.count}</span>
        </div>
      ))}
    </div>
  );
};

// ===== TagStrength: solved/attempted theo tag (top, từ server) =====
export const TagStrength = ({ tags = [] }) => {
  if (!tags.length) return <p className="px-5 py-6 text-xs text-slate-500">{EMPTY_HINT}</p>;
  return (
    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
      {tags.map((t) => {
        const rate = t.attempted ? Math.round((t.solved / t.attempted) * 100) : 0;
        return (
          <div key={t.tag} className="space-y-1">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-slate-300 truncate mr-2">{t.tag}</span>
              <span className="font-mono text-slate-500 shrink-0">{t.solved}/{t.attempted} • {rate}%</span>
            </div>
            <div className="h-2 rounded bg-white/5 overflow-hidden">
              <div className="h-full rounded bg-blue-400" style={{ width: `${Math.max(3, rate)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
