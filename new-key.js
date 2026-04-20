// ===== BANCOS (sugestões) =====
const BANKS = [
  "Banco do Brasil", "Bradesco", "Caixa Econômica Federal", "Itaú",
  "Nubank", "Santander", "Inter", "C6 Bank", "Sicredi", "Sicoob",
  "BTG Pactual", "PicPay", "Mercado Pago", "Next", "Neon",
  "PagBank", "Original", "Safra", "XP Investimentos", "BS2",
];

// ===== ESTADO =====
let selectedType = null;
let keyIsValid = false;

const fieldBank    = document.getElementById("field-bank");
const fieldName    = document.getElementById("field-name");
const fieldKey     = document.getElementById("field-key");
const btnConfirm   = document.getElementById("btn-confirm");
const validIcon    = document.getElementById("key-validation-icon");
const validSymbol  = document.getElementById("key-validation-symbol");
const suggestions  = document.getElementById("bank-suggestions");

// ===== VALIDADORES E FORMATADORES =====

function onlyDigits(v) {
  return v.replace(/\D/g, "");
}

// CPF: 000.000.000-00
function formatCpf(raw) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + "." + d.slice(3);
  if (d.length <= 9) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6);
  return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
}

function validateCpf(value) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}

// CNPJ: 00.000.000/0000-00
function formatCnpj(raw) {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.slice(0,2) + "." + d.slice(2);
  if (d.length <= 8) return d.slice(0,2) + "." + d.slice(2,5) + "." + d.slice(5);
  if (d.length <= 12) return d.slice(0,2) + "." + d.slice(2,5) + "." + d.slice(5,8) + "/" + d.slice(8);
  return d.slice(0,2) + "." + d.slice(2,5) + "." + d.slice(5,8) + "/" + d.slice(8,12) + "-" + d.slice(12);
}

