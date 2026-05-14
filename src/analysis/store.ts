import type { AnalysisSnapshot } from "./types";

const KV_KEY = "analysis:latest";

export type AnalysisStore = {
  getLatest: () => Promise<AnalysisSnapshot | null>;
  saveLatest: (snapshot: AnalysisSnapshot) => Promise<void>;
};

type Env = Partial<Record<string, string | undefined>>;

type KvCredentials = {
  url: string;
  token: string;
};

function readKvCredentials(env: Env): KvCredentials | null {
  const url = env.KV_REST_API_URL?.trim();
  const token = env.KV_REST_API_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function createKvStore(credentials: KvCredentials): AnalysisStore {
  const base = credentials.url.replace(/\/$/, "");
  const authHeader = { Authorization: `Bearer ${credentials.token}` };

  return {
    async getLatest() {
      const response = await fetch(`${base}/get/${encodeURIComponent(KV_KEY)}`, {
        headers: authHeader,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`KV GET failed with status ${response.status}`);
      }

      const body = (await response.json()) as { result: string | null };

      if (body.result === null || body.result === undefined) {
        return null;
      }

      try {
        return JSON.parse(body.result) as AnalysisSnapshot;
      } catch (error) {
        throw new Error(`Failed to parse KV payload: ${error instanceof Error ? error.message : "unknown"}`);
      }
    },

    async saveLatest(snapshot) {
      const response = await fetch(`${base}/set/${encodeURIComponent(KV_KEY)}`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`KV SET failed with status ${response.status}`);
      }
    },
  };
}

function createMemoryStore(): AnalysisStore {
  let value: AnalysisSnapshot | null = null;

  return {
    async getLatest() {
      return value;
    },
    async saveLatest(snapshot) {
      value = snapshot;
    },
  };
}

let cachedStore: AnalysisStore | null = null;
let cachedStoreKey: string | null = null;
const memoryStore = createMemoryStore();

export function getAnalysisStore(env: Env = process.env): AnalysisStore {
  const credentials = readKvCredentials(env);

  if (!credentials) {
    return memoryStore;
  }

  const key = `${credentials.url}:${credentials.token}`;

  if (cachedStore && cachedStoreKey === key) {
    return cachedStore;
  }

  cachedStore = createKvStore(credentials);
  cachedStoreKey = key;
  return cachedStore;
}

export function resetAnalysisStoreCacheForTests(): void {
  cachedStore = null;
  cachedStoreKey = null;
}
