import {
  analyzeFiles,
  categorizeFile,
  emptyPackageSummary,
  type AnalysisResult,
  type ChangedFile,
  type FileCategory,
  type PackageChangeSummary,
  type RiskType
} from "../shared/analyzer";
import { DEFAULT_SETTINGS, loadSettings, type ReviewHelperSettings } from "../shared/settings";

type ViewMode = "default" | "show-hidden" | "tests-only" | "business-only";

interface FileElement {
  path: string;
  element: HTMLElement;
  addedLines: number;
  removedLines: number;
  category: FileCategory;
}

const PANEL_ID = "pr-review-helper";
const HIDDEN_ATTRIBUTE = "data-pr-review-helper-hidden";
const MODE_ATTRIBUTE = "data-pr-review-helper-mode";

let settings: ReviewHelperSettings = DEFAULT_SETTINGS;
let currentMode: ViewMode = "default";
let observer: MutationObserver | undefined;
let debounceTimer: number | undefined;

void init();

async function init(): Promise<void> {
  if (!isPullRequestUrl()) {
    return;
  }

  injectStyles();
  settings = await loadSettings();
  analyzeAndRender();
  observeGithubSpa();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.reviewHelperSettings) {
      void loadSettings().then((nextSettings) => {
        settings = nextSettings;
        analyzeAndRender();
      });
    }
  });
}

function observeGithubSpa(): void {
  observer?.disconnect();
  observer = new MutationObserver(() => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      if (isPullRequestUrl()) {
        analyzeAndRender();
      }
    }, 250);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function analyzeAndRender(): void {
  const fileElements = getFileElements();
  const packageChanges = analyzePackageChanges(fileElements);
  const analysis = analyzeFiles(
    fileElements.map(({ path, addedLines, removedLines }) => ({ path, addedLines, removedLines })),
    settings,
    packageChanges
  );

  const categoriesByPath = new Map(analysis.files.map((file) => [file.path, file.category]));
  const enrichedElements = fileElements.map((fileElement) => ({
    ...fileElement,
    category: categoriesByPath.get(fileElement.path) ?? categorizeFile(fileElement.path, settings)
  }));

  applyFileVisibility(enrichedElements);
  renderPanel(analysis);
}

function getFileElements(): FileElement[] {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".js-file, .file, div[data-path], div[data-tagsearch-path], copilot-diff-entry"
    )
  );
  const seenPaths = new Set<string>();
  const files: FileElement[] = [];

  for (const element of candidates) {
    const path = extractPath(element);

    if (!path || seenPaths.has(path) || element.closest(`#${PANEL_ID}`)) {
      continue;
    }

    seenPaths.add(path);
    const { addedLines, removedLines } = extractLineStats(element);
    files.push({
      path,
      element,
      addedLines,
      removedLines,
      category: categorizeFile(path, settings)
    });
  }

  return files;
}

function extractPath(element: HTMLElement): string | undefined {
  const directPath =
    element.getAttribute("data-path") ??
    element.getAttribute("data-tagsearch-path") ??
    element.querySelector<HTMLElement>("[data-path]")?.getAttribute("data-path") ??
    element.querySelector<HTMLElement>("[data-tagsearch-path]")?.getAttribute("data-tagsearch-path");

  if (directPath) {
    return directPath.trim();
  }

  const pathNode = element.querySelector<HTMLElement>(
    ".file-info a[title], .file-header a[title], a.Link--primary[title], [data-testid='file-header'] a[title]"
  );
  const title = pathNode?.getAttribute("title")?.trim();

  if (title && looksLikePath(title)) {
    return title;
  }

  return undefined;
}

function extractLineStats(element: HTMLElement): Pick<ChangedFile, "addedLines" | "removedLines"> {
  const countedAdditions = element.querySelectorAll(".blob-code-addition").length;
  const countedRemovals = element.querySelectorAll(".blob-code-deletion").length;

  if (countedAdditions > 0 || countedRemovals > 0) {
    return {
      addedLines: countedAdditions,
      removedLines: countedRemovals
    };
  }

  const text = element.querySelector<HTMLElement>(".diffstat, .file-info, .file-header")?.innerText ?? "";
  const addedMatch = text.match(/\+(\d+)/);
  const removedMatch = text.match(/-(\d+)/);

  return {
    addedLines: addedMatch ? Number(addedMatch[1]) : 0,
    removedLines: removedMatch ? Number(removedMatch[1]) : 0
  };
}

