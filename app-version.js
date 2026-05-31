const APP_VERSION = '1.0.62';

// Histórico de versões (mais recente primeiro)
const VERSION_HISTORY = [
  { version: '1.0.62', date: '2026-05-31', desc: 'fix: usar all.js no create-profile, corrige NotSupportedError md-focus-ring' },
  { version: '1.0.61', date: '2026-05-31', desc: 'fix: botões Anterior/Próximo mesma largura, sem seta no Anterior' },
  { version: '1.0.60', date: '2026-05-31', desc: 'fix: substituir button.icon-btn por md-icon-button no create-profile' },
  { version: '1.0.59', date: '2026-05-31', desc: 'feat: formatação automática + validação real + sugestões de email na chave PIX' },
  { version: '1.0.58', date: '2026-05-31', desc: 'fix: sugestão banco acima do input + lista completa' },
  { version: '1.0.57', date: '2026-05-31', desc: 'feat: wizard create-profile (3 etapas)' },
  { version: '1.0.56', date: '2026-05-30', desc: 'chore: commit de teste' },
  { version: '1.0.55', date: '2026-05-29', desc: 'fix: applyTheme light usa setAttribute' }
];

if (typeof module !== 'undefined') module.exports = { APP_VERSION };
