/* =================================================================
   firebase.js — ADAPTADOR REMOTO (Firebase Auth + Firestore)
   -----------------------------------------------------------------
   Único arquivo que conhece o Firebase. data.js o carrega e usa:

   Publicação (obrigatório)
     isUsernameAvailable(username)
     publishStore({ profile, products, previousUsername })
     unpublishStore(username)
     fetchStore(username)

   Conta (opcional — a tela esconde o bloco "Conta" se não existir)
     getAccount()            → { kind: 'anonymous' | 'google' | 'none', email, name }
     signInWithGoogle()      → { ok, linked?, switched?, cancelled?, error? }
     signOutAccount()
     fetchMyStore()          → { profile, products } | null

   Dono da loja: o uid do Firebase Auth. Começa anônimo e, ao entrar
   com o Google, a MESMA conta é vinculada (o uid não muda) — as lojas
   já publicadas continuam sendo do vendedor.

   A apiKey é pública por design (identifica o projeto). Quem protege os
   dados são as regras: firestore.rules. Guia: docs/FIREBASE.md
================================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, signInWithCredential,
  linkWithPopup, GoogleAuthProvider, signOut as fbSignOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, collection, query, where, limit, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBNopSwIW7wAtPbUgNg9cAtrSYWLnH2d3I',
  authDomain:        'alerrandrov-qr-pix.firebaseapp.com',
  projectId:         'alerrandrov-qr-pix',
  storageBucket:     'alerrandrov-qr-pix.firebasestorage.app',
  messagingSenderId: '852959080798',
  appId:             '1:852959080798:web:a9494efad51551bad85fcf',
  measurementId:     'G-JW026XVVQW',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const STORES = 'stores';
const OWNERS = 'owners';
// Mantenha igual à função reserved() de firestore.rules
const RESERVED = ['admin', 'administrador', 'qrpix', 'qr-pix', 'qr.pix', 'suporte', 'support',
  'contato', 'api', 'www', 'app', 'root', 'oficial', 'official', 'loja', 'store'];
// Limite de escritas "set" por lote: cada uma consulta a loja nas regras
const SETS_PER_BATCH = 8;

// ── Conta ─────────────────────────────────────────────────────────
const authReady = new Promise((resolve) => {
  const off = onAuthStateChanged(auth, () => { off(); resolve(); });
});

async function ensureOwner() {
  await authReady;
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    return (await signInAnonymously(auth)).user.uid;
  } catch (err) {
    console.warn('[firebase] login anônimo indisponível:', err.code || err.message);
    return null;
  }
}

function describe(user) {
  if (!user) return { kind: 'none' };
  const g = user.providerData.find((p) => p.providerId === 'google.com');
  if (!g) return { kind: 'anonymous' };
  return { kind: 'google', email: g.email || user.email || '', name: g.displayName || '' };
}

export async function getAccount() {
  await authReady;
  return describe(auth.currentUser);
}

export async function signInWithGoogle() {
  await authReady;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const user = auth.currentUser;
  try {
    // Conta anônima atual → vincula o Google (uid preservado, loja continua sua)
    if (user && user.isAnonymous) await linkWithPopup(user, provider);
    else await signInWithPopup(auth, provider);
    return { ok: true, linked: true, account: describe(auth.currentUser) };
  } catch (err) {
    // Esse Google já está ligado a outra conta (ex.: outro aparelho): entra nela
    if (err.code === 'auth/credential-already-in-use') {
      const credential = GoogleAuthProvider.credentialFromError(err);
      if (credential) {
        try {
          await signInWithCredential(auth, credential);
          return { ok: true, switched: true, account: describe(auth.currentUser) };
        } catch (e) { return { ok: false, error: e.code || e.message }; }
      }
    }
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: err.code || err.message };
  }
}

export async function signOutAccount() {
  await fbSignOut(auth);
  await signInAnonymously(auth).catch(() => {}); // o aparelho segue com uma conta anônima nova
}

// ── Loja ──────────────────────────────────────────────────────────
export async function isUsernameAvailable(username) {
  const id = username.toLowerCase();
  if (RESERVED.includes(id)) return false;
  const [store, legacy] = await Promise.all([
    getDoc(doc(db, STORES, id)),
    getDoc(doc(db, 'profiles', id)).catch(() => null), // coleção da v1.0
  ]);
  if (store.exists()) {
    const uid = await ensureOwner();
    return !!uid && store.data().ownerUid === uid;
  }
  return !(legacy && legacy.exists());
}

async function queueStoreDelete(batch, id) {
  const snap = await getDocs(collection(db, STORES, id, 'products'));
  snap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, STORES, id));
}

export async function publishStore({ profile, products, previousUsername }) {
  const id = profile.username;
  const uid = await ensureOwner();
  if (!uid) throw new Error('Sem login: ative o acesso anônimo no Firebase');

  // 1) Lote principal: dono do @, loja nova e remoção da loja antiga (se o @ mudou)
  const first = writeBatch(db);
  if (previousUsername) await queueStoreDelete(first, previousUsername);
  first.set(doc(db, OWNERS, uid), { username: id });
  first.set(doc(db, STORES, id), {
    ...profile,
    ownerUid: uid,
    productCount: products.length,
    updatedAt: serverTimestamp(),
  });
  await first.commit();

  // 2) Produtos removidos
  const keep = new Set(products.map((p) => p.id));
  const existing = await getDocs(collection(db, STORES, id, 'products'));
  const stale = existing.docs.filter((d) => !keep.has(d.id));
  for (let i = 0; i < stale.length; i += 400) {
    const b = writeBatch(db);
    stale.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }

  // 3) Produtos novos/alterados, em lotes pequenos
  for (let i = 0; i < products.length; i += SETS_PER_BATCH) {
    const b = writeBatch(db);
    products.slice(i, i + SETS_PER_BATCH).forEach((p, j) => {
      b.set(doc(db, STORES, id, 'products', p.id), { ...p, order: i + j, ownerUid: uid });
    });
    await b.commit();
  }
  return { ok: true };
}

export async function unpublishStore(username) {
  const uid = await ensureOwner();
  if (!uid) throw new Error('Sem login');
  const id = username.toLowerCase();
  const batch = writeBatch(db);
  await queueStoreDelete(batch, id);
  const owner = await getDoc(doc(db, OWNERS, uid));
  if (owner.exists() && owner.data().username === id) batch.delete(owner.ref);
  await batch.commit();
  return { ok: true };
}

export async function fetchStore(username) {
  const id = username.toLowerCase();
  const snap = await getDoc(doc(db, STORES, id));
  if (!snap.exists()) return null;
  const items = await getDocs(collection(db, STORES, id, 'products'));
  const products = items.docs.map((d) => d.data()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const { ownerUid, productCount, updatedAt, ...profile } = snap.data();
  return { profile, products: products.map(({ ownerUid: _o, order, ...p }) => p) };
}

// A loja que pertence à conta atual (para recuperar em outro aparelho)
export async function fetchMyStore() {
  const uid = await ensureOwner();
  if (!uid) return null;
  const snap = await getDocs(query(collection(db, STORES), where('ownerUid', '==', uid), limit(1)));
  return snap.empty ? null : fetchStore(snap.docs[0].id);
}
