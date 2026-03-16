const MAX_HISTORY = 12;

const state = {
  selectedTone: 'neutre',
  selectedAction: 'corriger',
  isLoading: false,
  lastResult: null,
  history: [],
};

const dom = {
  inputText: document.getElementById('inputText'),
  charCount: document.getElementById('charCount'),
  refoCount: document.getElementById('refoCount'),
  ollamaUrl: document.getElementById('ollamaUrl'),
  ollamaModel: document.getElementById('ollamaModel'),
  runBtn: document.getElementById('runBtn'),
  runIcon: document.getElementById('runIcon'),
  runLabel: document.getElementById('runLabel'),
  clearBtn: document.getElementById('clearBtn'),
  testConnBtn: document.getElementById('testConnBtn'),
  listModelsBtn: document.getElementById('listModelsBtn'),
  statusBanner: document.getElementById('statusBanner'),
  modelsPanel: document.getElementById('modelsPanel'),
  modelsList: document.getElementById('modelsList'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  emptyState: document.getElementById('emptyState'),
  resultCard: document.getElementById('resultCard'),
  resultMeta: document.getElementById('resultMeta'),
  originalTextBlock: document.getElementById('originalTextBlock'),
  correctedTextBlock: document.getElementById('correctedTextBlock'),
  correctionsList: document.getElementById('correctionsList'),
  refoList: document.getElementById('refoList'),
  correctedSection: document.getElementById('correctedSection'),
  correctionsSection: document.getElementById('correctionsSection'),
  reformulationsSection: document.getElementById('reformulationsSection'),
  toast: document.getElementById('toast'),
  tryExampleBtn: document.getElementById('tryExampleBtn'),
  copyOriginalBtn: document.getElementById('copyOriginalBtn'),
  reuseOriginalBtn: document.getElementById('reuseOriginalBtn'),
  copyCorrectedBtn: document.getElementById('copyCorrectedBtn'),
  reuseCorrectedBtn: document.getElementById('reuseCorrectedBtn'),
};

init();

function init() {
  bindToneActions();
  bindMainActions();
  loadHistory();
  updateCount();
  renderHistory();
}

function bindToneActions() {
  document.querySelectorAll('.tone-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tone-btn').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      state.selectedTone = btn.dataset.tone;
    });
  });

  document.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.action-btn').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      state.selectedAction = btn.dataset.action;
      updateRunButtonLabel();
    });
  });
}

function bindMainActions() {
  dom.inputText.addEventListener('input', updateCount);
  dom.inputText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runAction();
  });
  dom.runBtn.addEventListener('click', runAction);
  dom.clearBtn.addEventListener('click', clearOutput);
  dom.testConnBtn.addEventListener('click', testOllamaConnection);
  dom.listModelsBtn.addEventListener('click', showModels);
  dom.clearHistoryBtn.addEventListener('click', clearHistory);
  dom.tryExampleBtn.addEventListener('click', fillExample);

  dom.copyOriginalBtn.addEventListener('click', () => copyText(state.lastResult?.originalText || ''));
  dom.reuseOriginalBtn.addEventListener('click', () => putInInput(state.lastResult?.originalText || ''));
  dom.copyCorrectedBtn.addEventListener('click', () => copyText(state.lastResult?.correctedText || ''));
  dom.reuseCorrectedBtn.addEventListener('click', () => putInInput(state.lastResult?.correctedText || ''));

  updateRunButtonLabel();
}

function updateRunButtonLabel() {
  const labels = {
    corriger: 'Corriger',
    corriger_reformuler: 'Corriger + reformuler',
    reecrire: 'Réécrire',
  };
  dom.runLabel.textContent = labels[state.selectedAction] || 'Lancer l\'action';
}

function updateCount() {
  const txt = dom.inputText.value;
  const chars = txt.length;
  const words = txt.trim() ? txt.trim().split(/\s+/).length : 0;
  dom.charCount.textContent = `${chars} caractère${chars > 1 ? 's' : ''} · ${words} mot${words > 1 ? 's' : ''}`;
}

