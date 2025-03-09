// ~/Desktop/smart-paper-v2/frontend/src/api/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebaseの設定
// 注: 実際のプロジェクトでは環境変数から読み込むことを推奨
const firebaseConfig = {
    
  };

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firebase サービスをエクスポート
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
