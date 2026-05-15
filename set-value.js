// ===== LÊ PARAMS DA URL (query string) + FALLBACK sessionStorage =====
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}
function readStoredTx() {
  try { return JSON.parse(sessionStorage.getItem("pixkey_current_tx") || "null") || {}; }
  catch { return {}; }
}

// Prioriza query string; cai para sessionStorage se não vier na URL
const qp      = new URLSearchParams(window.location.search);
const hasQp   = qp.has("key");
const stored  = hasQp ? {} : readStoredTx();

const txBank    = (hasQp ? qp.get("bank")    : stored.bank)    || "";
const txName    = (hasQp ? qp.get("name")    : stored.name)    || "";
const txKeyType = (hasQp ? qp.get("keyType") : stored.keyType) || "";
const txKey     = (hasQp ? qp.get("key")     : stored.key)     || "";

// Persiste no sessionStorage para compatibilidade com outros fluxos
try {
  sessionStorage.setItem("pixkey_current_tx", JSON.stringify({
    bank: txBank, name: txName, keyType: txKeyType, key: txKey,
  }));
} catch {}

// ===== PREENCHER CARD =====
document.getElementById("tc-bank").textContent = txBank;
document.getElementById("tc-name").textContent = txName;
document.getElementById("tc-key").textContent  = txKey;

// ===== VALOR =====
let digits = "";
const display = document.getElementById("value-display");

function formatValue(digits) {
  const padded = digits.padStart(3, "0");
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const decPart = padded.slice(-2);
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return intFormatted + "," + decPart;
}

function updateDisplay() {
  display.textContent = formatValue(digits);
  display.classList.toggle("nonzero", digits.length > 0 && parseInt(digits, 10) !== 0);
}

document.querySelectorAll(".numpad-key").forEach((key) => {
  key.addEventListener("click", () => {
    const k = key.dataset.key;
    if (k === "del") {
      digits = digits.slice(0, -1);
    } else if (k === "00") {
      if (digits.length === 0) return;
      digits = (digits + "00").slice(0, 10);
    } else {
      if (digits === "" && k === "0") return;
      digits = (digits + k).slice(0, 10);
    }
    updateDisplay();
  });
});

document.getElementById("btn-confirm").addEventListener("click", () => {
  const valueInCents = parseInt(digits || "0", 10);

  // Monta query string para a próxima tela
  const params = new URLSearchParams({
    bank:    txBank,
    name:    txName,
    keyType: txKeyType,
    key:     txKey,
    value:   String(valueInCents),
  });

  // Persiste também no sessionStorage (fallback offline / PWA)
  try {
    sessionStorage.setItem("pixkey_current_tx", JSON.stringify({
      bank: txBank, name: txName, keyType: txKeyType, key: txKey, value: valueInCents,
    }));
  } catch {}

  window.location.href = "generate-qr-pix.html?" + params.toString();
});

document.getElementById("btn-back").addEventListener("click", () => history.back());
updateDisplay();
