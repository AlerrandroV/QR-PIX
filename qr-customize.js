// ===== ESTADO =====
const QR_SETTINGS_KEY = "pixkey_qr_settings";

const defaultQrOptions = {
  dotsType: "square",
  dotsColor: "#000000",
  cornerSqType: "",
  cornerSqColor: "#000000",
  cornerDotType: "",
  cornerDotColor: "#000000",
  bgColor: "#ffffff",
  logoSize: 0.3,
  logoMargin: 5,
  margin: 10,
  logoDataUrl: null,
  eccLevel: 0,
};

let savedOptions = loadQrSettings();
let currentOptions = { ...savedOptions };
let isDirty = false;
let pendingNavTarget = null;

function loadQrSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(QR_SETTINGS_KEY));
    return stored ? { ...defaultQrOptions, ...stored } : { ...defaultQrOptions };
  } catch {
    return { ...defaultQrOptions };
  }
}

function saveQrSettings(opts) {
  // logoDataUrl pode ser grande; clonar sem ela para medir, mas salvar com
  localStorage.setItem(QR_SETTINGS_KEY, JSON.stringify(opts));
}

function markDirty() { isDirty = true; }
function markClean() { isDirty = false; savedOptions = { ...currentOptions }; }


const ECC_LEVELS = ["L", "M", "Q", "H"];
const ECC_DESCS = [
  "Baixa — 7% de recuperação",
  "Média — 15% de recuperação",
  "Quartil — 25% de recuperação",
  "Alta — 30% de recuperação",
];

// ===== QR CODE (SVG) =====
const qrCode = new QRCodeStyling({
  width: 200,
  height: 200,
  type: "svg",
  data: "QrCode PIX",
  qrOptions: { errorCorrectionLevel: ECC_LEVELS[currentOptions.eccLevel] },
  margin: currentOptions.margin,
  dotsOptions: {
    type: currentOptions.dotsType,
    color: currentOptions.dotsColor,
  },
  cornersSquareOptions: {
    type: currentOptions.cornerSqType || undefined,
    color: currentOptions.cornerSqColor,
  },
  cornersDotOptions: {
    type: currentOptions.cornerDotType || undefined,
    color: currentOptions.cornerDotColor,
  },
  backgroundOptions: {
    color: currentOptions.bgColor,
  },
  image: currentOptions.logoDataUrl || undefined,
  imageOptions: {
    crossOrigin: "anonymous",
    imageSize: currentOptions.logoSize,
    margin: currentOptions.logoMargin,
    hideBackgroundDots: true,
  },
});

qrCode.append(document.getElementById("qr-canvas"));

function updateQr() {
  qrCode.update({
    type: "svg",
    data: "QrCode PIX",
    qrOptions: { errorCorrectionLevel: ECC_LEVELS[currentOptions.eccLevel] },
    margin: currentOptions.margin,
    dotsOptions: {
      type: currentOptions.dotsType,
      color: currentOptions.dotsColor,
    },
    cornersSquareOptions: {
      type: currentOptions.cornerSqType || undefined,
      color: currentOptions.cornerSqColor,
    },
    cornersDotOptions: {
      type: currentOptions.cornerDotType || undefined,
      color: currentOptions.cornerDotColor,
    },
    backgroundOptions: {
      color: currentOptions.bgColor,
    },
    image: currentOptions.logoDataUrl || undefined,
    imageOptions: {
      crossOrigin: "anonymous",
      imageSize: currentOptions.logoSize,
      margin: currentOptions.logoMargin,
      hideBackgroundDots: true,
    },
  });
}

// ===== DIALOG =====
const scrim = document.getElementById("dialog-scrim");

function openDialog() {
  scrim.classList.add("open");
  scrim.setAttribute("aria-hidden", "false");
}

function closeDialog() {
  scrim.classList.remove("open");
  scrim.setAttribute("aria-hidden", "true");
}

// Fechar ao clicar no scrim (fora do container)
scrim.addEventListener("click", (e) => {
  if (e.target === scrim) closeDialog();
});

document.getElementById("dialog-discard").addEventListener("click", () => {
  closeDialog();
  if (pendingNavTarget) window.location.replace(pendingNavTarget);
});

document.getElementById("dialog-save-exit").addEventListener("click", () => {
  doSave();
  closeDialog();
  if (pendingNavTarget) window.location.replace(pendingNavTarget);
});

// ===== NAVEGAÇÃO SEGURA =====
function tryNavigate(target) {
  if (isDirty) {
    pendingNavTarget = target;
    openDialog();
  } else {
    history.back();
  }
}

