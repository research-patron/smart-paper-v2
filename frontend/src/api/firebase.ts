// ~/Desktop/smart-paper-v2/frontend/src/api/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebaseの設定
// 注: 実際のプロジェクトでは環境変数から読み込むことを推奨
const firebaseConfig = {
    apiKey: "AIzaSyD2UPHxj9TPM4fkxKFtXq05T45DASzgf48",
    authDomain: "smart-paper-v2.firebaseapp.com",
    databaseURL: "https://smart-paper-v2-default-rtdb.firebaseio.com",
    projectId: "smart-paper-v2",
    storageBucket: "smart-paper-v2.firebasestorage.app",
    messagingSenderId: "137197753964",
    appId: "1:137197753964:web:d4909af8346cf602e8aa49",
    measurementId: "G-RQ1V5EN6CN"
  };

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firebase サービスをエクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;