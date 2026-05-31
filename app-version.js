const APP_VERSION = '1.0.58';

// Histórico de versões (mais recente primeiro)
const VERSION_HISTORY = [
  { version: '1.0.58', date: '2026-05-31', desc: 'fix: sugestão banco acima do input + lista completa' },
  { version: '1.0.57', date: '2026-05-31', desc: 'feat: wizard create-profile (3 etapas)' },
  { version: '1.0.56', date: '2026-05-30', desc: 'chore: commit de teste' },
  { version: '1.0.55', date: '2026-05-29', desc: 'fix: applyTheme light usa setAttribute' }
];

if (typeof module !== 'undefined') module.exports = { APP_VERSION };
