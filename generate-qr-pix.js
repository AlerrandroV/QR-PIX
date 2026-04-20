// ===== DADOS DA TRANSAÇÃO =====
function readStoredTx() {
  try { return JSON.parse(sessionStorage.getItem("pixkey_current_tx") || "null") || {}; }
  catch { return {}; }
}

const storedTx = readStoredTx();
const txBank   = storedTx.bank || "";
const txName   = storedTx.name || "";
const txType   = storedTx.keyType || "";
const txKey    = storedTx.key || "";
const txCents  = parseInt(String(storedTx.value || "0"), 10);

// ===== GERAR PAYLOAD =====
const payload = PixPayload.generatePixPayload({
  keyType:     txType,
  key:         txKey,
  name:        txName,
  city:        "BRASILIA",
  value:       txCents,
});

// ===== FORMATAR VALOR =====
function formatCurrency(cents) {
  if (!cents) return "Sem valor definido";
  const intPart = Math.floor(cents / 100);
  const decPart = String(cents % 100).padStart(2, "0");
  const intFmt  = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return "R$ " + intFmt + "," + decPart;
}

// ===== PREENCHER DADOS =====
document.getElementById("info-bank").textContent  = txBank;
document.getElementById("info-name").textContent  = txName;
document.getElementById("info-key").textContent   = txKey;
document.getElementById("info-value").textContent = formatCurrency(txCents);
document.getElementById("copypaste-code").textContent = payload;

// ===== TAMANHO DO QR (responsivo) =====
const availH  = window.innerHeight - 64;   // desconta topbar
const qrMaxH  = Math.floor(availH * 0.45); // máx 45% da altura disponível
const qrMaxW  = window.innerWidth - 32;    // padding lateral
const qrSize  = Math.min(qrMaxH, qrMaxW, 400);
document.documentElement.style.setProperty("--qr-size", qrSize + "px");

// ===== CARREGAR CONFIGURAÇÕES SALVAS DO QR =====
const QR_SETTINGS_KEY = "pixkey_qr_settings";
function loadQrSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(QR_SETTINGS_KEY));
    const def = {
      dotsType: "square", dotsColor: "#000000",
      cornerSqType: "", cornerSqColor: "#000000",
      cornerDotType: "", cornerDotColor: "#000000",
      bgColor: "#ffffff", logoSize: 0.3, logoMargin: 5,
      margin: 10, logoDataUrl: null, eccLevel: 0,
    };
    return stored ? { ...def, ...stored } : def;
  } catch { return {}; }
}

const ECC_LEVELS = ["L", "M", "Q", "H"];
const qrCfg = loadQrSettings();

// ===== RENDERIZAR QR CODE =====
const qrCode = new QRCodeStyling({
  width:  qrSize,
  height: qrSize,
  type:   "svg",
  data:   payload,
  margin: qrCfg.margin ?? 10,
  qrOptions: {
    errorCorrectionLevel: ECC_LEVELS[qrCfg.eccLevel ?? 0],
  },
  dotsOptions: {
    type:  qrCfg.dotsType  || "square",
    color: qrCfg.dotsColor || "#000000",
  },
  cornersSquareOptions: {
    type:  qrCfg.cornerSqType  || undefined,
    color: qrCfg.cornerSqColor || "#000000",
  },
  cornersDotOptions: {
    type:  qrCfg.cornerDotType  || undefined,
    color: qrCfg.cornerDotColor || "#000000",
  },
  backgroundOptions: { color: qrCfg.bgColor || "#ffffff" },
  image: qrCfg.logoDataUrl || undefined,
  imageOptions: {
    crossOrigin:          "anonymous",
    imageSize:            qrCfg.logoSize  ?? 0.3,
    margin:               qrCfg.logoMargin ?? 5,
    hideBackgroundDots:   true,
  },
});

qrCode.append(document.getElementById("qr-output"));

// ===== TOAST =====
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

