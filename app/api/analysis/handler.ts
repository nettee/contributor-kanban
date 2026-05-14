import { NextResponse } from "next/server";
import { getAnalysisStore, type AnalysisStore } from "@/src/analysis/store";
import {
  ANALYSIS_BUCKETS,
  type AnalysisErrorResponse,
  type AnalysisItem,
  type AnalysisResponse,
  type AnalysisSnapshot,
  type AnalysisBucket,
  type PriorityRecommendation,
} from "@/src/analysis/types";

const READ_CACHE_SECONDS = 60;

type Env = Partial<Record<string, string | undefined>>;

type HandlerDependencies = {
  getEnv?: () => Env;
  getStore?: () => AnalysisStore;
  now?: () => Date;
};

export function createAnalysisGetHandler(dependencies: HandlerDependencies = {}) {
  const readEnv = dependencies.getEnv ?? (() => process.env);
  const readStore = dependencies.getStore ?? (() => getAnalysisStore(readEnv()));

  return async function GET(): Promise<NextResponse<AnalysisResponse | AnalysisErrorResponse>> {
    try {
      const store = readStore();
      const snapshot = await store.getLatest();

      return NextResponse.json(
        { snapshot },
        {
          headers: {
            "Cache-Control": `private, max-age=${READ_CACHE_SECONDS}`,
          },
        },
      );
    } catch (error) {
      return NextResponse.json(
        { error: "Analysis storage error", detail: errorMessage(error) },
        { status: 502 },
      );
    }
  };
}

export function createAnalysisPostHandler(dependencies: HandlerDependencies = {}) {
  const readEnv = dependencies.getEnv ?? (() => process.env);
  const readStore = dependencies.getStore ?? (() => getAnalysisStore(readEnv()));
  const readNow = dependencies.now ?? (() => new Date());

  return async function POST(request: Request): Promise<NextResponse<AnalysisResponse | AnalysisErrorResponse>> {
    const env = readEnv();
    const expectedToken = env.ANALYSIS_WRITE_TOKEN?.trim();

    if (!expectedToken) {
      return NextResponse.json(
        { error: "Analysis writes are disabled", detail: "ANALYSIS_WRITE_TOKEN is not configured" },
        { status: 503 },
      );
    }

    if (!hasValidBearerToken(request, expectedToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    let snapshot: AnalysisSnapshot;
    try {
      snapshot = parseSnapshot(rawPayload, readNow());
    } catch (error) {
      return NextResponse.json({ error: "Invalid payload", detail: errorMessage(error) }, { status: 400 });
    }

    try {
      await readStore().saveLatest(snapshot);
    } catch (error) {
      return NextResponse.json(
        { error: "Analysis storage error", detail: errorMessage(error) },
        { status: 502 },
      );
    }

    return NextResponse.json({ snapshot }, { status: 200 });
  };
}

function hasValidBearerToken(request: Request, expected: string): boolean {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) {
    return false;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return false;
  }

  return timingSafeEqual(match[1].trim(), expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function parseSnapshot(payload: unknown, now: Date): AnalysisSnapshot {
  if (!isPlainObject(payload)) {
    throw new Error("Body must be a JSON object");
  }

  const items = parseItems(payload.items);
  const priorityRecommendations = parsePriorityRecommendations(
    payload.priorityRecommendations ?? [],
    new Set(items.map((item) => item.prNumber)),
  );
  const generatedAt = parseGeneratedAt(payload.generatedAt, now);
  const generatedBy = parseOptionalString(payload.generatedBy, "generatedBy", 200);
  const summary = parseOptionalString(payload.summary, "summary", 2000);

  return {
    generatedAt,
    generatedBy,
    summary,
    priorityRecommendations,
    items,
  };
}

function parseItems(value: unknown): AnalysisItem[] {
  if (!Array.isArray(value)) {
    throw new Error("items must be an array");
  }

  if (value.length === 0) {
    throw new Error("items must contain at least one entry");
  }

  if (value.length > 500) {
    throw new Error("items contains too many entries (max 500)");
  }

  const seen = new Set<number>();

  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`items[${index}] must be an object`);
    }

    const prNumber = parsePrNumber(entry.prNumber, `items[${index}].prNumber`);
    if (seen.has(prNumber)) {
      throw new Error(`items[${index}].prNumber duplicates an earlier entry`);
    }
    seen.add(prNumber);

    return {
      prNumber,
      title: parseRequiredString(entry.title, `items[${index}].title`, 300),
      url: parseRequiredString(entry.url, `items[${index}].url`, 500),
      score: parseScore(entry.score, `items[${index}].score`),
      bucket: parseBucket(entry.bucket, `items[${index}].bucket`),
      draft: parseBoolean(entry.draft, `items[${index}].draft`),
      firstTimeContributor: parseBoolean(entry.firstTimeContributor, `items[${index}].firstTimeContributor`),
      awaitingHours: parseAwaitingHours(entry.awaitingHours, `items[${index}].awaitingHours`),
      conclusion: parseRequiredString(entry.conclusion, `items[${index}].conclusion`, 1000),
    };
  });
}

function parsePriorityRecommendations(value: unknown, knownPrNumbers: Set<number>): PriorityRecommendation[] {
  if (!Array.isArray(value)) {
    throw new Error("priorityRecommendations must be an array");
  }

  if (value.length > 20) {
    throw new Error("priorityRecommendations contains too many entries (max 20)");
  }

  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`priorityRecommendations[${index}] must be an object`);
    }

    const prNumber = parsePrNumber(entry.prNumber, `priorityRecommendations[${index}].prNumber`);
    if (!knownPrNumbers.has(prNumber)) {
      throw new Error(`priorityRecommendations[${index}].prNumber #${prNumber} is not present in items`);
    }

    return {
      prNumber,
      reason: parseRequiredString(entry.reason, `priorityRecommendations[${index}].reason`, 500),
    };
  });
}

function parseGeneratedAt(value: unknown, fallback: Date): string {
  if (value === undefined || value === null) {
    return fallback.toISOString();
  }

  if (typeof value !== "string") {
    throw new Error("generatedAt must be an ISO 8601 string");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("generatedAt must be a valid ISO 8601 string");
  }

  return parsed.toISOString();
}

function parsePrNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function parseRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds max length ${maxLength}`);
  }
  return trimmed;
}

function parseOptionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds max length ${maxLength}`);
  }
  return trimmed;
}

function parseScore(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`${field} must be within [0, 100]`);
  }
  return Math.round(value);
}

function parseBucket(value: unknown, field: string): AnalysisBucket {
  if (typeof value !== "string" || !ANALYSIS_BUCKETS.includes(value as AnalysisBucket)) {
    throw new Error(`${field} must be one of: ${ANALYSIS_BUCKETS.join(", ")}`);
  }
  return value as AnalysisBucket;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

function parseAwaitingHours(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
  return Math.round(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
