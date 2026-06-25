import type { ReviewHelperSettings } from "./settings";

export type FileCategory = "business" | "test" | "lock" | "package" | "other";
export type ComplexityLabel = "Small" | "Medium" | "Large" | "Massive";
export type RiskType = "db" | "api" | "auth";

export interface ChangedFile {
  path: string;
  addedLines: number;
  removedLines: number;
}

export interface PackageChangeSummary {
  modified: boolean;
  dependenciesAdded: number;
  dependenciesRemoved: number;
  versionChanges: number;
}

export interface AnalysisResult {
  files: Array<ChangedFile & { category: FileCategory }>;
  business: {
    files: number;
    addedLines: number;
    removedLines: number;
  };
  tests: {
    files: number;
    addedLines: number;
    removedLines: number;
  };
  lockFiles: number;
  hiddenFiles: number;
  packageChanges: PackageChangeSummary;
  risks: RiskType[];
  complexityScore: number;
  complexityLabel: ComplexityLabel;
}

const LOCK_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]);
const TEST_PATTERNS = [
  "*.test.ts",
  "*.test.tsx",
  "*.spec.ts",
  "*.spec.tsx",
  "*.test.js",
  "*.spec.js",
  "__tests__/**",
  "__mocks__/**",
  "*.snap"
];

export function analyzeFiles(
  files: ChangedFile[],
  settings: ReviewHelperSettings,
  packageChanges: PackageChangeSummary = emptyPackageSummary()
): AnalysisResult {
  const analyzed = files.map((file) => ({
    ...file,
    category: categorizeFile(file.path, settings)
  }));

  const businessFiles = analyzed.filter((file) => file.category === "business");
  const testFiles = analyzed.filter((file) => file.category === "test");
  const hiddenFiles = analyzed.filter((file) => file.category === "test" || file.category === "lock");
  const lockFiles = analyzed.filter((file) => file.category === "lock");
  const businessAdded = sumBy(businessFiles, "addedLines");
  const businessRemoved = sumBy(businessFiles, "removedLines");
  const complexityScore = Math.round(
    businessFiles.length * 5 + businessAdded / 50 + businessRemoved / 50
  );

  return {
    files: analyzed,
    business: {
      files: businessFiles.length,
      addedLines: businessAdded,
      removedLines: businessRemoved
    },
    tests: {
      files: testFiles.length,
      addedLines: sumBy(testFiles, "addedLines"),
      removedLines: sumBy(testFiles, "removedLines")
    },
    lockFiles: lockFiles.length,
    hiddenFiles: hiddenFiles.length,
    packageChanges,
    risks: detectRisks(files, settings),
    complexityScore,
    complexityLabel: labelComplexity(complexityScore)
  };
}

export function categorizeFile(path: string, settings: ReviewHelperSettings): FileCategory {
  if (path.endsWith("/package.json") || path === "package.json") {
    return "package";
  }

  if (LOCK_FILES.has(fileName(path))) {
    return "lock";
  }

  if (matchesAny(path, TEST_PATTERNS) || matchesAny(path, settings.hiddenPatterns.filter(isTestPattern))) {
    return "test";
  }

  if (matchesAny(path, settings.hiddenPatterns)) {
    return "lock";
  }

  if (isIgnoredPath(path, settings.ignoredPaths)) {
    return "other";
  }

  if (settings.businessPaths.some((businessPath) => path.startsWith(businessPath))) {
    return "business";
  }

  return "other";
}

export function detectRisks(files: ChangedFile[], settings: ReviewHelperSettings): RiskType[] {
  const joinedPaths = files.map((file) => file.path.toLowerCase()).join("\n");

  return (Object.keys(settings.riskKeywords) as RiskType[]).filter((riskType) =>
    settings.riskKeywords[riskType].some((keyword) => joinedPaths.includes(keyword.toLowerCase()))
  );
}

export function labelComplexity(score: number): ComplexityLabel {
  if (score <= 20) {
    return "Small";
  }

  if (score <= 50) {
    return "Medium";
  }

  if (score <= 100) {
    return "Large";
  }

  return "Massive";
}

export function emptyPackageSummary(): PackageChangeSummary {
  return {
    modified: false,
    dependenciesAdded: 0,
    dependenciesRemoved: 0,
    versionChanges: 0
  };
}

function isIgnoredPath(path: string, ignoredPaths: string[]): boolean {
  return ignoredPaths.some((ignoredPath) => {
    const normalized = ignoredPath.replace(/^\/+/, "");
    return path === normalized.replace(/\/$/, "") || path.includes(`/${normalized}`) || path.startsWith(normalized);
  });
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

function isTestPattern(pattern: string): boolean {
  return /(?:test|spec|__tests__|__mocks__|snap)/i.test(pattern);
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*");

  return new RegExp(`(^|/)${escaped}$`, "i");
}

function sumBy(files: ChangedFile[], key: "addedLines" | "removedLines"): number {
  return files.reduce((total, file) => total + file[key], 0);
}

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}
