const STORAGE_KEY = "pixkeys";

// ===== STORAGE =====
function loadKeys() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveKeys(keys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

function deleteKey(id) {
  saveKeys(loadKeys().filter((k) => k.id !== id));
}

// ===== HELPERS =====
function getInitials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

const KEY_TYPE_LABELS = {
  cpf: "CPF", cnpj: "CNPJ", phone: "Telefone", email: "E-mail", random: "Aleatória",
};

// ===== RENDER =====
function renderKeys(keys) {
  const list  = document.getElementById("keys-list");
  const empty = document.getElementById("empty-state");
  list.innerHTML = "";

  if (keys.length === 0) {
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  keys.forEach((k) => {
    const item = document.createElement("div");
    item.className = "key-card";
    item.dataset.id = k.id;
    item.innerHTML = `
      <div class="key-card__avatar">${getInitials(k.name)}</div>
      <div class="key-card__info">
        <div class="key-card__name">${k.name}</div>
        <div class="key-card__meta">${k.bank} &bull; ${KEY_TYPE_LABELS[k.keyType] || k.keyType}</div>
        <div class="key-card__key">${k.key}</div>
      </div>
      <button class="key-card__delete" data-id="${k.id}" aria-label="Excluir chave">
        <span class="material-symbols-rounded">delete</span>
      </button>
    `;

    // clique no card (exceto no botão deletar) → set-value
    item.addEventListener("click", (e) => {
      if (e.target.closest(".key-card__delete")) return;
      const payload = { bank: k.bank, name: k.name, keyType: k.keyType, key: k.key };
      try { sessionStorage.setItem("pixkey_current_tx", JSON.stringify(payload)); } catch {}
      window.location.href = "set-value.html";
    });

    // botão de deletar
    item.querySelector(".key-card__delete").addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteDialog(k);
    });

    list.appendChild(item);
  });
}

function setupSearch() {
  const input = document.getElementById("search-input");
  input.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const all = loadKeys();
    renderKeys(q ? all.filter((k) =>
      k.name.toLowerCase().includes(q) ||
      k.bank.toLowerCase().includes(q) ||
      k.key.toLowerCase().includes(q)
    ) : all);
  });
}

// ===== DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO =====
let pendingDeleteKey = null;

function openDeleteDialog(key) {
  pendingDeleteKey = key;
  document.getElementById("delete-dialog-name").textContent = key.name;
  document.getElementById("delete-dialog-key").textContent  = key.key;
  document.getElementById("delete-scrim").classList.add("open");
}

function closeDeleteDialog() {
  document.getElementById("delete-scrim").classList.remove("open");
  pendingDeleteKey = null;
}

document.getElementById("delete-scrim").addEventListener("click", (e) => {
  if (e.target === document.getElementById("delete-scrim")) closeDeleteDialog();
});

document.getElementById("delete-cancel").addEventListener("click", closeDeleteDialog);

document.getElementById("delete-confirm").addEventListener("click", () => {
  if (!pendingDeleteKey) return;
  deleteKey(pendingDeleteKey.id);
  closeDeleteDialog();
  // Re-renderiza respeitando filtro de busca ativo
  const q = document.getElementById("search-input").value.toLowerCase().trim();
  const all = loadKeys();
  renderKeys(q ? all.filter((k) =>
    k.name.toLowerCase().includes(q) ||
    k.bank.toLowerCase().includes(q) ||
    k.key.toLowerCase().includes(q)
  ) : all);
});

// ===== BOTÕES =====
document.getElementById("btn-new-key").addEventListener("click", () => {
  window.location.href = "new-key.html";
});

document.getElementById("btn-settings").addEventListener("click", () => {
  window.location.href = "settings.html";
});

// ===== PWA INSTALL =====
let deferredPrompt = null;
const installBtn = document.getElementById("btn-install");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "inline-flex";
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") installBtn.style.display = "none";
  deferredPrompt = null;
});

window.addEventListener("appinstalled", () => {
  installBtn.style.display = "none";
  deferredPrompt = null;
});

// ===== SERVICE WORKER =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("SW erro:", err));
  });
}

(function init() {
  renderKeys(loadKeys());
  setupSearch();
})();
