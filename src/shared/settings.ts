export type RiskKeywordSettings = Record<"db" | "api" | "auth", string[]>;

export interface ReviewHelperSettings {
  hiddenPatterns: string[];
  businessPaths: string[];
  ignoredPaths: string[];
  riskKeywords: RiskKeywordSettings;
}

export const DEFAULT_SETTINGS: ReviewHelperSettings = {
  hiddenPatterns: [
    "*.test.ts",
    "*.test.tsx",
    "*.spec.ts",
    "*.spec.tsx",
    "*.test.js",
    "*.spec.js",
    "__tests__/**",
    "__mocks__/**",
    "*.snap",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb"
  ],
  businessPaths: ["src/", "apps/", "libs/", "services/", "packages/"],
  ignoredPaths: ["tests/", "__tests__/", "coverage/", "dist/", "build/"],
  riskKeywords: {
    db: ["migration", "migrations", "typeorm migration", "prisma migration", "schema.sql"],
    api: ["graphql", "schema", "dto", "openapi", "swagger", "proto", "interface"],
    auth: ["guard", "jwt", "auth", "permission", "role", "rbac"]
  }
};

const STORAGE_KEY = "reviewHelperSettings";

export async function loadSettings(): Promise<ReviewHelperSettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return normalizeSettings(result[STORAGE_KEY]);
}

export async function saveSettings(settings: ReviewHelperSettings): Promise<void> {
  await chrome.storage.sync.set({
    [STORAGE_KEY]: normalizeSettings(settings)
  });
}

export async function resetSettings(): Promise<ReviewHelperSettings> {
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

function normalizeSettings(value: unknown): ReviewHelperSettings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }

  return {
    hiddenPatterns: normalizeStringArray(value.hiddenPatterns, DEFAULT_SETTINGS.hiddenPatterns),
    businessPaths: normalizeStringArray(value.businessPaths, DEFAULT_SETTINGS.businessPaths),
    ignoredPaths: normalizeStringArray(value.ignoredPaths, DEFAULT_SETTINGS.ignoredPaths),
    riskKeywords: normalizeRiskKeywords(value.riskKeywords)
  };
}

function normalizeRiskKeywords(value: unknown): RiskKeywordSettings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS.riskKeywords;
  }

  return {
    db: normalizeStringArray(value.db, DEFAULT_SETTINGS.riskKeywords.db),
    api: normalizeStringArray(value.api, DEFAULT_SETTINGS.riskKeywords.api),
    auth: normalizeStringArray(value.auth, DEFAULT_SETTINGS.riskKeywords.auth)
  };
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
