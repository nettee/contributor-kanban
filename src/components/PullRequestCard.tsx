import type { PullRequestCard as PullRequestCardData } from "@/src/kanban/types";
import { formatRelativeTime } from "@/src/time";

type PullRequestCardProps = {
  card: PullRequestCardData;
};

const STATUS_STYLES = [
  { pattern: /draft/i, className: "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]" },
  { pattern: /CI|失败|fail/i, className: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]" },
  { pattern: /冲突|conflict/i, className: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]" },
  { pattern: /CHANGE_REQUESTED|评审未通过|changes/i, className: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[#8b5e20]" },
  { pattern: /评审通过|approved/i, className: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]" },
];

function getStatusClassName(status: string) {
  return STATUS_STYLES.find((item) => item.pattern.test(status))?.className ?? "border-[var(--purple-border)] bg-[var(--purple-light)] text-[var(--accent)]";
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 opacity-60">
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}

export function PullRequestCard({ card }: PullRequestCardProps) {
  const authorLabel = card.author.isInternal ? "内部" : "外部";

  return (
    <a
      href={card.url}
      target="_blank"
      rel="noreferrer"
      className="block cursor-default rounded-md border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-[box-shadow,border-color] duration-200 hover:border-[var(--purple-border)] hover:shadow-[var(--shadow-blue)_0_6px_16px_-8px,var(--shadow-black)_0_4px_8px_-4px] focus:outline-none focus:ring-2 focus:ring-[var(--purple-border)]"
      data-testid={`pr-card-${card.number}`}
      aria-label={`打开 PR #${card.number}: ${card.title}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="whitespace-nowrap rounded-[10px] border border-[var(--purple-border)] bg-[var(--purple-light)] px-2 py-px font-[var(--font-mono)] text-[11px] font-medium leading-[18px] text-[var(--accent)]">
          #{card.number}
        </span>
        <span
          className="flex min-w-0 items-center gap-1 text-xs text-[var(--muted)]"
        >
          <span className="truncate">{card.author.login}</span>
          <span
            className={[
              "shrink-0 whitespace-nowrap rounded-[3px] px-1 py-px text-[9px] font-medium uppercase tracking-[0.06em]",
              card.author.isInternal ? "bg-[var(--purple-light)] text-[var(--accent)]" : "bg-[var(--warning-bg)] text-[var(--warning)]",
            ].join(" ")}
          >
            {authorLabel}
          </span>
        </span>
      </div>

      <h3
        className="mb-2.5 overflow-hidden text-[13px] font-normal leading-[1.45] text-[var(--fg)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
        title={card.title}
      >
        {card.title}
      </h3>

      <div className={`mb-2.5 inline-flex items-center gap-1 rounded border px-2 py-[3px] text-[11px] font-normal ${getStatusClassName(card.detailStatus)}`}>
        {card.detailStatus}
      </div>

      <div className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
        <ClockIcon />
        {formatRelativeTime(card.activityAt)}
      </div>
    </a>
  );
}
