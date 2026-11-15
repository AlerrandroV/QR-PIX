/* =================================================================
   firebase.js — ADAPTADOR REMOTO (Firebase / Firestore)
   -----------------------------------------------------------------
   Implementa a interface esperada por data.js:
     isUsernameAvailable(username)
     publishStore({ profile, products, previousUsername })
     unpublishStore(username)
     fetchStore(username)
   Nenhuma outra parte do app importa este arquivo. Para trocar de
   backend, crie outro adaptador com as mesmas funções.

   Estrutura no Firestore:
     stores/{username}                  perfil público + ownerUid
     stores/{username}/products/{id}    itens do catálogo

   Dono da loja: login anônimo do Firebase Auth (um uid por aparelho).
   As regras em firestore.rules só deixam o dono alterar a loja.
   Requer "Anonymous" ativado em Authentication → Sign-in method.

   A apiKey abaixo é pública por design (identifica o projeto); a
   segurança vem das regras. https://firebase.google.com/docs/projects/api-keys
================================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, collection, writeBatch, serverTimestamp,
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

async function ensureOwner() {
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err) {
    // Login anônimo desativado no console: segue sem dono (as regras decidem)
    console.warn('[firebase] login anônimo indisponível:', err.code || err.message);
    return null;
  }
}

export async function isUsernameAvailable(username) {
  const id = username.toLowerCase();
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

async function deleteStoreDocs(batch, id) {
  const snap = await getDocs(collection(db, STORES, id, 'products'));
  snap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, STORES, id));
}

export async function publishStore({ profile, products, previousUsername }) {
  const id = profile.username;
  const ownerUid = await ensureOwner();
  const batch = writeBatch(db);

  if (previousUsername) await deleteStoreDocs(batch, previousUsername);

  batch.set(doc(db, STORES, id), {
    ...profile,
    ownerUid,
    productCount: products.length,
    updatedAt: serverTimestamp(),
  });

  const keep = new Set(products.map((p) => p.id));
  const existing = await getDocs(collection(db, STORES, id, 'products')).catch(() => null);
  existing && existing.forEach((d) => { if (!keep.has(d.id)) batch.delete(d.ref); });
  products.forEach((p, order) => batch.set(doc(db, STORES, id, 'products', p.id), { ...p, order, ownerUid }));

  await batch.commit();
  return { ok: true };
}

export async function unpublishStore(username) {
  await ensureOwner();
  const batch = writeBatch(db);
  await deleteStoreDocs(batch, username.toLowerCase());
  await batch.commit();
  return { ok: true };
}

export async function fetchStore(username) {
  const id = username.toLowerCase();
  const snap = await getDoc(doc(db, STORES, id));
  if (!snap.exists()) return null;
  const items = await getDocs(collection(db, STORES, id, 'products'));
  const products = items.docs.map((d) => d.data()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const { ownerUid, ...profile } = snap.data();
  return { profile, products: products.map(({ ownerUid: _o, ...p }) => p) };
}
