// ~/Desktop/smart-paper-v2/frontend/src/api/auth.ts
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
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
    
    // 現在の日時
    const now = new Date();
    // 1ヶ月後の日時（翻訳期間の終了日）
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    
    // Firestoreにユーザー情報を保存
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      name: name || user.displayName || email.split('@')[0],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      subscription_status: 'free',
      subscription_end_date: null,
      // 翻訳期間の初期設定
      translation_count: 0,
      translation_period_start: Timestamp.fromDate(now),
      translation_period_end: Timestamp.fromDate(oneMonthLater),
      // メール認証状態
      email_verified: false
    });
    
    // メール認証リンクを送信
    await sendEmailVerification(user);
    
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
      // 現在の日時
      const now = new Date();
      // 1ヶ月後の日時（翻訳期間の終了日）
      const oneMonthLater = new Date();
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        name: result.user.displayName || result.user.email?.split('@')[0],
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        subscription_status: 'free',
        subscription_end_date: null,
        // 翻訳期間の初期設定
        translation_count: 0,
        translation_period_start: Timestamp.fromDate(now),
        translation_period_end: Timestamp.fromDate(oneMonthLater),
        // Googleログインはデフォルトで認証済みとする
        email_verified: true
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

// メール認証の再送信
export const resendVerificationEmail = async (user: User): Promise<void> => {
  try {
    await sendEmailVerification(user);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

// Firestoreのユーザーデータをメール認証状態で更新
export const updateUserEmailVerificationStatus = async (userId: string, isVerified: boolean): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      email_verified: isVerified,
      updated_at: Timestamp.now()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating email verification status:', error);
    throw error;
  }
};