"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageNav } from "@/src/components/PageNav";
import {
  ANALYSIS_BUCKETS,
  type AnalysisBucket,
  type AnalysisErrorResponse,
  type AnalysisResponse,
  type AnalysisSnapshot,
} from "@/src/analysis/types";

const BUCKET_FILTER_OPTIONS: Array<{ value: "all" | AnalysisBucket; label: string }> = [
  { value: "all", label: "全部" },
  { value: "priority", label: "优先" },
  { value: "consider", label: "可接手" },
  { value: "skip", label: "不建议" },
];

const BUCKET_LABEL: Record<AnalysisBucket, string> = {
  priority: "高优先接手",
  consider: "可接手",
  skip: "不建议接手",
};

const BUCKET_BADGE_CLASS: Record<AnalysisBucket, string> = {
  priority: "bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]",
  consider: "bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)]",
  skip: "bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger-border)]",
};

function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  return typeof value === "object" && value !== null && "snapshot" in value;
}

function isErrorResponse(value: unknown): value is AnalysisErrorResponse {
  return typeof value === "object" && value !== null && "error" in value;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatRelative(iso: string, now: Date): string {
  const generated = new Date(iso);
  const diffMs = now.getTime() - generated.getTime();

  if (Number.isNaN(diffMs)) {
    return iso;
  }

  const absMin = Math.round(Math.abs(diffMs) / 60_000);
  if (absMin < 1) {
    return "刚刚";
  }
  if (absMin < 60) {
    return `${absMin} 分钟前`;
  }

  const hours = Math.round(absMin / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }

  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

export function AnalysisPage() {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [error, setError] = useState<AnalysisErrorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | AnalysisBucket>("all");
  const [now, setNow] = useState(() => new Date());

  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAnalysis = useCallback(async () => {
    abortControllerRef.current?.abort();

    const requestId = ++requestIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analysis", {
        cache: "no-store",
        signal: abortController.signal,
      });
      const payload = await readJson(response);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        const apiError = isErrorResponse(payload)
          ? payload
          : { error: `Request failed (${response.status})`, detail: response.statusText || "Unknown error" };
        setError(apiError);
        setSnapshot(null);
        return;
      }

      if (!isAnalysisResponse(payload)) {
        setError({ error: "Unexpected response", detail: "The analysis API returned an invalid payload." });
        setSnapshot(null);
        return;
      }

      setSnapshot(payload.snapshot);
    } catch (caughtError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }
      const message = caughtError instanceof Error ? caughtError.message : "Unknown error";
      setError({ error: "Network error", detail: message });
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchAnalysis();

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [fetchAnalysis]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredItems = useMemo(() => {
    if (!snapshot) return [];
    const sorted = [...snapshot.items].sort((a, b) => b.score - a.score || a.prNumber - b.prNumber);
    if (filter === "all") return sorted;
    return sorted.filter((item) => item.bucket === filter);
  }, [snapshot, filter]);

  const bucketCounts = useMemo(() => {
    const counts: Record<AnalysisBucket, number> = { priority: 0, consider: 0, skip: 0 };
    snapshot?.items.forEach((item) => {
      counts[item.bucket] = (counts[item.bucket] ?? 0) + 1;
    });
    return counts;
  }, [snapshot]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/85 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4">
          <div className="flex shrink-0 items-center gap-2 font-[var(--font-display)] text-lg font-medium tracking-[-0.01em] text-[var(--fg)]">
            <span>PR 接手价值评估</span>
          </div>
          <PageNav current="analysis" />

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap text-xs text-[var(--muted)]">桶</span>
              <div
                className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
                aria-label="评分桶"
              >
                {BUCKET_FILTER_OPTIONS.map((option) => {
                  const selected = option.value === filter;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setFilter(option.value)}
                      className={[
                        "border-0 border-r border-[var(--border)] px-3 py-[5px] font-[var(--font-body)] text-xs font-normal leading-[18px] transition last:border-r-0",
                        selected
                          ? "bg-[var(--accent)] text-white"
                          : "bg-transparent text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--label)]",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              {isLoading ? (
                <span>加载中…</span>
              ) : snapshot ? (
                <span title={snapshot.generatedAt}>更新于 {formatRelative(snapshot.generatedAt, now)}</span>
              ) : null}
              <button
                type="button"
                onClick={() => void fetchAnalysis()}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-[3px] text-xs text-[var(--muted)] hover:text-[var(--label)]"
              >
                刷新
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 pb-10 pt-5 max-[768px]:px-4 max-[768px]:pb-8 max-[768px]:pt-3">
        {error ? (
          <div className="mb-4 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
            <strong className="font-medium">{error.error}</strong>
            {error.detail ? <span className="ml-2 text-[var(--label)]">{error.detail}</span> : null}
          </div>
        ) : null}

        {!snapshot && !isLoading && !error ? (
          <EmptyState />
        ) : null}

        {snapshot ? (
          <>
            <section className="mb-6 grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
              {ANALYSIS_BUCKETS.map((bucket) => (
                <BucketStat key={bucket} bucket={bucket} count={bucketCounts[bucket] ?? 0} />
              ))}
            </section>

            {snapshot.summary ? (
              <section className="mb-6 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--label)]">
                {snapshot.summary}
              </section>
            ) : null}

            {snapshot.priorityRecommendations.length > 0 ? (
              <section className="mb-6 rounded-md border border-[var(--purple-border)] bg-[var(--purple-light)] px-4 py-3">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-[var(--accent)]">优先建议</h2>
                <ul className="space-y-1.5 text-sm text-[var(--label)]">
                  {snapshot.priorityRecommendations.map((rec) => {
                    const item = snapshot.items.find((i) => i.prNumber === rec.prNumber);
                    return (
                      <li key={rec.prNumber} className="flex flex-wrap items-baseline gap-2">
                        {item ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-[var(--font-mono)] text-sm text-[var(--accent)] hover:underline"
                          >
                            #{rec.prNumber}
                          </a>
                        ) : (
                          <span className="font-[var(--font-mono)] text-sm text-[var(--muted)]">#{rec.prNumber}</span>
                        )}
                        <span className="text-[var(--label)]">— {rec.reason}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <AnalysisTable items={filteredItems} />
          </>
        ) : null}
      </main>
    </div>
  );
}

function BucketStat({ bucket, count }: { bucket: AnalysisBucket; count: number }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className={`inline-flex rounded-[10px] px-2 py-0.5 text-[11px] font-medium ${BUCKET_BADGE_CLASS[bucket]}`}>
          {BUCKET_LABEL[bucket]}
        </span>
        <span className="font-[var(--font-mono)] text-xl font-medium text-[var(--fg)] [font-variant-numeric:tabular-nums]">
          {count}
        </span>
      </div>
    </div>
  );
}

function AnalysisTable({ items }: { items: AnalysisSnapshot["items"] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
        当前桶里没有 PR
      </div>
    );
  }

  return (
    <section className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--surface)]">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-[0.04em] text-[var(--muted)]">
            <th scope="col" className="px-3 py-2 font-medium">PR</th>
            <th scope="col" className="px-3 py-2 font-medium">标题</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">Score</th>
            <th scope="col" className="px-3 py-2 font-medium">桶</th>
            <th scope="col" className="px-3 py-2 font-medium">Draft</th>
            <th scope="col" className="px-3 py-2 font-medium">首次贡献</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">等待</th>
            <th scope="col" className="px-3 py-2 font-medium">结论</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.prNumber} className="border-b border-[var(--border)] last:border-0">
              <td className="px-3 py-2 align-top">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-[var(--font-mono)] text-[var(--accent)] hover:underline"
                >
                  #{item.prNumber}
                </a>
              </td>
              <td className="px-3 py-2 align-top text-[var(--label)]">{item.title}</td>
              <td className="px-3 py-2 align-top text-right font-[var(--font-mono)] [font-variant-numeric:tabular-nums]">
                <span className={item.bucket === "priority" ? "text-[var(--success-text)] font-medium" : "text-[var(--fg)]"}>
                  {item.score}
                </span>
              </td>
              <td className="px-3 py-2 align-top">
                <span className={`inline-flex rounded-[10px] px-2 py-0.5 text-[11px] font-medium ${BUCKET_BADGE_CLASS[item.bucket]}`}>
                  {BUCKET_LABEL[item.bucket]}
                </span>
              </td>
              <td className="px-3 py-2 align-top text-[var(--muted)]">{item.draft ? "是" : "否"}</td>
              <td className="px-3 py-2 align-top text-[var(--muted)]">{item.firstTimeContributor ? "是" : "否"}</td>
              <td className="px-3 py-2 align-top text-right font-[var(--font-mono)] text-[var(--muted)] [font-variant-numeric:tabular-nums]">
                {item.awaitingHours}h
              </td>
              <td className="px-3 py-2 align-top text-[var(--label)]">{item.conclusion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--muted)]">
      <p className="mb-1 text-[var(--label)]">暂无分析数据</p>
      <p>等下次定时任务（北京时间 9:00）写入后这里会自动显示。</p>
    </div>
  );
}
