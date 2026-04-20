const TEMA_LABELS = { light: "Claro", dark: "Escuro", system: "Sistema" };
const EYECARE_LABELS = { off: "Desativado", on: "Ativado", night: "Somente à noite" };
const BACKUP_STORAGE_KEYS = {
  keys: "pixkeys",
  settings: "pixkey_settings",
  qrSettings: "pixkey_qr_settings",
};

function setSubtitle(id, map, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = map[value] ?? value;
}

function setupAccordion(triggerId, panelId, chevronId) {
  const trigger = document.getElementById(triggerId);
  const panel = document.getElementById(panelId);
  const chevron = document.getElementById(chevronId);
  if (!trigger || !panel) return;

  const allPanels = Array.from(document.querySelectorAll('.settings-expand-panel'));

  trigger.addEventListener("click", () => {
    const opening = !panel.classList.contains("open");

    allPanels.forEach((p) => {
      const isCurrent = p === panel;
      p.classList.toggle("open", opening && isCurrent);
      p.setAttribute("aria-hidden", String(!(opening && isCurrent)));
    });

    document.querySelectorAll('.settings-item__chevron[id$="-chevron"]').forEach((icon) => {
      icon.classList.remove("rotated");
    });

    if (chevron && opening) chevron.classList.add("rotated");
  });
}

function setupRadioGroup(groupName, subtitleId, labelMap, keyName) {
  document.querySelectorAll(`label.radio-option`).forEach((label) => {
    const radio = label.querySelector(`md-radio[name="${groupName}"]`);
    if (!radio) return;

    label.addEventListener("click", (e) => {
      e.preventDefault();
      const value = radio.value;
      document.querySelectorAll(`md-radio[name="${groupName}"]`).forEach((r) => {
        r.checked = r === radio;
      });
      setSubtitle(subtitleId, labelMap, value);
      window.PixKeyUI.updateSettings({ [keyName]: value });
    });
  });
}

function setupNavItems() {
  document.querySelectorAll(".settings-item--nav[data-href]").forEach((item) => {
    item.addEventListener("click", () => {
      window.location.href = item.dataset.href;
    });
  });

  document.getElementById("item-qr")?.addEventListener("click", () => {
    window.location.href = "qr-customize.html";
  });

  document.getElementById("item-donate-dev")?.addEventListener("click", () => {
    const params = new URLSearchParams({
      bank: "Mercado Pago",
      name: "Victor Alerrandro Tavares",
      keyType: "email",
      key: "v.alerrandro.t@hotmail.com",
      value: "0",
    });
    window.location.href = `generate-qr-pix.html?${params.toString()}`;
  });
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function createBackupPayload() {
  return {
    format: "pixkey-backup",
    version: 37,
    exportedAt: new Date().toISOString(),
    data: {
      settings: readJsonStorage(BACKUP_STORAGE_KEYS.settings, {}),
      qrSettings: readJsonStorage(BACKUP_STORAGE_KEYS.qrSettings, null),
      keys: readJsonStorage(BACKUP_STORAGE_KEYS.keys, []),
    },
  };
}

function downloadBackup() {
  const payload = createBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `pixkey-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeImportedBackup(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error("Arquivo inválido");
  const data = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  return {
    settings: data.settings && typeof data.settings === "object" ? data.settings : {},
    qrSettings: data.qrSettings && typeof data.qrSettings === "object" ? data.qrSettings : null,
    keys: Array.isArray(data.keys) ? data.keys : [],
  };
}

function refreshSettingsUi(settings) {
  const merged = {
    tema: settings.tema ?? "system",
    eyecare: settings.eyecare ?? "off",
  };
  setSubtitle("tema-subtitle", TEMA_LABELS, merged.tema);
  setSubtitle("eyecare-subtitle", EYECARE_LABELS, merged.eyecare);
  customElements.whenDefined("md-radio").then(() => {
    const temaRadio = document.querySelector(`md-radio[name="tema"][value="${merged.tema}"]`);
    const eyecareRadio = document.querySelector(`md-radio[name="eyecare"][value="${merged.eyecare}"]`);
    document.querySelectorAll('md-radio[name="tema"]').forEach((r) => (r.checked = false));
    document.querySelectorAll('md-radio[name="eyecare"]').forEach((r) => (r.checked = false));
    if (temaRadio) temaRadio.checked = true;
    if (eyecareRadio) eyecareRadio.checked = true;
  });
}

async function importBackupFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const backup = normalizeImportedBackup(parsed);

  localStorage.setItem(BACKUP_STORAGE_KEYS.keys, JSON.stringify(backup.keys));
  localStorage.setItem(BACKUP_STORAGE_KEYS.settings, JSON.stringify(backup.settings));
  if (backup.qrSettings) {
    localStorage.setItem(BACKUP_STORAGE_KEYS.qrSettings, JSON.stringify(backup.qrSettings));
  } else {
    localStorage.removeItem(BACKUP_STORAGE_KEYS.qrSettings);
  }

  const applied = {
    tema: backup.settings.tema ?? "system",
    eyecare: backup.settings.eyecare ?? "off",
  };

  if (window.PixKeyTheme) {
    window.PixKeyTheme.applyTheme(applied.tema);
    window.PixKeyTheme.applyEyeCare(applied.eyecare);
  }
  refreshSettingsUi(applied);
  window.dispatchEvent(new CustomEvent("pixkey:settings-imported", { detail: applied }));
  return backup;
}

function setupBackupActions() {
  const exportItem = document.getElementById("item-export-backup");
  const importItem = document.getElementById("item-import-backup");
  const fileInput = document.getElementById("backup-file-input");
  if (!exportItem || !importItem || !fileInput) return;

  exportItem.addEventListener("click", downloadBackup);
  importItem.addEventListener("click", () => fileInput.click());

  [exportItem, importItem].forEach((el, index) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (index === 0) downloadBackup();
        else fileInput.click();
      }
    });
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importBackupFile(file);
      alert("Backup importado com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível importar o backup. Verifique se o arquivo JSON é válido.");
    } finally {
      fileInput.value = "";
    }
  });
}

document.getElementById("btn-back")?.addEventListener("click", () => {
  history.back();
});

(function init() {
  const settings = window.PixKeyUI.loadSettings();
  refreshSettingsUi({
    tema: settings.tema ?? "system",
    eyecare: settings.eyecare ?? "off",
  });

  setupAccordion("item-tema", "panel-tema", "tema-chevron");
  setupAccordion("item-eyecare", "panel-eyecare", "eyecare-chevron");
  setupRadioGroup("tema", "tema-subtitle", TEMA_LABELS, "tema");
  setupRadioGroup("eyecare", "eyecare-subtitle", EYECARE_LABELS, "eyecare");
  setupNavItems();
  setupBackupActions();
})();
