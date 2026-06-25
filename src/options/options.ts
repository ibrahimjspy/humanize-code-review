import {
  loadSettings,
  resetSettings,
  saveSettings,
  type ReviewHelperSettings,
  type RiskKeywordSettings
} from "../shared/settings";

const hiddenPatternsInput = getTextarea("hiddenPatterns");
const businessPathsInput = getTextarea("businessPaths");
const ignoredPathsInput = getTextarea("ignoredPaths");
const riskKeywordsInput = getTextarea("riskKeywords");
const statusElement = getElement("status");

document.getElementById("save")?.addEventListener("click", () => {
  void saveFromForm();
});

document.getElementById("reset")?.addEventListener("click", () => {
  void resetSettings().then((settings) => {
    populateForm(settings);
    setStatus("Defaults restored.", "success");
  });
});

void loadSettings().then(populateForm);

async function saveFromForm(): Promise<void> {
  try {
    const settings: ReviewHelperSettings = {
      hiddenPatterns: parseLineList(hiddenPatternsInput.value, "Hidden patterns"),
      businessPaths: parseLineList(businessPathsInput.value, "Business paths"),
      ignoredPaths: parseLineList(ignoredPathsInput.value, "Ignored paths"),
      riskKeywords: parseRiskKeywords(riskKeywordsInput.value)
    };

    await saveSettings(settings);
    setStatus("Settings saved.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to save settings.", "error");
  }
}

function populateForm(settings: ReviewHelperSettings): void {
  hiddenPatternsInput.value = settings.hiddenPatterns.join("\n");
  businessPathsInput.value = settings.businessPaths.join("\n");
  ignoredPathsInput.value = settings.ignoredPaths.join("\n");
  riskKeywordsInput.value = JSON.stringify(settings.riskKeywords, null, 2);
}

function parseLineList(value: string, label: string): string[] {
  const values = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }

  return values;
}

function parseRiskKeywords(value: string): RiskKeywordSettings {
  const parsed: unknown = JSON.parse(value);

  if (!isRiskKeywordSettings(parsed)) {
    throw new Error('Risk keywords must be JSON like {"db":["migration"],"api":["dto"],"auth":["jwt"]}.');
  }

  return parsed;
}

function isRiskKeywordSettings(value: unknown): value is RiskKeywordSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return ["db", "api", "auth"].every(
    (key) =>
      Array.isArray(record[key]) &&
      record[key].length > 0 &&
      record[key].every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function setStatus(message: string, type: "error" | "success"): void {
  statusElement.textContent = message;
  statusElement.className = type;
}

function getTextarea(id: string): HTMLTextAreaElement {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing textarea #${id}`);
  }

  return element;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element #${id}`);
  }

  return element;
}
