/**
 * pix-payload.js
 * Gerador de payload Pix Copia e Cola (QR Code Estático)
 * Conforme Manual de Padrões para Iniciação do Pix v2.7.0 – Bacen
 *
 * Estrutura BR Code / EMV Merchant Presented QR Code:
 *   ID  | Campo                        | Obrig.
 *   00  | Payload Format Indicator     | Sim  → "01"
 *   26  | Merchant Account Information | Sim  → GUI + chave [+ infoAdicional]
 *   52  | Merchant Category Code       | Sim  → "0000"
 *   53  | Transaction Currency         | Sim  → "986" (BRL)
 *   54  | Transaction Amount           | Cond → presente quando valor > 0
 *   58  | Country Code                 | Sim  → "BR"
 *   59  | Merchant Name                | Sim  → nome do beneficiário (máx 25)
 *   60  | Merchant City                | Sim  → cidade (padrão "BRASILIA")
 *   62  | Additional Data Field        | Sim  → Reference Label (txid ou "***")
 *   63  | CRC16                        | Sim  → calculado sobre todo o payload
 */

// ===== CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) =====
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

// ===== HELPERS DE CAMPO EMV =====
function emvField(id, value) {
  const len = String(value.length).padStart(2, "0");
  return id + len + value;
}

// ===== FORMATAÇÃO DA CHAVE CONFORME DICT (Manual §2.5.1) =====
function formatPixKey(type, value) {
  const raw = value.trim();
  switch (type) {
    case "cpf":
      // somente dígitos, 11 chars
      return raw.replace(/\D/g, "");
    case "cnpj":
      // somente dígitos, 14 chars
      return raw.replace(/\D/g, "");
    case "phone": {
      // formato internacional: +5561912345678
      const digits = raw.replace(/\D/g, "");
      // já vem sem código de país (DDD + número = 10 ou 11 dígitos)
      return "+55" + digits;
    }
    case "email":
      return raw.toLowerCase();
    case "random":
      // UUID com pontuação: 123e4567-e12b-12d1-a456-426655440000
      return raw.toLowerCase();
    default:
      return raw;
  }
}

// ===== SANITIZAÇÃO DO NOME / CIDADE (apenas ASCII imprimível) =====
function sanitize(str, maxLen) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^A-Za-z0-9 ]/g, "")  // apenas alfanumérico e espaço
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

// ===== GERADOR PRINCIPAL =====
/**
 * @param {object} options
 * @param {string}  options.keyType    - "cpf"|"cnpj"|"phone"|"email"|"random"
 * @param {string}  options.key        - Valor da chave pix (com formatação do UI)
 * @param {string}  options.name       - Nome do beneficiário
 * @param {string}  options.city       - Cidade do beneficiário (padrão "BRASILIA")
 * @param {number}  [options.value]    - Valor em centavos (0 = sem valor fixo)
 * @param {string}  [options.txid]     - ID da transação (máx 25 chars, alfanum.)
 *                                       Se omitido, usa "***"
 * @param {string}  [options.description] - Informação adicional (opcional, máx 72)
 * @returns {string} Payload completo pronto para gerar QR Code
 */
function generatePixPayload(options) {
  const {
    keyType,
    key,
    name,
    city = "BRASILIA",
    value = 0,
    txid = "***",
    description = "",
  } = options;

  // --- Formatar chave conforme DICT ---
  const pixKey = formatPixKey(keyType, key);

  // --- Campo 26: Merchant Account Information ---
  // Sub-campo 00: GUI = "br.gov.bcb.pix" (14 chars, fixo)
  const gui = emvField("00", "br.gov.bcb.pix");
  // Sub-campo 01: chave pix
  const keyField = emvField("01", pixKey);
  // Sub-campo 02: infoAdicional (opcional)
  const infoField = description
    ? emvField("02", description.slice(0, 72))
    : "";
  const merchantAccountInfo = emvField("26", gui + keyField + infoField);

  // --- Campo 54: valor (apenas quando > 0) ---
  // Formato: até 13 dígitos com 2 casas decimais, sem separador de milhar
  // Regex pattern da spec: ^[0-9]{1,10}\.[0-9]{2}$
  let amountField = "";
  if (value > 0) {
    const intPart = Math.floor(value / 100);
    const decPart = String(value % 100).padStart(2, "0");
    amountField = emvField("54", intPart + "." + decPart);
  }

  // --- Campo 59: nome (máx 25) ---
  const merchantName = emvField("59", sanitize(name, 25));

  // --- Campo 60: cidade (máx 15) ---
  const merchantCity = emvField("60", sanitize(city, 15));

  // --- Campo 62: Additional Data Field ---
  // Sub-campo 05: Reference Label (txid) — máx 25 chars, alfanumérico
  const sanitizedTxid = txid === "***"
    ? "***"
    : txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const additionalData = emvField("62", emvField("05", sanitizedTxid));

  // --- Montar payload sem CRC ---
  const payloadWithoutCrc =
    emvField("00", "01") +          // Payload Format Indicator
    merchantAccountInfo +            // Merchant Account Information
    emvField("52", "0000") +        // Merchant Category Code
    emvField("53", "986") +         // Transaction Currency (BRL)
    amountField +                    // Transaction Amount (condicional)
    emvField("58", "BR") +          // Country Code
    merchantName +                   // Merchant Name
    merchantCity +                   // Merchant City
    additionalData +                 // Additional Data Field
    "6304";                          // ID e tamanho do CRC (sempre 4 chars)

  // --- Calcular e anexar CRC16 ---
  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}

/**
 * Valida o CRC16 de um payload Pix recebido.
 * @param {string} payload
 * @returns {boolean}
 */
function validatePixPayload(payload) {
  if (!payload || payload.length < 4) return false;
  const body = payload.slice(0, -4);
  const receivedCrc = payload.slice(-4).toUpperCase();
  return crc16(body + "6304") === receivedCrc;
}

// Exporta para uso como módulo ES ou como script global
if (typeof module !== "undefined") {
  module.exports = { generatePixPayload, validatePixPayload, crc16, formatPixKey };
} else {
  window.PixPayload = { generatePixPayload, validatePixPayload, crc16, formatPixKey };
}