function validateCnpj(value) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)+$/.test(d)) return false;
  const calc = (d, n) => {
    let sum = 0, pos = n - 7;
    for (let i = n; i >= 1; i--) {
      sum += parseInt(d[n - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return calc(d, 12) === parseInt(d[12]) && calc(d, 13) === parseInt(d[13]);
}

// Telefone: +55 (00) 00000-0000
function formatPhone(raw) {
  let d = raw.replace(/\D/g, "");
  // aceita com ou sem 55
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return "(" + d;
  if (d.length <= 6) return "(" + d.slice(0,2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
  return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
}

function validatePhone(value) {
  const d = onlyDigits(value.replace(/^\+55/, ""));
  if (d.length < 10 || d.length > 11) return false;
  // celular: DDD + 9 dígitos começando com 9
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

// UUID v4 — chave aleatória Pix
function validateRandom(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

// ===== MAPA DE TIPO =====
const TYPE_CONFIG = {
  cpf:    { label: "CPF",            placeholder: "000.000.000-00",               inputMode: "numeric",  format: formatCpf,   validate: validateCpf },
  cnpj:   { label: "CNPJ",           placeholder: "00.000.000/0000-00",            inputMode: "numeric",  format: formatCnpj,  validate: validateCnpj },
  phone:  { label: "Telefone",        placeholder: "(00) 00000-0000",               inputMode: "tel",      format: formatPhone, validate: validatePhone },
  email:  { label: "E-mail",          placeholder: "nome@email.com",                inputMode: "email",    format: (v) => v,    validate: validateEmail },
  random: { label: "Chave aleatória", placeholder: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx", inputMode: "text", format: (v) => v, validate: validateRandom },
};

// ===== TIPO DE CHAVE =====
document.getElementById("key-type-group").querySelectorAll(".key-type-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".key-type-chip").forEach((c) => c.classList.remove("key-type-chip--active"));
    chip.classList.add("key-type-chip--active");
    selectedType = chip.dataset.type;

    const cfg = TYPE_CONFIG[selectedType];
    fieldKey.setAttribute("label", cfg.label);
    fieldKey.setAttribute("inputmode", cfg.inputMode);
    fieldKey.value = "";
    fieldKey.setAttribute("supporting-text", " ");
    fieldKey.removeAttribute("error");
    validIcon.style.display = "none";
    keyIsValid = false;
    updateConfirmBtn();
    // Pequeno delay para o Web Component atualizar antes do focus
    setTimeout(() => fieldKey.focus(), 50);
  });
});

// ===== VALIDAÇÃO DA CHAVE =====
function onKeyInput(e) {
  if (!selectedType) return;
  const cfg = TYPE_CONFIG[selectedType];

  // Formatar
  const formatted = cfg.format(e.target.value);
  if (formatted !== e.target.value) {
    e.target.value = formatted;
  }

  const val = e.target.value.trim();
  if (!val) {
    validIcon.style.display = "none";
    fieldKey.setAttribute("supporting-text", " ");
    fieldKey.removeAttribute("error");
    keyIsValid = false;
    updateConfirmBtn();
    return;
  }

  const valid = cfg.validate(val);
  keyIsValid = valid;
  validIcon.style.display = "block";
  validIcon.className = "key-validation-icon " + (valid ? "valid" : "invalid");
  validSymbol.textContent = valid ? "check_circle" : "cancel";

  if (valid) {
    fieldKey.removeAttribute("error");
    fieldKey.setAttribute("supporting-text", "Chave válida");
  } else {
    fieldKey.setAttribute("error", "");
    fieldKey.setAttribute("supporting-text", "Formato inválido");
  }

  updateConfirmBtn();
}

fieldKey.addEventListener("input", onKeyInput);

// ===== SUGESTÕES DE BANCO =====
fieldBank.addEventListener("input", (e) => {
  const query = e.target.value.trim().toLowerCase();
  if (!query) { suggestions.style.display = "none"; return; }

  const matches = BANKS.filter((b) => b.toLowerCase().includes(query)).slice(0, 6);
  if (!matches.length) { suggestions.style.display = "none"; return; }

  suggestions.innerHTML = matches.map((b) =>
    `<div class="bank-suggestion-item" data-bank="${b}">
      <span class="material-symbols-rounded">account_balance</span>${b}
    </div>`
  ).join("");
  suggestions.style.display = "block";
});

suggestions.addEventListener("click", (e) => {
  const item = e.target.closest(".bank-suggestion-item");
  if (!item) return;
  fieldBank.value = item.dataset.bank;
  suggestions.style.display = "none";
  updateConfirmBtn();
});

document.addEventListener("click", (e) => {
  if (!suggestions.contains(e.target) && e.target !== fieldBank) {
    suggestions.style.display = "none";
  }
});

// ===== BOTÃO CONFIRMAR =====
function updateConfirmBtn() {
  const bankOk = fieldBank.value.trim().length > 0;
  const nameOk = fieldName.value.trim().length > 0;
  const ready  = bankOk && nameOk && selectedType && keyIsValid;
  btnConfirm.disabled = !ready;
}

fieldBank.addEventListener("input", updateConfirmBtn);
fieldName.addEventListener("input", updateConfirmBtn);

// ===== NAVEGAÇÃO =====
document.getElementById("btn-back").addEventListener("click", () => history.back());

btnConfirm.addEventListener("click", () => {
  const bank    = fieldBank.value.trim();
  const name    = fieldName.value.trim();
  const key     = fieldKey.value.trim();

  // Salvar a chave no localStorage
  const STORAGE_KEY = "pixkeys";
  let keys = [];
  try { keys = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch {}
  const newKey = {
    id:      Date.now().toString(36) + Math.random().toString(36).slice(2),
    bank,
    name,
    keyType: selectedType,
    key,
  };
  keys.push(newKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));

  // Navegar para definir o valor
  const payload = { bank, name, keyType: selectedType, key };
  try { sessionStorage.setItem("pixkey_current_tx", JSON.stringify(payload)); } catch {}
  window.location.href = "set-value.html";
});
