/* =================================================================
   product-edit.js — criar / editar / excluir produto do catálogo
================================================================= */
(async function () {
  'use strict';
  const UI = window.QrUI;
  const D = window.QrData;
  const { formatCents, onlyDigits, imageToSquareDataUrl } = window.PixUtils;
  const $ = (id) => document.getElementById(id);

  const id = new URLSearchParams(location.search).get('id');
  const existing = id ? await D.products.get(id) : null;
  if (id && !existing) { location.replace('catalog.html'); return; }

  const f = { name: $('f-name'), price: $('f-price'), desc: $('f-desc'), available: $('f-available') };
  let image = existing?.imageDataUrl || '';

  // ── Foto ──────────────────────────────────────────────────────
  function renderPhoto() {
    $('photo').innerHTML = image
      ? `<img src="${image}" alt="" />`
      : '<span class="icon">add_a_photo</span><span class="label">Adicionar foto</span>';
    $('photo-actions').hidden = !image;
  }
  const pick = () => $('photo-input').click();
  $('photo').addEventListener('click', pick);
  $('btn-photo-change').addEventListener('click', pick);
  $('btn-photo-remove').addEventListener('click', () => { image = ''; renderPhoto(); });
  $('photo-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // 600×600 JPEG (~40–80 KB): leve para o aparelho e para publicar
      image = await imageToSquareDataUrl(file, 600);
      renderPhoto();
    } catch {
      UI.snackbar('Não foi possível ler esta imagem');
    }
  });

  // ── Preço com máscara de centavos ─────────────────────────────
  const priceCents = () => parseInt(onlyDigits(f.price.value) || '0', 10);
  f.price.addEventListener('input', () => {
    const c = priceCents();
    f.price.value = c ? formatCents(c) : '';
  });

  // ── Preencher ─────────────────────────────────────────────────
  await Promise.all(['md-outlined-text-field', 'md-switch'].map((t) => customElements.whenDefined(t)));
  if (existing) {
    $('title').textContent = 'Editar produto';
    $('btn-delete').hidden = false;
    f.name.value = existing.name;
    f.price.value = existing.priceCents ? formatCents(existing.priceCents) : '';
    f.desc.value = existing.description || '';
    f.available.selected = existing.available !== false;
  }
  renderPhoto();

  const collect = () => ({
    name: f.name.value.trim(),
    priceCents: priceCents(),
    description: f.desc.value.trim(),
    available: f.available.selected,
    imageDataUrl: image,
  });
  const initial = JSON.stringify(collect());
  const isDirty = () => JSON.stringify(collect()) !== initial;

  // ── Salvar / excluir ──────────────────────────────────────────
  async function save() {
    const data = collect();
    if (!data.name) {
      f.name.error = true; f.name.errorText = 'Informe o nome';
      f.name.focus();
      return false;
    }
    try {
      await D.products.save(existing ? { ...data, id: existing.id } : data);
    } catch (err) {
      console.error(err);
      UI.snackbar('Não foi possível salvar. Espaço do aparelho cheio?');
      return false;
    }
    location.replace('catalog.html');
    return true;
  }
  $('btn-save').addEventListener('click', save);
  f.name.addEventListener('input', () => { f.name.error = false; });

  $('btn-delete').addEventListener('click', async () => {
    const ok = await UI.confirm({
      icon: 'delete',
      title: 'Excluir produto?',
      body: existing.name,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await D.products.remove(existing.id);
    location.replace('catalog.html');
  });

  UI.setBeforeBack(async () => {
    if (!isDirty()) return true;
    const choice = await UI.dialog({
      icon: 'edit_note',
      title: 'Salvar produto?',
      body: 'Você fez alterações que ainda não foram salvas.',
      actions: [
        { label: 'Descartar', value: 'discard' },
        { label: 'Salvar', value: 'save', variant: 'filled' },
      ],
    });
    if (choice === 'save') { await save(); return false; }
    return choice === 'discard';
  });
})();
