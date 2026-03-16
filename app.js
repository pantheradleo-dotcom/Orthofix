import { MODES, TONES, INTENSITIES, QUICK_PROFILES, buildPrompt } from './prompts.js';
import { loadSettings, saveSettings, loadHistory, saveHistory } from './storage.js';
import { listModels, runGeneration, verifyModel } from './ai.js';
import { renderChipGroup, setStatus, showToast, renderModels, renderHistory, escapeHtml } from './ui.js';

const MAX_HISTORY = 30;

const dom = {
  profiles: document.getElementById('profiles'),
  modeGroup: document.getElementById('modeGroup'),
  toneGroup: document.getElementById('toneGroup'),
  intensityGroup: document.getElementById('intensityGroup'),
  inputText: document.getElementById('inputText'),
  charCount: document.getElementById('charCount'),
  variantCount: document.getElementById('variantCount'),
  ollamaUrl: document.getElementById('ollamaUrl'),
  defaultModel: document.getElementById('defaultModel'),
  statusBanner: document.getElementById('statusBanner'),
  modelsPanel: document.getElementById('modelsPanel'),
  modelsList: document.getElementById('modelsList'),
  syncModelBtn: document.getElementById('syncModelBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  refreshModelsBtn: document.getElementById('refreshModelsBtn'),
  runBtn: document.getElementById('runBtn'),
  saveDefaultsBtn: document.getElementById('saveDefaultsBtn'),
  clearViewBtn: document.getElementById('clearViewBtn'),
  resultCard: document.getElementById('resultCard'),
  resultMeta: document.getElementById('resultMeta'),
  correctedText: document.getElementById('correctedText'),
  variantsList: document.getElementById('variantsList'),
  variantsBlock: document.getElementById('variantsBlock'),
  copyCorrectedBtn: document.getElementById('copyCorrectedBtn'),
  reuseCorrectedBtn: document.getElementById('reuseCorrectedBtn'),
  replaceSourceBtn: document.getElementById('replaceSourceBtn'),
  favCorrectedBtn: document.getElementById('favCorrectedBtn'),
  exportTxtBtn: document.getElementById('exportTxtBtn'),
  exportMdBtn: document.getElementById('exportMdBtn'),
  historyList: document.getElementById('historyList'),
  historyFilter: document.getElementById('historyFilter'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  comparePanel: document.getElementById('comparePanel'),
  compareSource: document.getElementById('compareSource'),
  compareTarget: document.getElementById('compareTarget'),
  closeCompareBtn: document.getElementById('closeCompareBtn'),
  toast: document.getElementById('toast'),
  focusModeBtn: document.getElementById('focusModeBtn'),
  editorHeight: document.getElementById('editorHeight'),
};

const state = {
  settings: loadSettings(),
  history: loadHistory(),
  selectedModelFromList: '',
  selectedMode: 'correction',
  selectedTone: 'neutre',
  selectedIntensity: 'moyen',
  lastResult: null,
  isLoading: false,
};

init();

function init() {
  hydrateFromSettings();
  bindEvents();
  renderControls();
  refreshHistory();
  updateCount();
}

function hydrateFromSettings() {
  dom.ollamaUrl.value = state.settings.ollamaUrl;
  dom.defaultModel.value = state.settings.model;
  dom.variantCount.value = String(state.settings.variants);
  state.selectedMode = state.settings.mode;
  state.selectedTone = state.settings.tone;
  state.selectedIntensity = state.settings.intensity;
  dom.editorHeight.value = 280;
  dom.inputText.style.minHeight = `${dom.editorHeight.value}px`;
}

function bindEvents() {
  dom.runBtn.addEventListener('click', run);
  dom.testConnectionBtn.addEventListener('click', onTestConnection);
  dom.refreshModelsBtn.addEventListener('click', onRefreshModels);
  dom.syncModelBtn.addEventListener('click', () => {
    if (state.selectedModelFromList) dom.defaultModel.value = state.selectedModelFromList;
  });
  dom.saveDefaultsBtn.addEventListener('click', persistDefaults);
  dom.clearViewBtn.addEventListener('click', clearView);
  dom.clearHistoryBtn.addEventListener('click', clearHistory);
  dom.historyFilter.addEventListener('change', refreshHistory);
  dom.closeCompareBtn.addEventListener('click', () => { dom.comparePanel.hidden = true; });
  dom.inputText.addEventListener('input', updateCount);
  dom.editorHeight.addEventListener('input', () => {
    dom.inputText.style.minHeight = `${dom.editorHeight.value}px`;
  });
  dom.focusModeBtn.addEventListener('click', () => document.body.classList.toggle('focus-mode'));

  dom.copyCorrectedBtn.addEventListener('click', () => copyText(state.lastResult?.correctedText || ''));
  dom.reuseCorrectedBtn.addEventListener('click', () => placeSource(state.lastResult?.correctedText || ''));
  dom.replaceSourceBtn.addEventListener('click', () => {
    if (!state.lastResult?.correctedText) return;
    dom.inputText.value = state.lastResult.correctedText;
    updateCount();
  });
  dom.favCorrectedBtn.addEventListener('click', toggleLastAsFavorite);
  dom.exportTxtBtn.addEventListener('click', () => exportResult('txt'));
  dom.exportMdBtn.addEventListener('click', () => exportResult('md'));
}

function renderControls() {
  renderChipGroup(dom.modeGroup, MODES, state.selectedMode, (value) => {
    state.selectedMode = value;
    renderControls();
  });

  renderChipGroup(dom.toneGroup, TONES, state.selectedTone, (value) => {
    state.selectedTone = value;
    renderControls();
  });

  renderChipGroup(dom.intensityGroup, INTENSITIES, state.selectedIntensity, (value) => {
    state.selectedIntensity = value;
    renderControls();
  });

  renderChipGroup(dom.profiles, QUICK_PROFILES.map((p) => ({ key: p.id, label: p.label })), '', (id) => {
    const profile = QUICK_PROFILES.find((p) => p.id === id);
    if (!profile) return;
    state.selectedMode = profile.mode;
    state.selectedTone = profile.tone;
    state.selectedIntensity = profile.intensity;
    dom.variantCount.value = String(profile.variants);
    renderControls();
    showToast(dom.toast, `Profil appliqué: ${profile.label}`, 'info');
  });
}

async function onTestConnection() {
  try {
    const models = await listModels(dom.ollamaUrl.value);
    setStatus(dom.statusBanner, 'success', `Connexion OK · ${models.length} modèle(s)`);
  } catch (err) {
    setStatus(dom.statusBanner, 'error', err.message);
  }
}

async function onRefreshModels() {
  dom.modelsPanel.hidden = false;
  try {
    const models = await listModels(dom.ollamaUrl.value);
    renderModels(dom.modelsList, models, dom.defaultModel.value.trim(), (name) => {
      state.selectedModelFromList = name;
      dom.defaultModel.value = name;
      renderModels(dom.modelsList, models, name, (x) => {
        state.selectedModelFromList = x;
        dom.defaultModel.value = x;
      });
    });

    const chosen = dom.defaultModel.value.trim();
    if (chosen && !models.includes(chosen)) {
      setStatus(dom.statusBanner, 'warning', `Le modèle "${chosen}" n'est pas installé.`);
    } else {
      setStatus(dom.statusBanner, 'success', 'Liste des modèles mise à jour.');
    }
  } catch (err) {
    setStatus(dom.statusBanner, 'error', err.message);
  }
}

function persistDefaults() {
  state.settings = {
    ollamaUrl: dom.ollamaUrl.value.trim(),
    model: dom.defaultModel.value.trim(),
    mode: state.selectedMode,
    tone: state.selectedTone,
    intensity: state.selectedIntensity,
    variants: Number(dom.variantCount.value),
  };
  saveSettings(state.settings);
  showToast(dom.toast, 'Paramètres enregistrés localement.', 'success');
}

async function run() {
  if (state.isLoading) return;
  const source = dom.inputText.value.trim();
  if (!source) {
    showToast(dom.toast, 'Texte source requis.', 'error');
    return;
  }

  const config = {
    baseUrl: dom.ollamaUrl.value.trim(),
    model: dom.defaultModel.value.trim(),
    mode: state.selectedMode,
    tone: state.selectedTone,
    intensity: state.selectedIntensity,
    variants: Number(dom.variantCount.value),
  };

  if (!config.baseUrl || !config.model) {
    showToast(dom.toast, 'URL Ollama et modèle sont obligatoires.', 'error');
    return;
  }

  state.isLoading = true;
  dom.runBtn.disabled = true;
  setStatus(dom.statusBanner, 'info', 'Traitement en cours...');

  try {
    const modelCheck = await verifyModel(config.baseUrl, config.model);
    if (!modelCheck.exists) {
      setStatus(dom.statusBanner, 'warning', `Modèle absent: ${config.model}`);
      throw new Error('Le modèle sélectionné n\'est pas installé.');
    }

    const prompt = buildPrompt({ text: source, ...config });
    const aiResult = await runGeneration({ baseUrl: config.baseUrl, model: config.model, prompt });

    const result = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      source,
      mode: config.mode,
      tone: config.tone,
      intensity: config.intensity,
      variantsCount: config.variants,
      correctedText: aiResult.correctedText || source,
      corrections: aiResult.corrections,
      reformulations: aiResult.reformulations,
      favorite: false,
    };

    state.lastResult = result;
    pushHistory(result);
    renderResult(result);
    setStatus(dom.statusBanner, 'success', 'Résultat prêt.');
  } catch (err) {
    setStatus(dom.statusBanner, 'error', err.message || 'Erreur inconnue');
  } finally {
    state.isLoading = false;
    dom.runBtn.disabled = false;
  }
}

function renderResult(result) {
  dom.resultCard.hidden = false;
  dom.resultMeta.textContent = `${result.mode} · ${result.tone} · ${result.intensity}`;
  dom.correctedText.textContent = result.correctedText;

  dom.variantsList.innerHTML = '';
  dom.variantsBlock.hidden = !result.reformulations.length;

  result.reformulations.forEach((variant, index) => {
    const card = document.createElement('article');
    card.className = 'variant-item';
    card.innerHTML = `
      <div class="variant-head">
        <span class="variant-label">${escapeHtml(variant.label || `Variante ${index + 1}`)}</span>
      </div>
      <div class="text-box">${escapeHtml(variant.text)}</div>
      <div class="row wrap">
        <button class="btn btn-tiny js-copy">Copier</button>
        <button class="btn btn-tiny js-reuse">Réutiliser</button>
        <button class="btn btn-tiny js-replace">Remplacer source</button>
        <button class="btn btn-tiny js-compare">Comparer</button>
      </div>
    `;
    card.querySelector('.js-copy').addEventListener('click', () => copyText(variant.text));
    card.querySelector('.js-reuse').addEventListener('click', () => placeSource(variant.text));
    card.querySelector('.js-replace').addEventListener('click', () => {
      dom.inputText.value = variant.text;
      updateCount();
    });
    card.querySelector('.js-compare').addEventListener('click', () => showCompare(result.source, variant.text));
    dom.variantsList.appendChild(card);
  });
}

function showCompare(source, target) {
  dom.compareSource.textContent = source;
  dom.compareTarget.textContent = target;
  dom.comparePanel.hidden = false;
}

function pushHistory(result) {
  state.history.unshift({
    id: result.id,
    at: result.at,
    mode: result.mode,
    favorite: result.favorite,
    preview: result.source.slice(0, 120),
    payload: result,
  });
  state.history = state.history.slice(0, MAX_HISTORY);
  saveHistory(state.history);
  refreshHistory();
}

function refreshHistory() {
  const filter = dom.historyFilter.value;
  const filtered = state.history.filter((item) => {
    if (filter === 'favorites') return item.favorite;
    if (filter === 'today') return new Date(item.at).toDateString() === new Date().toDateString();
    return true;
  });

  renderHistory(
    dom.historyList,
    filtered,
    (id) => openHistory(id),
    (id) => removeHistory(id),
    (id) => toggleFavorite(id),
  );
}

function openHistory(id) {
  const entry = state.history.find((x) => x.id === id);
  if (!entry) return;
  state.lastResult = entry.payload;
  dom.inputText.value = entry.payload.source;
  updateCount();
  renderResult(entry.payload);
}

function removeHistory(id) {
  state.history = state.history.filter((x) => x.id !== id);
  saveHistory(state.history);
  refreshHistory();
}

function toggleFavorite(id) {
  state.history = state.history.map((item) => {
    if (item.id !== id) return item;
    const updated = { ...item, favorite: !item.favorite, payload: { ...item.payload, favorite: !item.favorite } };
    if (state.lastResult?.id === id) state.lastResult = updated.payload;
    return updated;
  });
  saveHistory(state.history);
  refreshHistory();
}

function toggleLastAsFavorite() {
  if (!state.lastResult) return;
  toggleFavorite(state.lastResult.id);
  showToast(dom.toast, 'Favori mis à jour.', 'success');
}

function clearHistory() {
  state.history = [];
  saveHistory(state.history);
  refreshHistory();
}

function clearView() {
  state.lastResult = null;
  dom.resultCard.hidden = true;
  dom.comparePanel.hidden = true;
}

function updateCount() {
  const value = dom.inputText.value;
  const chars = value.length;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  dom.charCount.textContent = `${chars} caractère${chars > 1 ? 's' : ''} · ${words} mot${words > 1 ? 's' : ''}`;
}

function placeSource(text) {
  dom.inputText.value = text;
  updateCount();
  dom.inputText.focus();
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
  showToast(dom.toast, 'Texte copié.', 'success');
}

function exportResult(type) {
  if (!state.lastResult) return;
  const base = `orthofix-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const body = type === 'md'
    ? `# Résultat OrthoFix\n\n## Mode\n${state.lastResult.mode}\n\n## Texte\n${state.lastResult.correctedText}\n`
    : state.lastResult.correctedText;

  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}.${type}`;
  a.click();
  URL.revokeObjectURL(url);
}
