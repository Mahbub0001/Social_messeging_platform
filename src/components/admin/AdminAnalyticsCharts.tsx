import React, { useState, useMemo } from "react";
import { useAdminLanguage } from "../../context/AdminLanguageContext";
import type { AdminStats, AdminUser } from "../../services/adminService";

interface AdminAnalyticsChartsProps {
  stats: AdminStats;
  users: AdminUser[];
  messageTimestamps: string[];
}

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({
  stats,
  users,
  messageTimestamps,
}) => {
  const { t, language } = useAdminLanguage();
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(7);
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    active: number;
    messages: number;
    x: number;
    y: number;
  } | null>(null);

  // Build real daily activity buckets from user last_seen and real message timestamps
  const chartData = useMemo(() => {
    const now = new Date();
    const userDayCounts = new Map<string, number>();
    const msgDayCounts = new Map<string, number>();

    const toKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    users.forEach((u) => {
      const ts = u.last_seen || u.updated_at;
      if (!ts) return;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return;
      const key = toKey(d);
      userDayCounts.set(key, (userDayCounts.get(key) || 0) + 1);
    });

    messageTimestamps.forEach((ts) => {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return;
      const key = toKey(d);
      msgDayCounts.set(key, (msgDayCounts.get(key) || 0) + 1);
    });

    const points = [];
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toKey(d);
      const dateLabel = d.toLocaleDateString(language === "bn" ? "bn-BD" : "en-US", {
        month: "short",
        day: "numeric",
      });

      points.push({
        date: dateLabel,
        active: userDayCounts.get(key) || 0,
        messages: msgDayCounts.get(key) || 0,
      });
    }
    return points;
  }, [timeRange, users, messageTimestamps, language]);

  const chartWidth = 680;
  const chartHeight = 240;
  const padX = 28;
  const padY = 24;

  const maxActive = Math.max(...chartData.map((d) => d.active), 4);
  const maxMsgs = Math.max(...chartData.map((d) => d.messages), 4);
  const maxVal = Math.max(maxActive, maxMsgs);

  const getX = (idx: number) =>
    padX + (idx / Math.max(1, chartData.length - 1)) * (chartWidth - padX * 2);

  const getY = (val: number) =>
    chartHeight - padY - (val / maxVal) * (chartHeight - padY * 2);

  const activePoints = chartData.map((d, i) => ({ x: getX(i), y: getY(d.active) }));
  const msgPoints = chartData.map((d, i) => ({ x: getX(i), y: getY(d.messages) }));

  const buildCurve = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cx = (curr.x + next.x) / 2;
      d += ` C ${cx} ${curr.y}, ${cx} ${next.y}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const activeLinePath = useMemo(() => buildCurve(activePoints), [activePoints]);
  const msgLinePath = useMemo(() => buildCurve(msgPoints), [msgPoints]);

  const activeAreaPath = useMemo(() => {
    if (!activeLinePath || activePoints.length === 0) return "";
    const last = activePoints[activePoints.length - 1];
    const first = activePoints[0];
    return `${activeLinePath} L ${last.x} ${chartHeight - padY} L ${first.x} ${chartHeight - padY} Z`;
  }, [activeLinePath, activePoints]);

  // Account distribution list (single accent on active, muted neutral/semantic bars for rest)
  const bannedCount = users.filter((u) => u.is_banned).length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const modCount = users.filter((u) => u.role === "moderator").length;
  const regularActiveCount = Math.max(
    0,
    stats.totalUsers - bannedCount - adminCount - modCount
  );
  const totalBase = Math.max(1, stats.totalUsers);

  const breakdownRows = [
    {
      label: t("chart.active"),
      count: regularActiveCount,
      barClass: "bg-[#0d9488] dark:bg-[#14b8a6]",
      dotClass: "bg-[#0d9488] dark:bg-[#14b8a6]",
    },
    {
      label: t("chart.admins"),
      count: adminCount,
      barClass: "bg-[#525252] dark:bg-[#a1a1a6]",
      dotClass: "bg-[#525252] dark:bg-[#a1a1a6]",
    },
    {
      label: t("chart.moderators"),
      count: modCount,
      barClass: "bg-[#a1a1a6] dark:bg-[#737373]",
      dotClass: "bg-[#a1a1a6] dark:bg-[#737373]",
    },
    {
      label: t("chart.banned"),
      count: bannedCount,
      barClass: "bg-[#dc2626] dark:bg-[#e5484d]",
      dotClass: "bg-[#dc2626] dark:bg-[#e5484d]",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Chart (2/3 width) */}
      <section className="lg:col-span-2 p-6 rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
              {t("chart.activityTitle")}
            </h2>
            <p className="text-xs text-[#737373] dark:text-[#85858b] mt-1">
              {t("chart.activitySubtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Compact Legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-[#525252] dark:text-[#a1a1a6] mr-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0d9488] dark:bg-[#14b8a6]" />
                <span>{t("chart.activeUsers")}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#a1a1a6] dark:bg-[#737373]" />
                <span>{t("chart.messages")}</span>
              </span>
            </div>

            {/* Range Selector */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-black/[0.06] dark:border-white/[0.06]">
              {([7, 14, 30] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums transition-colors duration-150 ${
                    timeRange === r
                      ? "bg-white dark:bg-[#141415] text-[#171717] dark:text-[#ededed] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none"
                      : "text-[#737373] dark:text-[#85858b] hover:text-[#171717] dark:hover:text-[#ededed]"
                  }`}
                >
                  {r === 7 ? t("chart.days7") : r === 14 ? t("chart.days14") : t("chart.days30")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="relative w-full select-none">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-[240px] sm:h-[260px] overflow-visible"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="kbAdminTealWash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Muted Horizontal Grid */}
            {[0, 0.33, 0.66, 1].map((ratio, idx) => {
              const y = chartHeight - padY - ratio * (chartHeight - padY * 2);
              const labelVal = Math.round(ratio * maxVal);
              return (
                <g key={idx}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={chartWidth - padX}
                    y2={y}
                    className="stroke-black/[0.07] dark:stroke-white/[0.07]"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padX - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[#737373] dark:fill-[#85858b] text-[10px] font-mono tabular-nums"
                  >
                    {labelVal}
                  </text>
                </g>
              );
            })}

            {/* Secondary Series: Messages */}
            {msgLinePath && (
              <path
                d={msgLinePath}
                fill="none"
                className="stroke-[#a1a1a6] dark:stroke-[#737373]"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            )}

            {/* Primary Series Area & Line: Active Users */}
            {activeAreaPath && <path d={activeAreaPath} fill="url(#kbAdminTealWash)" />}
            {activeLinePath && (
              <path
                d={activeLinePath}
                fill="none"
                className="stroke-[#0d9488] dark:stroke-[#14b8a6]"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {/* Crosshair */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={padY}
                x2={hoveredPoint.x}
                y2={chartHeight - padY}
                className="stroke-black/20 dark:stroke-white/20"
                strokeWidth="1"
              />
            )}

            {/* Hitboxes & Axis Labels */}
            {chartData.map((d, i) => {
              const x = getX(i);
              const y = getY(d.active);
              const isHovered = hoveredPoint?.date === d.date;
              const showLabel =
                timeRange === 7 ||
                (timeRange === 14 && i % 2 === 0) ||
                (timeRange === 30 && (i % 5 === 0 || i === chartData.length - 1));

              return (
                <g key={i}>
                  <rect
                    x={x - (chartWidth / chartData.length) / 2}
                    y={padY}
                    width={chartWidth / chartData.length}
                    height={chartHeight - padY * 2}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        date: d.date,
                        active: d.active,
                        messages: d.messages,
                        x,
                        y,
                      })
                    }
                  />
                  {isHovered && (
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-[#0d9488] dark:fill-[#14b8a6] stroke-white dark:stroke-[#19191b]"
                      strokeWidth="2"
                    />
                  )}
                  {showLabel && (
                    <text
                      x={x}
                      y={chartHeight - 4}
                      textAnchor="middle"
                      className="fill-[#737373] dark:fill-[#85858b] text-[10px] font-mono tabular-nums"
                    >
                      {d.date}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none px-3 py-2 rounded-lg bg-white dark:bg-[#232325] border border-black/[0.1] dark:border-white/[0.1] shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-none text-xs min-w-[144px]"
              style={{
                left: `${Math.min(82, Math.max(18, (hoveredPoint.x / chartWidth) * 100))}%`,
                top: `${Math.max(14, (hoveredPoint.y / chartHeight) * 100 - 12)}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <p className="font-mono text-[11px] text-[#737373] dark:text-[#85858b] mb-1">
                {hoveredPoint.date}
              </p>
              <div className="flex items-center justify-between gap-4 text-[#171717] dark:text-[#ededed]">
                <span className="text-[#525252] dark:text-[#a1a1a6]">{t("chart.activeUsers")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {hoveredPoint.active.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-[#171717] dark:text-[#ededed] mt-0.5">
                <span className="text-[#525252] dark:text-[#a1a1a6]">{t("chart.messages")}</span>
                <span className="font-mono font-medium tabular-nums">
                  {hoveredPoint.messages.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Narrower Breakdown List (1/3 width) */}
      <section className="lg:col-span-1 p-6 rounded-xl bg-white dark:bg-[#19191b] border border-black/[0.08] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between">
        <div>
          <h2 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
            {t("chart.statusTitle")}
          </h2>
          <p className="text-xs text-[#737373] dark:text-[#85858b] mt-1">
            {t("chart.statusSubtitle")}
          </p>

          <div className="mt-6 flex items-baseline justify-between pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
            <span className="text-[13px] text-[#525252] dark:text-[#a1a1a6]">
              {t("overview.totalUsers")}
            </span>
            <span className="text-[28px] leading-none font-medium tabular-nums text-[#171717] dark:text-[#ededed]">
              {stats.totalUsers.toLocaleString()}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {breakdownRows.map((row) => {
              const pct = Math.round((row.count / totalBase) * 100);
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="inline-flex items-center gap-2 text-[#525252] dark:text-[#a1a1a6]">
                      <span className={`w-2 h-2 rounded-full ${row.dotClass}`} />
                      <span>{row.label}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[#171717] dark:text-[#ededed]">
                      {row.count.toLocaleString()}{" "}
                      <span className="text-[#737373] dark:text-[#85858b]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-sm bg-[#f4f4f5] dark:bg-[#232325] overflow-hidden">
                    <div
                      className={`h-full rounded-sm ${row.barClass}`}
                      style={{ width: `${Math.max(row.count > 0 ? 4 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between text-xs text-[#737373] dark:text-[#85858b]">
          <span>{t("chart.totalMessages")}</span>
          <span className="font-mono tabular-nums text-[#171717] dark:text-[#ededed] font-medium">
            {stats.totalMessages.toLocaleString()}
          </span>
        </div>
      </section>
    </div>
  );
};
