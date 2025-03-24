// ~/Desktop/smart-paper-v2/frontend/src/App.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, CircularProgress, Container } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// スタイル
import theme from './styles/theme';

// コンポーネント
import Header from './components/common/Header';
import Footer from './components/common/Footer';

// ページ
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MyPapersPage from './pages/MyPapersPage';
import RegisterPage from './pages/RegisterPage';
import PaperViewPage from './pages/PaperViewPage';
import ProfilePage from './pages/ProfilePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsPage from './pages/LegalPages/TermsPage';
import PrivacyPage from './pages/LegalPages/PrivacyPage';
import CommercePage from './pages/LegalPages/CommercePage';
import SubscriptionPage from './pages/SubscriptionPage';

// Firebase
import { auth, db } from './api/firebase';
import { useAuthStore } from './store/authStore';
import { usePaperStore } from './store/paperStore'; // 追加: PaperStoreをインポート

// 認証が必要なルートのラッパーコンポーネント
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuthStore();
  
  if (loading) {
    // ローディング中はここに表示するコンテンツを設定
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }
  
  // 本番用コード: 未認証の場合はログインページにリダイレクト
  if (!user) {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
};

// ナビゲーション監視コンポーネント
const RouteObserver: React.FC = () => {
  const location = useLocation();
  const { forceRefreshUserData } = useAuthStore();
  const refreshTriggeredRef = useRef(false);
  
  useEffect(() => {
    // サブスクリプションページのクエリパラメータをチェック
    if (location.pathname === '/subscription') {
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('success') === 'true' && !refreshTriggeredRef.current) {
        console.log('Detected successful subscription payment, refreshing user data...');
        // ユーザーデータを強制更新（1回のみ）
        refreshTriggeredRef.current = true;
        forceRefreshUserData().finally(() => {
          // 3秒後にフラグをリセット
          setTimeout(() => {
            refreshTriggeredRef.current = false;
          }, 3000);
        });
      }
    } else {
      // 他のページに移動したらフラグをリセット
      refreshTriggeredRef.current = false;
    }
  }, [location, forceRefreshUserData]);
  
  return null;
};

// DocumentData を UserData に変換する関数
const convertToUserData = (data: any) => {
  if (!data) return null;
  
  return {
    subscription_status: (data.subscription_status as 'free' | 'paid') || 'free',
    subscription_end_date: data.subscription_end_date || null,
    subscription_cancel_at_period_end: data.subscription_cancel_at_period_end || false,
    name: data.name,
    email: data.email,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

function App() {
  const { setUser, setUserData } = useAuthStore();
  const { fetchUserPapers } = usePaperStore(); // 追加: PaperStoreから関数を取得
  const [appReady, setAppReady] = useState(false);
  
  // 初期化フラグ
  const isInitializedRef = useRef(false);
  
  // 自動更新インターバルを保持するためのref
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // メモ化したユーザーデータ更新関数
  const refreshUserData = useCallback(async (uid: string) => {
    try {
      // 強制的にFirestoreから最新データを取得
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // 取得したデータを変換してからstoreにセット
        const userData = convertToUserData(docSnap.data());
        setUserData(userData);
        console.log("User data loaded:", userData?.subscription_status);
      } else {
        console.log("No user data found in Firestore");
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [setUserData]);
  
  // 論文データの取得（メモ化）
  const fetchPapers = useCallback(async (uid: string) => {
    try {
      console.log("Fetching user papers...");
      await fetchUserPapers(uid);
      console.log("User papers loaded successfully");
    } catch (error) {
      console.error("Failed to load user papers:", error);
    }
  }, [fetchUserPapers]);
  
  useEffect(() => {
    console.log("App initializing...");
    
    // Firebase Authの状態監視
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? `User: ${user.uid}` : "No user");
      setUser(user);
      
      if (user) {
        // 最初の初期化処理（アプリ起動時に一度だけ実行）
        if (!isInitializedRef.current) {
          isInitializedRef.current = true;
          
          // 1. ユーザーデータを取得
          await refreshUserData(user.uid);
          
          // 2. 論文データを取得
          await fetchPapers(user.uid);
        }
      } else {
        setUserData(null);
        // ユーザーがログアウトしたらフラグをリセット
        isInitializedRef.current = false;
      }
      
      setAppReady(true);
    });
    
    // コンポーネントのアンマウント時にリスナーを解除
    return () => {
      unsubscribe();
      
      // インターバルがあれば解除
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [setUser, setUserData, refreshUserData, fetchPapers]);
  
  // 定期的なユーザーデータ更新のインターバル設定
  // 依存配列から forceRefreshUserData を除外
  useEffect(() => {
    // 最初のロード時にはappReadyがfalseなのでスキップ
    if (!appReady || !auth.currentUser) return;
    
    // すでにインターバルが設定されていればスキップ
    if (updateIntervalRef.current) return;
    
    // 60秒ごとにユーザーデータを更新
    updateIntervalRef.current = setInterval(() => {
      const user = auth.currentUser;
      if (user) {
        console.log("Running scheduled user data refresh");
        // 直接refreshUserDataを呼び出して状態更新を最小限に
        refreshUserData(user.uid).catch(err => {
          console.error("Scheduled refresh failed:", err);
        });
      }
    }, 60000);
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [appReady, refreshUserData]);
  
  // アプリが初期化される前はローディング表示
  if (!appReady) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh'
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <RouteObserver />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
          }}
        >
          <Header />
          <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
            <Routes>
              <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/papers/:id" element={
                <ProtectedRoute>
                  <PaperViewPage />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              <Route path="/my-papers" element={
                <ProtectedRoute>
                  <MyPapersPage />
                </ProtectedRoute>
              } />
              <Route path="/subscription" element={
                <ProtectedRoute>
                  <SubscriptionPage />
                </ProtectedRoute>
              } />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/commerce" element={<CommercePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Box>
          <Footer />
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