function setBanner(type, message) {
  dom.statusBanner.className = `status-banner status-${type}`;
  dom.statusBanner.textContent = message;
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function classifyHttpError(status, bodyText) {
  if (status === 404) {
    return bodyText.includes('/api/generate')
      ? { code: 'endpoint_incorrect', message: 'Endpoint Ollama incorrect ou version non compatible.' }
      : { code: 'not_found', message: 'Ressource introuvable (404).' };
  }
  if (status >= 500) {
    return { code: 'server_error', message: 'Erreur serveur Ollama.' };
  }
  return { code: 'http_error', message: `Erreur HTTP ${status}.` };
}

async function fetchJson(url, options = {}, timeoutMs = 35000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await response.text();

    if (!response.ok) {
      const err = classifyHttpError(response.status, text);
      throw { type: err.code, details: err.message, status: response.status, body: text };
    }

    if (!text.trim()) {
      throw { type: 'empty_response', details: 'Réponse vide du serveur.' };
    }

    try {
      return JSON.parse(text);
    } catch {
      throw { type: 'json_invalid', details: 'Réponse JSON invalide du serveur.' };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw { type: 'timeout', details: 'Le serveur a mis trop de temps à répondre.' };
    }
    if (error.type) throw error;
    throw { type: 'ollama_unreachable', details: 'Impossible de contacter Ollama.' };
  } finally {
    clearTimeout(timer);
  }
}

function extractFirstJsonObject(raw) {
  if (!raw || !String(raw).trim()) return null;
  const text = String(raw);
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (start === -1) {
      if (ch === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === '\\') {
        escaping = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function parseAiResponse(rawModelResponse, action) {
  const output = {
    corrected_text: '',
    corrections: [],
    reformulations: [],
    errors: [],
    partial: false,
  };

  if (!rawModelResponse || !String(rawModelResponse).trim()) {
    output.errors.push('Réponse du modèle vide.');
    return output;
  }

  const jsonBlock = extractFirstJsonObject(rawModelResponse);
  if (!jsonBlock) {
    output.errors.push('Aucun bloc JSON exploitable trouvé dans la réponse du modèle.');
    return output;
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    output.errors.push('Bloc JSON détecté mais invalide.');
    return output;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    output.errors.push('Structure JSON inattendue.');
    return output;
  }

  const correctedText = ensureString(parsed.corrected_text, '');
  const corrections = ensureArray(parsed.corrections).filter((item) => (
    item && typeof item.before === 'string' && typeof item.after === 'string'
  )).map((item) => ({
    before: item.before,
    after: item.after,
    reason: ensureString(item.reason, ''),
  }));
  const reformulations = ensureArray(parsed.reformulations).filter((x) => typeof x === 'string');

  if (!correctedText && action !== 'reecrire') {
    output.errors.push('Champ corrected_text manquant ou invalide.');
    output.partial = true;
  }
  if (!Array.isArray(parsed.corrections)) {
    output.errors.push('Champ corrections manquant ou invalide.');
    output.partial = true;
  }
  if (!Array.isArray(parsed.reformulations)) {
    output.errors.push('Champ reformulations manquant ou invalide.');
    output.partial = true;
  }

  output.corrected_text = correctedText;
  output.corrections = corrections;
  output.reformulations = reformulations;
  return output;
}

function formatErrorMessage(err) {
  const map = {
    ollama_unreachable: 'Ollama inaccessible. Vérifiez que le serveur tourne.',
    endpoint_incorrect: 'Endpoint incorrect. Vérifiez l\'URL Ollama.',
    model_missing: 'Modèle absent. Téléchargez-le avec `ollama pull`.',
    timeout: 'Timeout dépassé. Le modèle est peut-être trop lent.',
    empty_response: 'Réponse vide reçue.',
    json_invalid: 'JSON invalide reçu depuis le serveur.',
    server_error: 'Erreur serveur Ollama.',
    http_error: 'Erreur HTTP inattendue.',
  };
  return map[err.type] || err.details || 'Erreur inconnue.';
}

function handleError(err) {
  const msg = formatErrorMessage(err);
  setBanner('error', msg);
  showToast(msg, 'error');
}

function buildPrompt(text, action, tone, refoCount) {
  const instructions = {
    corriger: `Corrige strictement le texte. Retourne le texte corrigé et la liste des corrections.`,
    corriger_reformuler: `Corrige le texte puis propose ${refoCount} reformulations en style ${tone}.`,
    reecrire: `Réécris le texte en ${tone} avec ${refoCount} versions, sans ajouter d'information non demandée.`,
  };

  return `Tu es OrthoFix V2. Réponds uniquement avec un JSON.

Format attendu :
{
  "corrected_text": "...",
  "corrections": [
    { "before": "...", "after": "...", "reason": "..." }
  ],
  "reformulations": ["...", "..."]
}

Règles :
- ${instructions[action]}
- Si aucun élément, retourne un tableau vide correspondant.
- Pas de texte hors JSON.

Texte :
"""
${text}
"""`;
}

function detectModelMissing(rawBodyText) {
  const lower = String(rawBodyText || '').toLowerCase();
  return lower.includes('model') && (lower.includes('not found') || lower.includes('missing') || lower.includes('unknown'));
}

async function runAction() {
  if (state.isLoading) return;

  const text = dom.inputText.value.trim();
  const baseUrl = normalizeBaseUrl(dom.ollamaUrl.value);
  const model = dom.ollamaModel.value.trim();
  const refoCount = Number(dom.refoCount.value);

  if (!text) {
    showToast('Veuillez saisir un texte.', 'info');
    return;
  }
  if (!baseUrl || !model) {
    showToast('URL Ollama et modèle requis.', 'error');
    return;
  }

  setLoading(true);
  setBanner('info', 'Traitement en cours…');

  const prompt = buildPrompt(text, state.selectedAction, state.selectedTone, refoCount);

  try {
    const data = await fetchJson(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.2 },
      }),
    });

    if (detectModelMissing(data.error || data.response || '')) {
      throw { type: 'model_missing', details: 'Le modèle demandé est absent.' };
    }

    const parsed = parseAiResponse(data.response || '', state.selectedAction);
    if (!parsed.corrected_text && parsed.reformulations.length === 0) {
      throw { type: 'json_invalid', details: parsed.errors.join(' ') || 'Aucune donnée exploitable.' };
    }

    if (parsed.errors.length) {
      setBanner('warning', `Résultat partiel : ${parsed.errors.join(' ')}`);
      showToast('Résultat partiel affiché.', 'info');
    } else {
      setBanner('success', 'Traitement terminé avec succès.');
    }

    const result = {
      originalText: text,
      correctedText: parsed.corrected_text || text,
      corrections: parsed.corrections,
      reformulations: parsed.reformulations,
      action: state.selectedAction,
      tone: state.selectedTone,
      at: new Date().toISOString(),
    };

    state.lastResult = result;
    renderResult(result);
    pushHistory(result);
  } catch (err) {
    if (err.body && detectModelMissing(err.body)) {
      err.type = 'model_missing';
    }
    handleError(err);
  } finally {
    setLoading(false);
  }
}

