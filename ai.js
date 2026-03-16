function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

async function fetchJson(url, options = {}, timeoutMs = 35000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text || 'Erreur'}`);
    }
    return JSON.parse(text || '{}');
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Timeout de communication avec Ollama.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function extractFirstJsonObject(raw) {
  const text = String(raw || '');
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (start < 0) {
      if (ch === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaping) escaping = false;
      else if (ch === '\\') escaping = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseOutput(response) {
  const block = extractFirstJsonObject(response || '');
  if (!block) throw new Error('Réponse IA inexploitable (JSON absent).');
  const parsed = JSON.parse(block);
  const correctedText = typeof parsed.corrected_text === 'string' ? parsed.corrected_text : '';
  const corrections = Array.isArray(parsed.corrections) ? parsed.corrections : [];
  const reformulations = Array.isArray(parsed.reformulations) ? parsed.reformulations.map((item, i) => {
    if (typeof item === 'string') return { label: `Variante ${i + 1}`, text: item };
    return {
      label: typeof item?.label === 'string' ? item.label : `Variante ${i + 1}`,
      text: typeof item?.text === 'string' ? item.text : '',
    };
  }).filter((x) => x.text) : [];
  return { correctedText, corrections, reformulations };
}

export async function listModels(baseUrl) {
  const data = await fetchJson(`${normalizeBaseUrl(baseUrl)}/api/tags`, { method: 'GET' }, 10000);
  return Array.isArray(data.models) ? data.models.map((m) => m.name).filter(Boolean) : [];
}

export async function verifyModel(baseUrl, model) {
  const models = await listModels(baseUrl);
  return { exists: models.includes(model), models };
}

export async function runGeneration({ baseUrl, model, prompt }) {
  const data = await fetchJson(`${normalizeBaseUrl(baseUrl)}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, format: 'json', stream: false, options: { temperature: 0.3 } }),
  });

  if (String(data.error || '').toLowerCase().includes('model')) {
    throw new Error('Modèle introuvable sur cette instance Ollama.');
  }

  return parseOutput(data.response || '');
}
