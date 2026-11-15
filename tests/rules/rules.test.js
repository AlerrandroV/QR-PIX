// Testes das regras do Firestore (rodam no emulador).
//   cd tests/rules && npm install && npm test
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

let env;
const ts = () => firebase.firestore.FieldValue.serverTimestamp();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-qrpix',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8086 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const storeDoc = (uid, username, extra = {}) => ({
  name: 'Doces da Maria', city: 'Recife', bio: 'Bolos', username, avatarDataUrl: null,
  whatsapp: '(81) 98765-4321', instagram: 'doces', bank: 'Nubank', keyType: 'email',
  pixKey: 'a@b.co', ownerUid: uid, productCount: 0, updatedAt: ts(), ...extra,
});
const productDoc = (uid, id, extra = {}) => ({
  id, name: 'Bolo', description: 'Inteiro', priceCents: 4500, imageDataUrl: null,
  available: true, updatedAt: Date.now(), order: 0, ownerUid: uid, ...extra,
});

// Mesma sequência de lotes de firebase.js → publishStore
async function publish(db, uid, username, products = [], previous = '') {
  const first = db.batch();
  if (previous) {
    (await db.collection(`stores/${previous}/products`).get()).forEach((d) => first.delete(d.ref));
    first.delete(db.doc(`stores/${previous}`));
  }
  first.set(db.doc(`owners/${uid}`), { username });
  first.set(db.doc(`stores/${username}`), storeDoc(uid, username, { productCount: products.length }));
  await first.commit();
  for (let i = 0; i < products.length; i += 8) {
    const b = db.batch();
    products.slice(i, i + 8).forEach((p, j) => b.set(db.doc(`stores/${username}/products/${p}`), productDoc(uid, p, { order: i + j })));
    await b.commit();
  }
}

test('dono publica loja com 20 produtos (lotes de 8)', async () => {
  await assertSucceeds(publish(as('maria'), 'maria', 'doces.maria', Array.from({ length: 20 }, (_, i) => 'p' + i)));
});

test('qualquer um lê a loja, sem login', async () => {
  await publish(as('maria'), 'maria', 'doces.maria', ['p1']);
  await assertSucceeds(anon().doc('stores/doces.maria').get());
  await assertSucceeds(anon().collection('stores/doces.maria/products').get());
});

test('sem login não escreve nada', async () => {
  await assertFails(anon().doc('stores/x.loja').set(storeDoc('x', 'x.loja')));
});

test('outro usuário não altera nem apaga a loja alheia', async () => {
  await publish(as('maria'), 'maria', 'doces.maria', ['p1']);
  const joao = as('joao');
  await assertFails(joao.doc('stores/doces.maria').set(storeDoc('joao', 'doces.maria')));
  await assertFails(joao.doc('stores/doces.maria').update({ name: 'Invadida' }));
  await assertFails(joao.doc('stores/doces.maria').delete());
  await assertFails(joao.doc('stores/doces.maria/products/p1').delete());
  await assertFails(joao.doc('stores/doces.maria/products/p1').update({ name: 'X' }));
});

test('outro usuário não grava produto na loja alheia', async () => {
  await publish(as('maria'), 'maria', 'doces.maria');
  await assertFails(as('joao').doc('stores/doces.maria/products/novo').set(productDoc('joao', 'novo')));
  await assertFails(as('joao').doc('stores/doces.maria/products/novo').set(productDoc('maria', 'novo')));
});

test('não toma o @ de outro nem escreve no registro do outro', async () => {
  await publish(as('maria'), 'maria', 'doces.maria');
  const joao = as('joao');
  const b = joao.batch();
  b.set(joao.doc('owners/joao'), { username: 'doces.maria' });
  b.set(joao.doc('stores/doces.maria'), storeDoc('joao', 'doces.maria'));
  await assertFails(b.commit());
  await assertFails(joao.doc('owners/maria').set({ username: 'joao.loja' }));
  await assertFails(joao.doc('owners/maria').get());
});

test('loja só nasce junto do registro de dono com o mesmo @', async () => {
  const db = as('maria');
  await assertFails(db.doc('stores/doces.maria').set(storeDoc('maria', 'doces.maria')));
  const b = db.batch();
  b.set(db.doc('owners/maria'), { username: 'outro.nome' });
  b.set(db.doc('stores/doces.maria'), storeDoc('maria', 'doces.maria'));
  await assertFails(b.commit());
});