function renderResult(result) {
  dom.emptyState.hidden = true;
  dom.resultCard.hidden = false;

  dom.resultMeta.textContent = `${labelAction(result.action)} · ${result.tone}`;
  dom.originalTextBlock.textContent = result.originalText;
  dom.correctedTextBlock.textContent = result.correctedText;

  dom.correctedSection.hidden = result.action === 'reecrire' && !result.correctedText;

  renderCorrections(result.corrections);
  renderReformulations(result.reformulations);
}

function renderCorrections(corrections) {
  dom.correctionsList.innerHTML = '';
  if (!corrections.length) {
    dom.correctionsList.innerHTML = '<div class="screen-note">Aucune correction listée.</div>';
    return;
  }

  corrections.forEach((item) => {
    const node = document.createElement('div');
    node.className = 'correction-item';
    node.innerHTML = `
      <div><span class="correction-before">${escapeHtml(item.before)}</span> → <span class="correction-after">${escapeHtml(item.after)}</span></div>
      <div class="correction-reason">${escapeHtml(item.reason || 'Sans détail')}</div>
    `;
    dom.correctionsList.appendChild(node);
  });
}

function renderReformulations(refoList) {
  dom.refoList.innerHTML = '';
  dom.reformulationsSection.hidden = !refoList.length;

  refoList.forEach((txt, idx) => {
    const item = document.createElement('div');
    item.className = 'refo-item';
    item.innerHTML = `
      <div class="refo-title">Proposition ${idx + 1}</div>
      <div class="refo-text">${escapeHtml(txt)}</div>
      <div class="result-inline-actions">
        <button class="btn btn-light js-copy">📋 Copier</button>
        <button class="btn btn-light js-reuse">↩ Réutiliser ce texte</button>
      </div>
    `;
    item.querySelector('.js-copy').addEventListener('click', () => copyText(txt));
    item.querySelector('.js-reuse').addEventListener('click', () => putInInput(txt));
    dom.refoList.appendChild(item);
  });
}

function labelAction(action) {
  const map = {
    corriger: 'Corriger',
    corriger_reformuler: 'Corriger + reformuler',
    reecrire: 'Réécrire',
  };
  return map[action] || action;
}

