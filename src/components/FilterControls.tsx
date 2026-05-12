type ContributorFilter = "all" | "internal" | "external";

const FILTER_OPTIONS: Array<{
  value: ContributorFilter;
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "internal", label: "内部" },
  { value: "external", label: "外部" },
];

const REFRESH_OPTIONS = [15, 30, 60] as const;

type FilterControlsProps = {
  filter: ContributorFilter;
  refreshMinutes: (typeof REFRESH_OPTIONS)[number];
  onFilterChange: (filter: ContributorFilter) => void;
  onRefreshMinutesChange: (minutes: (typeof REFRESH_OPTIONS)[number]) => void;
};

export function FilterControls({
  filter,
  refreshMinutes,
  onFilterChange,
  onRefreshMinutesChange,
}: FilterControlsProps) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap text-xs text-[var(--muted)]">贡献者</span>
        <div
          className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
          aria-label="贡献者"
        >
          {FILTER_OPTIONS.map((option) => {
            const selected = option.value === filter;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onFilterChange(option.value)}
                className={[
                  "border-0 border-r border-[var(--border)] px-3 py-[5px] font-[var(--font-body)] text-xs font-normal leading-[18px] transition last:border-r-0 hover:bg-[var(--bg)] hover:text-[var(--label)]",
                  selected ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:text-white" : "bg-transparent text-[var(--muted)]",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap text-xs text-[var(--muted)]">刷新</span>
        <div
          className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
          aria-label="刷新间隔"
        >
          {REFRESH_OPTIONS.map((minutes) => {
            const selected = minutes === refreshMinutes;

            return (
              <button
                key={minutes}
                type="button"
                aria-pressed={selected}
                onClick={() => onRefreshMinutesChange(minutes)}
                className={[
                  "border-0 border-r border-[var(--border)] px-3 py-[5px] font-[var(--font-body)] text-xs font-normal leading-[18px] transition last:border-r-0 hover:bg-[var(--bg)] hover:text-[var(--label)]",
                  selected ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:text-white" : "bg-transparent text-[var(--muted)]",
                ].join(" ")}
              >
                {minutes}m
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export type { ContributorFilter };
export { REFRESH_OPTIONS };