test('uma conta não acumula lojas (anti-ocupação de @)', async () => {
  const db = as('maria');
  await publish(db, 'maria', 'loja.um');
  const b = db.batch();
  b.set(db.doc('owners/maria'), { username: 'loja.dois' });
  b.set(db.doc('stores/loja.dois'), storeDoc('maria', 'loja.dois'));
  await assertFails(b.commit());
});

test('trocar de @ apagando a loja antiga funciona', async () => {
  const db = as('maria');
  await publish(db, 'maria', 'loja.um', ['p1', 'p2']);
  await assertSucceeds(publish(db, 'maria', 'loja.dois', ['p1', 'p2'], 'loja.um'));
  const old = await anon().collection('stores/loja.um/products').get();
  if (old.size !== 0) throw new Error('produtos da loja antiga ficaram para trás');
});

test('tirar do ar apaga loja, produtos e registro', async () => {
  const db = as('maria');
  await publish(db, 'maria', 'loja.um', ['p1']);
  const b = db.batch();
  b.delete(db.doc('stores/loja.um/products/p1'));
  b.delete(db.doc('stores/loja.um'));
  b.delete(db.doc('owners/maria'));
  await assertSucceeds(b.commit());
});

test('não apaga o registro de dono deixando a loja viva', async () => {
  const db = as('maria');
  await publish(db, 'maria', 'loja.um');
  await assertFails(db.doc('owners/maria').delete());
});

test('nomes reservados e inválidos são recusados', async () => {
  for (const u of ['admin', 'qrpix', 'ab', 'Maiuscula', '.comeca', 'termina.', 'dois..pontos', 'tem espaco', 'x'.repeat(21)]) {
    await assertFails(publish(as('u' + u.length), 'u' + u.length, u));
  }
});

test('campos extras, tipos errados e tamanhos acima do limite são recusados', async () => {
  const db = as('maria');
  const put = async (extra) => {
    const b = db.batch();
    b.set(db.doc('owners/maria'), { username: 'loja.um' });
    b.set(db.doc('stores/loja.um'), storeDoc('maria', 'loja.um', extra));
    return b.commit();
  };
  await assertFails(put({ admin: true }));
  await assertFails(put({ name: '' }));
  await assertFails(put({ name: 'x'.repeat(61) }));
  await assertFails(put({ keyType: 'pagamento' }));
  await assertFails(put({ avatarDataUrl: 'x'.repeat(120001) }));
  await assertFails(put({ updatedAt: new Date('2020-01-01') }));
  await assertFails(put({ ownerUid: 'joao' }));
});

test('produto: preço, tamanho e campos validados', async () => {
  const db = as('maria');
  await publish(db, 'maria', 'loja.um');
  const set = (extra) => db.doc('stores/loja.um/products/p1').set(productDoc('maria', 'p1', extra));
  await assertSucceeds(set({}));
  await assertFails(set({ priceCents: -1 }));
  await assertFails(set({ priceCents: '45' }));
  await assertFails(set({ priceCents: 4.5 }));
  await assertFails(set({ imageDataUrl: 'x'.repeat(250001) }));
  await assertFails(set({ name: '' }));
  await assertFails(set({ extra: 1 }));
  await assertFails(set({ id: 'outro' }));
});

test('dono não consegue passar a loja para outro uid', async () => {
  await publish(as('maria'), 'maria', 'loja.um');
  await assertFails(as('maria').doc('stores/loja.um').update({ ownerUid: 'joao', updatedAt: ts() }));
});

test('consulta "minha loja" (ownerUid == uid) é permitida', async () => {
  await publish(as('maria'), 'maria', 'loja.um');
  const snap = await assertSucceeds(as('maria').collection('stores').where('ownerUid', '==', 'maria').limit(1).get());
  if (snap.size !== 1) throw new Error('não achou a própria loja');
});

test('coleção legada profiles é somente leitura', async () => {
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc('profiles/antigo').set({ name: 'x' }));
  await assertSucceeds(anon().doc('profiles/antigo').get());
  await assertFails(as('maria').doc('profiles/antigo').set({ name: 'y' }));
  await assertFails(as('maria').doc('profiles/novo').set({ name: 'y' }));
});

test('coleções desconhecidas ficam bloqueadas', async () => {
  await assertFails(as('maria').doc('qualquer/coisa').set({ a: 1 }));
  await assertFails(anon().doc('qualquer/coisa').get());
});
