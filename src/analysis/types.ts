export const ANALYSIS_BUCKETS = ["priority", "consider", "skip"] as const;
export type AnalysisBucket = (typeof ANALYSIS_BUCKETS)[number];

export type AnalysisItem = {
  prNumber: number;
  title: string;
  url: string;
  score: number;
  bucket: AnalysisBucket;
  draft: boolean;
  firstTimeContributor: boolean;
  awaitingHours: number;
  conclusion: string;
};

export type PriorityRecommendation = {
  prNumber: number;
  reason: string;
};

export type AnalysisSnapshot = {
  generatedAt: string;
  generatedBy?: string;
  summary?: string;
  priorityRecommendations: PriorityRecommendation[];
  items: AnalysisItem[];
};

export type AnalysisResponse = {
  snapshot: AnalysisSnapshot | null;
};

export type AnalysisErrorResponse = {
  error: string;
  detail?: string;
};
