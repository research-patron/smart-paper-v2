// ~/Desktop/smart-paper-v2/frontend/src/store/authStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User, UserCredential } from 'firebase/auth';
import { Timestamp, DocumentData, getDoc, doc } from 'firebase/firestore';
import { 
  loginWithEmail, 
  loginWithGoogle, 
  logoutUser,
  registerUser,
  resetPassword,
  getUserData,
  resendVerificationEmail,
  updateUserEmailVerificationStatus
} from '../api/auth';
import { db } from '../api/firebase';

// ユーザーデータの型定義
interface UserData {
  subscription_status: 'free' | 'paid' | 'none'; // 'none'は後方互換性のために残す
  subscription_end_date: Timestamp | null;
  subscription_cancel_at_period_end?: boolean;
  subscription_plan?: string;  // 明示的に追加
  name?: string;
  email?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  // 追加: メール認証状態
  email_verified?: boolean;
  // 翻訳回数の管理用フィールドを追加
  translation_count?: number;
  translation_period_start?: Timestamp | null;
  translation_period_end?: Timestamp | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  userData: UserData | null;
  lastUserDataUpdate: number; // 最後のユーザーデータ更新タイムスタンプ
  isUpdatingUserData: boolean; // ユーザーデータ更新中フラグ
  updateCount: number; // データ更新要求のカウンター（デバッグ用）
  
  // 認証アクション
  login: (email: string, password: string) => Promise<UserCredential>;
  loginWithGoogle: () => Promise<UserCredential>;
  register: (email: string, password: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setUserData: (data: UserData | null) => void;
  clearError: () => void;
  updateUserData: (forceRefresh?: boolean) => Promise<void>;
  forceRefreshUserData: () => Promise<void>; // 強制的にデータを更新する新しいメソッド
  // 追加: メール認証関連
  sendVerificationEmail: () => Promise<void>;
  updateEmailVerificationStatus: () => Promise<void>;
  isEmailVerified: () => boolean;
}

// DocumentData を UserData に変換する関数
const convertToUserData = (data: DocumentData | null): UserData | null => {
  if (!data) return null;
  
  // デバッグログを削除
  
  // noneステータスの場合はfreeに変換
  const status = data.subscription_status === 'none' ? 'free' : data.subscription_status;
  
  return {
    subscription_status: (status as 'free' | 'paid') || 'free', // ステータスがない場合はfreeをデフォルトに
    subscription_end_date: data.subscription_end_date || null,
    subscription_cancel_at_period_end: data.subscription_cancel_at_period_end || false,
    subscription_plan: data.subscription_plan || 'monthly', // デフォルト値を設定
    name: data.name,
    email: data.email,
    created_at: data.created_at,
    updated_at: data.updated_at,
    // 追加: メール認証状態（デフォルトはfalse）
    email_verified: data.email_verified === true,
    // 翻訳回数関連フィールドを追加
    translation_count: data.translation_count || 0,
    translation_period_start: data.translation_period_start || null,
    translation_period_end: data.translation_period_end || null
  };
};

// 更新リクエストの間隔制限
const THROTTLE_TIME_MS = 5000; // 5秒

// 認証状態を管理するZustandストア
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        loading: true,
        error: null,
        userData: null,
        lastUserDataUpdate: 0,
        isUpdatingUserData: false,
        updateCount: 0,
        
        login: async (email, password) => {
          try {
            set({ loading: true, error: null });
            const result = await loginWithEmail(email, password);
            set({ user: result.user, loading: false });
            
            // ユーザーデータを取得
            await get().updateUserData(true);
            
            return result;
          } catch (error: any) {
            // Firebaseのエラーメッセージをユーザーフレンドリーなものに変換
            let errorMessage = 'ログインに失敗しました。';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
              errorMessage = 'メールアドレスまたはパスワードが正しくありません。';
            } else if (error.code === 'auth/too-many-requests') {
              errorMessage = 'ログイン試行回数が多すぎます。しばらく時間をおいてお試しください。';
            } else if (error.code === 'auth/user-disabled') {
              errorMessage = 'このアカウントは無効になっています。管理者にお問い合わせください。';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = '無効なメールアドレス形式です。';
            }
            
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },
        