document.getElementById("btn-back").addEventListener("click", () => {
  if (isDirty) {
    pendingNavTarget = "settings.html";
    openDialog();
  } else {
    // Volta pelo histórico real, sem criar entrada fantasma
    history.back();
  }
});

// Marca o estado atual como "qr-customize" sem empilhar nada extra
history.replaceState({ page: "qr-customize" }, "");

window.addEventListener("popstate", (e) => {
  // O usuário acionou o botão físico/gesto de voltar
  if (isDirty) {
    // Reempurra para impedir a navegação enquanto o dialog está aberto
    history.pushState({ page: "qr-customize" }, "");
    pendingNavTarget = "settings.html";
    openDialog();
  }
  // Se não há alterações, a navegação natural do browser segue sem intervenção
});

// ===== SALVAR =====
function doSave() {
  saveQrSettings(currentOptions);
  markClean();
}

document.getElementById("btn-save").addEventListener("click", doSave);

// ===== CHIP GROUPS =====
function setupChipGroup(groupId, key) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("chip--active", chip.dataset.value === String(currentOptions[key]));
    chip.addEventListener("click", () => {
      group.querySelectorAll(".chip").forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
      currentOptions[key] = chip.dataset.value;
      markDirty();
      updateQr();
    });
  });
}

// ===== COLOR =====
function setupColor(inputId, previewId, key) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input) return;
  input.value = currentOptions[key];
  preview.style.background = currentOptions[key];
  input.addEventListener("input", (e) => {
    currentOptions[key] = e.target.value;
    preview.style.background = e.target.value;
    markDirty();
    updateQr();
  });
}

// ===== SLIDERS =====
function setupSlider(inputId, valueId, key, fmt) {
  const input = document.getElementById(inputId);
  const display = document.getElementById(valueId);
  if (!input) return;
  input.value = currentOptions[key];
  display.textContent = fmt(currentOptions[key]);
  input.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    currentOptions[key] = val;
    display.textContent = fmt(val);
    markDirty();
    updateQr();
  });
}

// ===== LOGO =====
function setupLogoUpload() {
  const btn = document.getElementById("btn-upload-logo");
  const fileInput = document.getElementById("logo-input");
  const clearRow = document.getElementById("logo-clear-row");
  const fileLabel = document.getElementById("logo-filename");
  const clearBtn = document.getElementById("btn-clear-logo");

  if (currentOptions.logoDataUrl) {
    clearRow.style.display = "flex";
    fileLabel.textContent = "logo salvo";
  }

  btn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentOptions.logoDataUrl = ev.target.result;
      fileLabel.textContent = file.name;
      clearRow.style.display = "flex";
      markDirty();
      updateQr();
    };
    reader.readAsDataURL(file);
  });

  clearBtn.addEventListener("click", () => {
    currentOptions.logoDataUrl = null;
    fileInput.value = "";
    fileLabel.textContent = "nenhum arquivo";
    clearRow.style.display = "none";
    markDirty();
    updateQr();
  });
}


// ===== ECC =====
function setupEcc() {
  const input = document.getElementById("ecc-level");
  const badge = document.getElementById("ecc-badge");
  const desc  = document.getElementById("ecc-desc");
  const ticks = document.querySelectorAll(".ecc-tick");

  function syncEcc(val) {
    badge.textContent = ECC_LEVELS[val];
    desc.textContent  = ECC_DESCS[val];
    ticks.forEach((t, i) => t.setAttribute("data-active", String(i === val)));
  }

  input.value = currentOptions.eccLevel;
  syncEcc(currentOptions.eccLevel);

  input.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    currentOptions.eccLevel = val;
    syncEcc(val);
    markDirty();
    updateQr();
  });
}

// ===== INIT =====
(function init() {
  setupChipGroup("dots-type-group",     "dotsType");
  setupChipGroup("corner-sq-type-group","cornerSqType");
  setupChipGroup("corner-dot-type-group","cornerDotType");

  setupColor("dots-color",       "dots-color-preview",       "dotsColor");
  setupColor("corner-sq-color",  "corner-sq-color-preview",  "cornerSqColor");
  setupColor("corner-dot-color", "corner-dot-color-preview", "cornerDotColor");
  setupColor("bg-color",         "bg-color-preview",         "bgColor");

  setupSlider("logo-size",   "logo-size-value",   "logoSize",   (v) => Math.round(v * 100) + "%");
  setupSlider("logo-margin", "logo-margin-value", "logoMargin", (v) => v + "px");
  setupSlider("qr-margin",   "qr-margin-value",   "margin",     (v) => v + "px");

  setupLogoUpload();
  setupEcc();
  updateQr();
})();
