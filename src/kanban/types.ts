export const KANBAN_COLUMNS = [
  { id: "A", title: "未开始" },
  { id: "B", title: "不可合并" },
  { id: "C", title: "评审未通过" },
  { id: "D", title: "处理中" },
  { id: "E", title: "可合并" },
] as const;

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number]["id"];

export type PullRequestCard = {
  number: number;
  title: string;
  url: string;
  author: { login: string; isInternal: boolean };
  detailStatus: string;
  activityAt: string;
  updatedAt: string;
  column: KanbanColumnId;
};

export type KanbanColumn = {
  id: KanbanColumnId;
  title: string;
  cards: PullRequestCard[];
};

export type KanbanResponse = {
  refreshedAt: string;
  columns: KanbanColumn[];
  rateLimit?: { remaining?: number; resetAt?: string };
};

export type ErrorResponse = {
  error: string;
  detail?: string;
  retryAt?: string;
};