        loginWithGoogle: async () => {
          try {
            set({ loading: true, error: null });
            const result = await loginWithGoogle();
            set({ user: result.user, loading: false });
            
            // ユーザーデータを取得
            await get().updateUserData(true);
            
            return result;
          } catch (error: any) {
            let errorMessage = 'Googleログインに失敗しました。';
            if (error.code === 'auth/popup-closed-by-user') {
              errorMessage = 'ログインがキャンセルされました。';
            } else if (error.code === 'auth/popup-blocked') {
              errorMessage = 'ポップアップがブロックされました。ポップアップブロックを解除してください。';
            }
            
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },
        
        register: async (email, password, name) => {
          try {
            set({ loading: true, error: null });
            const user = await registerUser(email, password, name);
            set({ user, loading: false });
            
            // ユーザーデータを取得
            await get().updateUserData(true);
            
            return user;
          } catch (error: any) {
            let errorMessage = '登録に失敗しました。';
            if (error.code === 'auth/email-already-in-use') {
              errorMessage = 'このメールアドレスは既に使用されています。';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = '無効なメールアドレス形式です。';
            } else if (error.code === 'auth/weak-password') {
              errorMessage = 'パスワードが弱すぎます。より強力なパスワードを設定してください。';
            }
            
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },
        
        logout: async () => {
          try {
            set({ loading: true, error: null });
            await logoutUser();
            set({ user: null, userData: null, loading: false });
          } catch (error: any) {
            set({ error: 'ログアウトに失敗しました。', loading: false });
            throw error;
          }
        },
        
        resetPassword: async (email) => {
          try {
            set({ loading: true, error: null });
            await resetPassword(email);
            set({ loading: false });
          } catch (error: any) {
            let errorMessage = 'パスワードリセットに失敗しました。';
            if (error.code === 'auth/user-not-found') {
              errorMessage = 'このメールアドレスのユーザーは見つかりませんでした。';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = '無効なメールアドレス形式です。';
            }
            
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },
        
        setUser: (user) => {
          set({ user, loading: false });
        },
        
        setUserData: (data) => {
          set({ 
            userData: data, 
            loading: false,
            lastUserDataUpdate: Date.now()
          });
        },
        
        clearError: () => {
          set({ error: null });
        },
        
        updateUserData: async (forceRefresh = false) => {
          const { user, lastUserDataUpdate, isUpdatingUserData, updateCount } = get();
          
          set({ updateCount: updateCount + 1 });
          
          if (!user) {
            return;
          }
          
          // 既に更新中なら新しい更新をスキップ
          if (isUpdatingUserData) {
            return;
          }
          
          const now = Date.now();
          
          // 最後の更新からTHROTTLE_TIME_MS以内かつforceRefreshがfalseならスキップ
          if (!forceRefresh && (now - lastUserDataUpdate) < THROTTLE_TIME_MS) {
            return;
          }
          
          try {
            // 更新中フラグをセット
            set({ isUpdatingUserData: true });
            
            // 同期的な更新のためにloadingステートは変更しない
            
            // getUserData関数を呼び出す代わりに、直接Firestoreから最新データを取得
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const rawUserData = userSnap.data();
              const userData = convertToUserData(rawUserData);
              
              
              // ステートを一度に更新
              set({ 
                userData,
                lastUserDataUpdate: now,
                isUpdatingUserData: false
              });
            } else {
              
              // ステートを一度に更新
              set({ 
                userData: null, 
                lastUserDataUpdate: now,
                isUpdatingUserData: false 
              });
            }
          } catch (error) {
            console.error(`Error fetching user data (request #${updateCount}):`, error);
            
            // エラー時はフラグのみリセット
            set({ isUpdatingUserData: false });
          }
        },
        
        // 強制的にユーザーデータを更新するメソッド
        forceRefreshUserData: async () => {
          return await get().updateUserData(true);
        },
        
        // 追加: メール認証メールを再送信
        sendVerificationEmail: async () => {
          const { user } = get();
          
          if (!user) {
            throw new Error('ユーザーがログインしていません');
          }
          
          try {
            set({ loading: true, error: null });
            await resendVerificationEmail(user);
            set({ loading: false });
          } catch (error: any) {
            let errorMessage = 'メール認証の送信に失敗しました。';
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },
        
        // 追加: メール認証状態を更新
        updateEmailVerificationStatus: async () => {
          const { user } = get();
          
          if (!user) {
            return;
          }
          
          try {
            // Firebaseから最新のユーザー情報を取得（認証状態が更新されている可能性があるため）
            await user.reload();
            
            // Firestoreのユーザーデータを更新
            await updateUserEmailVerificationStatus(user.uid, user.emailVerified);
            
            // ユーザーデータを強制的に更新
            await get().forceRefreshUserData();
            
          } catch (error) {
          }
        },
        
        // 追加: メール認証されているかを確認
        isEmailVerified: () => {
          const { user, userData } = get();
          
          // ユーザーがいない場合はfalse
          if (!user) return false;
          
          // Firebase Authのemailverified状態を優先
          if (user.emailVerified) return true;
          
          // Firestoreのデータも確認
          if (userData?.email_verified) return true;
          
          // Google認証の場合は検証済みとみなす
          const isGoogleProvider = user.providerData.some(
            provider => provider.providerId === 'google.com'
          );
          
          return isGoogleProvider;
        }
      }),
      {
        name: 'auth-storage',
        // ローカルストレージには最小限の情報のみ保存
        partialize: (state) => ({ 
          user: state.user ? {
            uid: state.user.uid,
            email: state.user.email,
            displayName: state.user.displayName,
            photoURL: state.user.photoURL,
          } : null 
        }),
      }
    )
  )
);