function analyzePackageChanges(fileElements: FileElement[]): PackageChangeSummary {
  const packageFile = fileElements.find((file) => file.path === "package.json" || file.path.endsWith("/package.json"));

  if (!packageFile) {
    return emptyPackageSummary();
  }

  const addedEntries = getDependencyEntries(packageFile.element, "addition");
  const removedEntries = getDependencyEntries(packageFile.element, "deletion");
  const removedByName = new Map(removedEntries.map((entry) => [entry.name, entry.version]));
  let versionChanges = 0;
  let dependenciesAdded = 0;

  for (const entry of addedEntries) {
    const removedVersion = removedByName.get(entry.name);

    if (removedVersion && removedVersion !== entry.version) {
      versionChanges += 1;
      removedByName.delete(entry.name);
    } else {
      dependenciesAdded += 1;
    }
  }

  return {
    modified: true,
    dependenciesAdded,
    dependenciesRemoved: removedByName.size,
    versionChanges
  };
}

function getDependencyEntries(
  element: HTMLElement,
  changeType: "addition" | "deletion"
): Array<{ name: string; version: string }> {
  const selector = changeType === "addition" ? ".blob-code-addition" : ".blob-code-deletion";
  const lines = Array.from(element.querySelectorAll<HTMLElement>(selector)).map((line) =>
    line.innerText.replace(/^[+-]/, "").trim()
  );
  const entries: Array<{ name: string; version: string }> = [];
  let insideDependencyBlock = false;

  for (const line of lines) {
    if (/^"(dependencies|devDependencies)"\s*:\s*\{/.test(line)) {
      insideDependencyBlock = true;
      continue;
    }

    if (insideDependencyBlock && line.startsWith("}")) {
      insideDependencyBlock = false;
      continue;
    }

    if (!insideDependencyBlock) {
      continue;
    }

    const dependencyMatch = line.match(/^"([^"]+)"\s*:\s*"([^"]+)"/);

    if (dependencyMatch?.[1] && dependencyMatch[2]) {
      entries.push({
        name: dependencyMatch[1],
        version: dependencyMatch[2]
      });
    }
  }

  return entries;
}

function applyFileVisibility(fileElements: FileElement[]): void {
  for (const fileElement of fileElements) {
    const shouldHide = shouldHideFile(fileElement.category);
    fileElement.element.toggleAttribute(HIDDEN_ATTRIBUTE, shouldHide);
    fileElement.element.setAttribute(MODE_ATTRIBUTE, currentMode);
    fileElement.element.style.display = shouldHide ? "none" : "";
  }
}

function shouldHideFile(category: FileCategory): boolean {
  if (currentMode === "show-hidden") {
    return false;
  }

  if (currentMode === "tests-only") {
    return category !== "test";
  }

  if (currentMode === "business-only") {
    return category !== "business";
  }

  return category === "test" || category === "lock";
}

function renderPanel(analysis: AnalysisResult): void {
  const existing = document.getElementById(PANEL_ID);
  const panel = existing ?? document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = panelMarkup(analysis);

  if (!existing) {
    document.body.append(panel);
  }

  panel.querySelector<HTMLButtonElement>("[data-action='toggle-hidden']")?.addEventListener("click", () => {
    currentMode = currentMode === "show-hidden" ? "default" : "show-hidden";
    analyzeAndRender();
  });
  panel.querySelector<HTMLButtonElement>("[data-action='tests-only']")?.addEventListener("click", () => {
    currentMode = currentMode === "tests-only" ? "default" : "tests-only";
    analyzeAndRender();
  });
  panel.querySelector<HTMLButtonElement>("[data-action='business-only']")?.addEventListener("click", () => {
    currentMode = currentMode === "business-only" ? "default" : "business-only";
    analyzeAndRender();
  });
  panel.querySelector<HTMLButtonElement>("[data-action='refresh']")?.addEventListener("click", () => {
    analyzeAndRender();
  });
}

function panelMarkup(analysis: AnalysisResult): string {
  const hiddenButtonLabel =
    currentMode === "show-hidden" ? "Hide Hidden Files" : `Show Hidden Files (${analysis.hiddenFiles})`;
  const packageStatus = analysis.packageChanges.modified ? "package.json modified" : "No package.json change";
  const risks = riskLabels(analysis.risks);

  return `
    <section class="prh-card" aria-label="PR Review Summary">
      <header>
        <strong>PR Review Summary</strong>
        <span class="prh-pill">${analysis.complexityLabel}</span>
      </header>

      <div class="prh-section">
        <h2>Business Logic</h2>
        <p>Files: ${analysis.business.files}</p>
        <p>+${analysis.business.addedLines} -${analysis.business.removedLines}</p>
        <p>Complexity: ${analysis.complexityLabel} (${analysis.complexityScore})</p>
      </div>

      <div class="prh-grid">
        <div>
          <h2>Tests</h2>
          <p>Files: ${analysis.tests.files}</p>
          <p>+${analysis.tests.addedLines} -${analysis.tests.removedLines}</p>
        </div>
        <div>
          <h2>Lock Files</h2>
          <p>Files: ${analysis.lockFiles}</p>
        </div>
      </div>

      <div class="prh-section">
        <h2>Dependencies</h2>
        <p>${packageStatus}</p>
        ${
          analysis.packageChanges.modified
            ? `<p>Added: ${analysis.packageChanges.dependenciesAdded} Removed: ${analysis.packageChanges.dependenciesRemoved}</p>
               <p>Version Changes: ${analysis.packageChanges.versionChanges}</p>`
            : ""
        }
      </div>

      <div class="prh-section">
        <h2>Risks</h2>
        ${risks.length > 0 ? risks.map((risk) => `<p class="prh-risk">! ${risk}</p>`).join("") : "<p>None detected</p>"}
      </div>

      <div class="prh-actions">
        <button type="button" data-action="toggle-hidden">${hiddenButtonLabel}</button>
        <button type="button" data-action="tests-only">${currentMode === "tests-only" ? "Show All Files" : "Show Tests Only"}</button>
        <button type="button" data-action="business-only">${currentMode === "business-only" ? "Show All Files" : "Show Business Logic Only"}</button>
        <button type="button" data-action="refresh">Refresh Analysis</button>
      </div>
    </section>
  `;
}

function riskLabels(risks: RiskType[]): string[] {
  const labels: Record<RiskType, string> = {
    db: "Database Change",
    api: "API Contract Change",
    auth: "Auth Change"
  };

  return risks.map((risk) => labels[risk]);
}

function injectStyles(): void {
  if (document.getElementById("pr-review-helper-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "pr-review-helper-styles";
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      width: 300px;
      color: #24292f;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #${PANEL_ID} .prh-card {
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(31, 35, 40, 0.16);
      padding: 14px;
    }

    #${PANEL_ID} header {
      align-items: center;
      border-bottom: 1px solid #d8dee4;
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
    }

    #${PANEL_ID} h2 {
      font-size: 12px;
      margin: 0 0 4px;
      text-transform: uppercase;
      color: #57606a;
      letter-spacing: 0.04em;
    }

    #${PANEL_ID} p {
      margin: 2px 0;
    }

    #${PANEL_ID} .prh-section,
    #${PANEL_ID} .prh-grid {
      border-bottom: 1px solid #d8dee4;
      margin-bottom: 10px;
      padding-bottom: 10px;
    }

    #${PANEL_ID} .prh-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr 1fr;
    }

    #${PANEL_ID} .prh-pill {
      background: #ddf4ff;
      border: 1px solid #54aeff;
      border-radius: 999px;
      color: #0969da;
      font-size: 12px;
      padding: 2px 8px;
    }

    #${PANEL_ID} .prh-risk {
      color: #9a6700;
      font-weight: 600;
    }

    #${PANEL_ID} .prh-actions {
      display: grid;
      gap: 6px;
    }

    #${PANEL_ID} button {
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      color: #24292f;
      cursor: pointer;
      font: inherit;
      padding: 6px 8px;
      text-align: left;
    }

    #${PANEL_ID} button:hover {
      background: #eef1f4;
    }
  `;
  document.head.append(style);
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || /\.[a-z0-9]+$/i.test(value);
}

function isPullRequestUrl(): boolean {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(window.location.href);
}