// ===== COPIA E COLA =====
const copyCard = document.getElementById("copypaste-card");
const copyHint = document.getElementById("copy-hint");

copyCard.addEventListener("click", () => {
  navigator.clipboard.writeText(payload).then(() => {
    copyHint.textContent = "Copiado!";
    showToast("Código copiado para a área de transferência");
    setTimeout(() => { copyHint.textContent = "Toque para copiar"; }, 3000);
  }).catch(() => {
    // Fallback para browsers sem Clipboard API
    const ta = document.createElement("textarea");
    ta.value = payload;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Código copiado!");
    copyHint.textContent = "Copiado!";
    setTimeout(() => { copyHint.textContent = "Toque para copiar"; }, 3000);
  });
});

// ===== DOWNLOAD 1024x1024 PNG =====
document.getElementById("btn-download").addEventListener("click", () => {
  const dlQr = new QRCodeStyling({
    width:  1024,
    height: 1024,
    type:   "canvas",
    data:   payload,
    margin: qrCfg.margin ?? 10,
    qrOptions: {
      errorCorrectionLevel: ECC_LEVELS[qrCfg.eccLevel ?? 0],
    },
    dotsOptions: {
      type:  qrCfg.dotsType  || "square",
      color: qrCfg.dotsColor || "#000000",
    },
    cornersSquareOptions: {
      type:  qrCfg.cornerSqType  || undefined,
      color: qrCfg.cornerSqColor || "#000000",
    },
    cornersDotOptions: {
      type:  qrCfg.cornerDotType  || undefined,
      color: qrCfg.cornerDotColor || "#000000",
    },
    backgroundOptions: { color: qrCfg.bgColor || "#ffffff" },
    image: qrCfg.logoDataUrl || undefined,
    imageOptions: {
      crossOrigin:        "anonymous",
      imageSize:          qrCfg.logoSize  ?? 0.3,
      margin:             qrCfg.logoMargin ?? 5,
      hideBackgroundDots: true,
    },
  });
  dlQr.download({ name: "pixkey-qrcode", extension: "png" });
  showToast("Download iniciado…");
});

// ===== COMPARTILHAR =====
document.getElementById("btn-share").addEventListener("click", async () => {
  const shareData = {
    title: "QR Code PIX — " + txName,
    text:  "Pix Copia e Cola:\n\n" + payload,
  };

  // Tentar compartilhar com imagem (canvas → blob → File)
  try {
    const dlQr = new QRCodeStyling({
      width: 512, height: 512, type: "canvas", data: payload,
      margin: qrCfg.margin ?? 10,
      qrOptions: { errorCorrectionLevel: ECC_LEVELS[qrCfg.eccLevel ?? 0] },
      dotsOptions:         { type: qrCfg.dotsType || "square", color: qrCfg.dotsColor || "#000000" },
      cornersSquareOptions:{ type: qrCfg.cornerSqType || undefined, color: qrCfg.cornerSqColor || "#000000" },
      cornersDotOptions:   { type: qrCfg.cornerDotType || undefined, color: qrCfg.cornerDotColor || "#000000" },
      backgroundOptions:   { color: qrCfg.bgColor || "#ffffff" },
      image: qrCfg.logoDataUrl || undefined,
      imageOptions: { crossOrigin: "anonymous", imageSize: qrCfg.logoSize ?? 0.3, margin: qrCfg.logoMargin ?? 5, hideBackgroundDots: true },
    });

    // getRawData retorna um Blob
    const blob = await dlQr.getRawData("png");
    const file = new File([blob], "pixkey-qrcode.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ ...shareData, files: [file] });
    } else {
      await navigator.share(shareData);
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      // Fallback: só texto
      try { await navigator.share(shareData); } catch {}
    }
  }
});

// ===== VOLTAR AO INÍCIO =====
document.getElementById("btn-home").addEventListener("click", () => {
  window.location.replace("index.html");
});

document.getElementById("btn-back").addEventListener("click", () => history.back());
