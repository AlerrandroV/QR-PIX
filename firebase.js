/* =================================================================
   firebase.js
   Inicialização do Firebase + helpers do Firestore.
   Importado como módulo ES nos scripts que precisam do banco.
================================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBNopSwIW7wAtPbUgNg9cAtrSYWLnH2d3I',
  authDomain:        'alerrandrov-qr-pix.firebaseapp.com',
  projectId:         'alerrandrov-qr-pix',
  storageBucket:     'alerrandrov-qr-pix.firebasestorage.app',
  messagingSenderId: '852959080798',
  appId:             '1:852959080798:web:a9494efad51551bad85fcf',
  measurementId:     'G-JW026XVVQW'
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/**
 * Verifica se um username já está em uso.
 * @param {string} username  — sem @, já normalizado
 * @returns {Promise<boolean>}  true = disponível, false = já usado
 */
export async function isUsernameAvailable(username) {
  if (!username) return true;
  const snap = await getDoc(doc(db, 'profiles', username.toLowerCase()));
  return !snap.exists();
}

/**
 * Salva o perfil no Firestore.
 * O documento é indexado pelo username (lower-case).
 * Se não houver username, usa a pixKey como ID do documento
 * (garantindo um perfil único por chave PIX).
 *
 * @param {Object} profile — dados coletados no wizard
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function saveProfileToFirestore(profile) {
  const docId = profile.username
    ? profile.username.toLowerCase()
    : 'anon_' + btoa(profile.pixKey).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);

  try {
    await setDoc(doc(db, 'profiles', docId), {
      name:         profile.name,
      city:         profile.city,
      bank:         profile.bank,
      keyType:      profile.keyType,
      pixKey:       profile.pixKey,
      username:     profile.username || null,
      avatarDataUrl:profile.avatarDataUrl || null,
      createdAt:    serverTimestamp()
    });
    return { ok: true, docId };
  } catch (err) {
    console.error('[Firebase] saveProfile:', err);
    return { ok: false, error: err.message };
  }
}

export { db };
