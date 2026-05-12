import type { ErrorResponse, KanbanResponse } from "@/src/kanban/types";
import { formatRelativeTime } from "@/src/time";

type RefreshStatusProps = {
  isLoading: boolean;
  isRefreshing: boolean;
  lastRefreshedAt?: string;
  error: ErrorResponse | null;
  rateLimit?: KanbanResponse["rateLimit"];
};

export function RefreshStatus({ isLoading, isRefreshing, lastRefreshedAt, error, rateLimit }: RefreshStatusProps) {
  const statusLabel = isLoading
    ? "正在加载看板…"
    : isRefreshing
      ? "正在刷新数据…"
      : lastRefreshedAt
        ? `上次刷新 ${formatRelativeTime(lastRefreshedAt)}`
        : "等待首次加载";

  return (
    <div className="space-y-3">
      <section
        aria-live="polite"
        className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-200 shadow-[0_16px_50px_rgba(2,6,23,0.3)] backdrop-blur-xl"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3" role="status">
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                isLoading || isRefreshing ? "animate-pulse bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.7)]" : "bg-emerald-300",
              ].join(" ")}
            />
            <span>{statusLabel}</span>
          </div>

          {rateLimit ? (
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              剩余限额 {rateLimit.remaining ?? "—"}
              {rateLimit.resetAt ? ` · 重置 ${formatRelativeTime(rateLimit.resetAt)}` : ""}
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <section
          role="alert"
          className="rounded-[1.75rem] border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100 shadow-[0_16px_50px_rgba(127,29,29,0.28)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-200/90">请求失败</p>
          <div className="mt-3 space-y-2">
            <p>
              <span className="font-semibold">error:</span> {error.error}
            </p>
            {error.detail ? (
              <p>
                <span className="font-semibold">detail:</span> {error.detail}
              </p>
            ) : null}
            {error.retryAt ? (
              <p>
                <span className="font-semibold">retryAt:</span> {error.retryAt}（{formatRelativeTime(error.retryAt)}）
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
