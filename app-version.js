// ─────────────────────────────────────────────────────────────────
//  APP_VERSION — fonte única de verdade para a versão do QR PIX
//  ⚠️  Sempre que qualquer arquivo do projeto for modificado,
//      incremente este número ANTES de fazer o commit.
//      O Service Worker usa este valor como nome do cache:
//      um número diferente = novo cache = todos os clientes atualizam.
// ─────────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.55';
