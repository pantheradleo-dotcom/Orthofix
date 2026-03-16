const KEYS = {
  settings: 'orthofix_v3_settings',
  history: 'orthofix_v3_history',
};

export const DEFAULT_SETTINGS = {
  ollamaUrl: 'http://localhost:11434',
  model: 'gemma3:4b',
  mode: 'correction',
  tone: 'neutre',
  intensity: 'moyen',
  variants: 2,
};

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(KEYS.settings, {}) };
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function loadHistory() {
  const data = readJson(KEYS.history, []);
  return Array.isArray(data) ? data : [];
}

export function saveHistory(history) {
  localStorage.setItem(KEYS.history, JSON.stringify(history));
}
