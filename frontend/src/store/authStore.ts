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
  getUserData
} from '../api/auth';
import { db } from '../api/firebase';

// ユーザーデータの型定義
interface UserData {
  subscription_status: 'none' | 'free' | 'paid';
  subscription_end_date: Timestamp | null;
  subscription_cancel_at_period_end?: boolean;
  name?: string;
  email?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  userData: UserData | null;
  lastUserDataUpdate: number; // 最後のユーザーデータ更新タイムスタンプ
  
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
}

// DocumentData を UserData に変換する関数
const convertToUserData = (data: DocumentData | null): UserData | null => {
  if (!data) return null;
  
  return {
    subscription_status: (data.subscription_status as 'none' | 'free' | 'paid') || 'none',
    subscription_end_date: data.subscription_end_date || null,
    subscription_cancel_at_period_end: data.subscription_cancel_at_period_end || false,
    name: data.name,
    email: data.email,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

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
          const { user, lastUserDataUpdate } = get();
          if (!user) return;
          
          const now = Date.now();
          const TIME_THRESHOLD = 10000; // 10秒
          
          // 最後の更新から10秒以内かつforceRefreshがfalseならスキップ
          if (!forceRefresh && now - lastUserDataUpdate < TIME_THRESHOLD) {
            console.log('Skipping user data update - recent update detected');
            return;
          }
          
          try {
            set({ loading: true });
            
            // getUserData関数を呼び出す代わりに、直接Firestoreから最新データを取得
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const rawUserData = userSnap.data();
              const userData = convertToUserData(rawUserData);
              
              console.log('Successfully updated user data:', userData);
              
              set({ 
                userData, 
                loading: false,
                lastUserDataUpdate: now
              });
            } else {
              console.warn('No user data found for:', user.uid);
              set({ 
                userData: null, 
                loading: false,
                lastUserDataUpdate: now
              });
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
            set({ loading: false });
          }
        },
        
        // 強制的にユーザーデータを更新するメソッド
        forceRefreshUserData: async () => {
          console.log('Force refreshing user data...');
          await get().updateUserData(true);
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