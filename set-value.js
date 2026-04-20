// ===== PARAMS DA URL + FALLBACK =====
function readStoredTx() {
  try { return JSON.parse(sessionStorage.getItem("pixkey_current_tx") || "null") || {}; }
  catch { return {}; }
}

const storedTx = readStoredTx();
const txBank    = storedTx.bank    || "";
const txName    = storedTx.name    || "";
const txKeyType = storedTx.keyType || "";
const txKey     = storedTx.key     || "";

try {
  sessionStorage.setItem("pixkey_current_tx", JSON.stringify({
    bank: txBank,
    name: txName,
    keyType: txKeyType,
    key: txKey,
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
  const payload = {
    bank: txBank,
    name: txName,
    keyType: txKeyType,
    key: txKey,
    value: valueInCents,
  };
  try { sessionStorage.setItem("pixkey_current_tx", JSON.stringify(payload)); } catch {}
  window.location.href = "generate-qr-pix.html";
});

document.getElementById("btn-back").addEventListener("click", () => history.back());
updateDisplay();
