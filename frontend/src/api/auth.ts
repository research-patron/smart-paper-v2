// ~/Desktop/smart-paper-v2/frontend/src/api/auth.ts
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    User,
    UserCredential
  } from 'firebase/auth';
  import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
  import { auth, db, googleProvider } from './firebase';
  
  // 新規ユーザー登録
  export const registerUser = async (email: string, password: string, name?: string): Promise<User> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Firestoreにユーザー情報を保存
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: name || user.displayName || email.split('@')[0],
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        subscription_status: 'free',
        subscription_end_date: null,
      });
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };
  
  // メール/パスワードでログイン
  export const loginWithEmail = async (email: string, password: string): Promise<UserCredential> => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  // Googleでログイン
  export const loginWithGoogle = async (): Promise<UserCredential> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Firestoreにユーザー情報があるか確認し、なければ作成
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          name: result.user.displayName || result.user.email?.split('@')[0],
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
          subscription_status: 'free',
          subscription_end_date: null,
        });
      }
      
      return result;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };
  
  // ログアウト
  export const logoutUser = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };
  
  // パスワードリセットメールの送信
  export const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };
  
  // ユーザー情報を取得
  export const getUserData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  };