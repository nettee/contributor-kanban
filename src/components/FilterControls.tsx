type ContributorFilter = "all" | "internal" | "external";

const FILTER_OPTIONS: Array<{
  value: ContributorFilter;
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "internal", label: "内部" },
  { value: "external", label: "外部" },
];

const REFRESH_OPTIONS = [5, 10, 30, 60] as const;

type FilterControlsProps = {
  filter: ContributorFilter;
  refreshMinutes: (typeof REFRESH_OPTIONS)[number];
  isRefreshing: boolean;
  onFilterChange: (filter: ContributorFilter) => void;
  onRefreshMinutesChange: (minutes: (typeof REFRESH_OPTIONS)[number]) => void;
  onRefreshNow: () => void;
};

export function FilterControls({
  filter,
  refreshMinutes,
  isRefreshing,
  onFilterChange,
  onRefreshMinutesChange,
  onRefreshNow,
}: FilterControlsProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">贡献者过滤</p>
          <div className="flex flex-wrap gap-2" aria-label="贡献者过滤">
            {FILTER_OPTIONS.map((option) => {
              const selected = option.value === filter;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onFilterChange(option.value)}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
                    selected
                      ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.18)]"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/40 hover:text-white",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-2 text-sm text-slate-300" htmlFor="refresh-interval">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-200/80">刷新间隔</span>
            <select
              id="refresh-interval"
              aria-label="刷新间隔"
              value={refreshMinutes}
              onChange={(event) => onRefreshMinutesChange(Number(event.target.value) as (typeof REFRESH_OPTIONS)[number])}
              className="min-w-36 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60"
            >
              {REFRESH_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} 分钟
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onRefreshNow}
            disabled={isRefreshing}
            className="rounded-2xl border border-cyan-300/35 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? "刷新中…" : "立即刷新"}
          </button>
        </div>
      </div>
    </section>
  );
}

export type { ContributorFilter };
export { REFRESH_OPTIONS };
