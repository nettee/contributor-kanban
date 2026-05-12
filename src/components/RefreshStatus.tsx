import type { ErrorResponse } from "@/src/kanban/types";
import { formatRelativeTime } from "@/src/time";

type RefreshStatusProps = {
  isLoading: boolean;
  isRefreshing: boolean;
  lastRefreshedAt?: string;
  error: ErrorResponse | null;
  onRefreshNow: () => void;
};

export function RefreshStatus({ isLoading, isRefreshing, lastRefreshedAt, error, onRefreshNow }: RefreshStatusProps) {
  const statusLabel = isLoading
    ? "加载中…"
    : isRefreshing
      ? "刷新中…"
      : lastRefreshedAt
        ? `${formatRelativeTime(lastRefreshedAt)}刷新`
        : "刚刚刷新";

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]" aria-live="polite">
        <span role="status">{statusLabel}</span>
        <button
          type="button"
          title="立即刷新"
          onClick={onRefreshNow}
          disabled={isRefreshing}
          className={[
            "inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-[5px] font-[var(--font-body)] text-xs font-normal leading-[18px] text-[var(--accent)] transition hover:border-[var(--purple-border)] hover:bg-[var(--purple-light)] disabled:cursor-not-allowed disabled:opacity-60",
            isRefreshing ? "[&_svg]:animate-spin" : "",
          ].join(" ")}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 1.5v4h4" />
            <path d="M1.82 10a6.5 6.5 0 1 0 1.18-5L1.5 5.5" />
          </svg>
          刷新
        </button>
      </div>

      {error ? (
        <section
          role="alert"
          className="basis-full rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-xs text-[var(--danger)]"
        >
          <p className="font-medium">请求失败</p>
          <div className="mt-2 space-y-1">
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
    </>
  );
}
