import type { PullRequestCard as PullRequestCardData } from "@/src/kanban/types";
import { formatRelativeTime } from "@/src/time";

type PullRequestCardProps = {
  card: PullRequestCardData;
  refreshedAt?: string;
};

export function PullRequestCard({ card, refreshedAt }: PullRequestCardProps) {
  const authorLabel = card.author.isInternal ? "内部" : "外部";

  return (
    <article
      className="group rounded-[1.6rem] border border-white/10 bg-slate-950/85 p-4 shadow-[0_20px_50px_rgba(2,6,23,0.3)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30"
      data-testid={`pr-card-${card.number}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold tracking-[0.25em] text-cyan-100">
          PR #{card.number}
        </span>
        <span
          className={[
            "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
            card.author.isInternal ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200",
          ].join(" ")}
        >
          {authorLabel}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">@{card.author.login}</p>
          <h3
            className="overflow-hidden text-lg font-semibold leading-7 text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
            title={card.title}
          >
            {card.title}
          </h3>
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/5 px-3 py-2 text-sm text-slate-200">{card.detailStatus}</div>
      </div>

      <dl className="mt-4 space-y-2 text-sm text-slate-400">
        <div className="flex items-center justify-between gap-3">
          <dt>活跃于</dt>
          <dd className="text-right text-slate-200">{formatRelativeTime(card.activityAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>更新于</dt>
          <dd className="text-right text-slate-200">{formatRelativeTime(card.updatedAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>本次刷新</dt>
          <dd className="text-right text-slate-200">{refreshedAt ? formatRelativeTime(refreshedAt) : "等待同步"}</dd>
        </div>
      </dl>
    </article>
  );
}
