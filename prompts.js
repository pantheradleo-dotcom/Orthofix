export const MODES = [
  { key: 'correction', label: 'Correction' },
  { key: 'reformulation', label: 'Reformulation' },
  { key: 'rewrite', label: 'Réécriture' },
  { key: 'simplification', label: 'Simplification' },
  { key: 'professional', label: 'Professionnel' },
  { key: 'administrative', label: 'Administratif' },
  { key: 'email', label: 'Email' },
  { key: 'report', label: 'Compte rendu' },
];

export const TONES = ['neutre', 'formel', 'professionnel', 'dynamique', 'bienveillant', 'clair'];
export const INTENSITIES = ['léger', 'moyen', 'fort'];

export const QUICK_PROFILES = [
  { id: 'quick_fix', label: 'Correction rapide', mode: 'correction', tone: 'neutre', intensity: 'léger', variants: 1 },
  { id: 'pro_mail', label: 'Mail professionnel', mode: 'email', tone: 'professionnel', intensity: 'moyen', variants: 2 },
  { id: 'simple_rewrite', label: 'Reformulation simple', mode: 'reformulation', tone: 'clair', intensity: 'moyen', variants: 2 },
  { id: 'admin_style', label: 'Style administratif', mode: 'administrative', tone: 'formel', intensity: 'fort', variants: 2 },
  { id: 'clear_text', label: 'Texte plus clair', mode: 'simplification', tone: 'clair', intensity: 'moyen', variants: 3 },
];

function modeInstruction(mode) {
  const map = {
    correction: 'Corrige l’orthographe, la grammaire et la ponctuation en conservant strictement le sens.',
    reformulation: 'Améliore la fluidité et la clarté avec plusieurs reformulations fidèles.',
    rewrite: 'Réécris le texte pour améliorer style et structure tout en gardant l’intention.',
    simplification: 'Simplifie le texte pour le rendre plus accessible et lisible.',
    professional: 'Produis une version professionnelle claire, structurée et crédible.',
    administrative: 'Adopte un style administratif précis, formel et rigoureux.',
    email: 'Transforme le texte en email prêt à envoyer avec objet implicite et formulation adaptée.',
    report: 'Réécris sous forme de compte rendu synthétique et structuré.',
  };
  return map[mode] || map.correction;
}

function intensityInstruction(intensity) {
  const map = {
    'léger': 'Modifie le moins possible : corrections minimales et structure d’origine prioritaire.',
    moyen: 'Améliore nettement le texte sans trahir le sens initial.',
    fort: 'Autorise une reformulation plus libre tout en gardant l’intention et les faits.',
  };
  return map[intensity] || map.moyen;
}

export function buildPrompt({ text, mode, tone, intensity, variants }) {
  return `Tu es OrthoFix V3, assistant rédactionnel local. Réponds uniquement en JSON valide.

Contraintes métier :
- Mode: ${modeInstruction(mode)}
- Tonalité: ${tone}
- Intensité: ${intensityInstruction(intensity)}
- Générer ${variants} variante(s) si pertinent.
- Chaque variante doit avoir un label court parmi des formulations lisibles (ex: Plus naturel, Plus fluide, Plus concis, Plus formel, Plus professionnel).
- Aucune invention factuelle.

Format de sortie strict:
{
  "corrected_text": "...",
  "corrections": [
    { "before": "...", "after": "...", "reason": "..." }
  ],
  "reformulations": [
    { "label": "Plus fluide", "text": "..." }
  ]
}

Texte source:
"""
${text}
"""`;
}