function pushHistory(result) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: result.at,
    action: result.action,
    tone: result.tone,
    preview: result.originalText.slice(0, 90),
    mainResult: (result.correctedText || result.reformulations[0] || '').slice(0, 120),
    payload: result,
  };

  state.history.unshift(entry);
  if (state.history.length > MAX_HISTORY) state.history = state.history.slice(0, MAX_HISTORY);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  dom.historyList.innerHTML = '';

  if (!state.history.length) {
    dom.historyList.innerHTML = '<div class="screen-note">Aucune entrée pour le moment.</div>';
    return;
  }

  state.history.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const d = new Date(entry.at);
    const stamp = Number.isNaN(d.getTime()) ? entry.at : d.toLocaleString();

    item.innerHTML = `
      <div class="history-main">
        <div class="history-title">${escapeHtml(labelAction(entry.action))} · ${escapeHtml(entry.tone)}</div>
        <div class="history-meta">${escapeHtml(stamp)} · ${escapeHtml(entry.preview)}</div>
        <div class="history-result">${escapeHtml(entry.mainResult)}</div>
      </div>
      <button class="history-remove">Supprimer</button>
    `;

    item.querySelector('.history-main').addEventListener('click', () => {
      state.lastResult = entry.payload;
      renderResult(entry.payload);
      putInInput(entry.payload.originalText, false);
      showToast('Entrée d\'historique rechargée.', 'info');
    });

    item.querySelector('.history-remove').addEventListener('click', () => {
      state.history = state.history.filter((x) => x.id !== entry.id);
      saveHistory();
      renderHistory();
      showToast('Entrée supprimée.', 'info');
    });

    dom.historyList.appendChild(item);
  });
}

function saveHistory() {
  localStorage.setItem('orthofix_v2_history', JSON.stringify(state.history));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem('orthofix_v2_history');
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) {
      state.history = parsed.slice(0, MAX_HISTORY);
    }
  } catch {
    state.history = [];
  }
}

function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
  showToast('Historique vidé.', 'info');
}

function clearOutput() {
  state.lastResult = null;
  dom.resultCard.hidden = true;
  dom.emptyState.hidden = false;
  setBanner('info', 'Affichage réinitialisé.');
}

async function testOllamaConnection() {
  const baseUrl = normalizeBaseUrl(dom.ollamaUrl.value);
  if (!baseUrl) return showToast('URL Ollama manquante.', 'error');

  setBanner('info', 'Test de connexion en cours…');

  try {
    const data = await fetchJson(`${baseUrl}/api/tags`, { method: 'GET' }, 10000);
    const count = Array.isArray(data.models) ? data.models.length : 0;
    setBanner('success', `Connexion OK. ${count} modèle(s) disponible(s).`);
    showToast('Connexion Ollama OK.', 'success');
  } catch (err) {
    handleError(err);
  }
}

async function showModels() {
  const baseUrl = normalizeBaseUrl(dom.ollamaUrl.value);
  const expectedModel = dom.ollamaModel.value.trim();

  if (!baseUrl) return showToast('URL Ollama manquante.', 'error');

  dom.modelsList.innerHTML = '';
  dom.modelsPanel.hidden = false;

  try {
    const data = await fetchJson(`${baseUrl}/api/tags`, { method: 'GET' }, 10000);
    const models = Array.isArray(data.models) ? data.models.map((m) => m.name).filter(Boolean) : [];

    if (!models.length) {
      dom.modelsList.innerHTML = '<li>Aucun modèle installé.</li>';
      setBanner('warning', 'Aucun modèle détecté sur Ollama.');
      return;
    }

    models.forEach((modelName) => {
      const li = document.createElement('li');
      li.textContent = modelName;
      if (expectedModel && modelName === expectedModel) {
        li.style.fontWeight = '800';
        li.textContent += ' (sélectionné)';
      }
      dom.modelsList.appendChild(li);
    });

    if (expectedModel && !models.includes(expectedModel)) {
      setBanner('warning', `Le modèle "${expectedModel}" n'existe pas dans la liste.`);
    } else {
      setBanner('success', `${models.length} modèle(s) récupéré(s).`);
    }
  } catch (err) {
    dom.modelsList.innerHTML = '<li>Impossible de charger les modèles.</li>';
    handleError(err);
  }
}

function fillExample() {
  const example = 'bonjour je suis tres content de vous ecrire aujourd hui car jai besoin daide pour corriger ce texte';
  putInInput(example);
  showToast('Exemple inséré.', 'info');
}

function putInInput(text, focus = true) {
  dom.inputText.value = text;
  updateCount();
  if (focus) dom.inputText.focus();
}

function setLoading(flag) {
  state.isLoading = flag;
  dom.runBtn.disabled = flag;
  dom.testConnBtn.disabled = flag;
  dom.listModelsBtn.disabled = flag;
  dom.runIcon.className = flag ? 'spinner-accent spinner' : '';
  dom.runIcon.textContent = flag ? '' : '🚀';
  if (flag) dom.runLabel.textContent = 'Traitement…';
  else updateRunButtonLabel();
}

async function copyText(text) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  showToast('Texte copié.', 'success');
}

function showToast(message, kind = 'info') {
  dom.toast.className = `toast ${kind}`;
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2600);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
