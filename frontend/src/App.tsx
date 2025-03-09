// ~/Desktop/smart-paper-v2/frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
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
import RegisterPage from './pages/RegisterPage';
import PaperViewPage from './pages/PaperViewPage';
import ProfilePage from './pages/ProfilePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsPage from './pages/LegalPages/TermsPage';
import PrivacyPage from './pages/LegalPages/PrivacyPage';
import CommercePage from './pages/LegalPages/CommercePage';

// Firebase
import { auth, db } from './api/firebase';
import { useAuthStore } from './store/authStore';

// サブスクリプションページの仮実装
const SubscriptionPage = () => (
  <Box sx={{ p: 4 }}>
    <h1>サブスクリプションページ</h1>
    <p>このページは現在開発中です。</p>
  </Box>
);

// 認証が必要なルートのラッパーコンポーネント
// 認証なしでもアクセス可能に変更（開発中のため）
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
  
  // 開発中は認証をバイパス
  return <>{children}</>;
  
  // 本番用コード（未認証の場合はログインページにリダイレクト）
  // if (!user) {
  //   return <Navigate to="/login" />;
  // }
  // return <>{children}</>;
};

// DocumentData を UserData に変換する関数
const convertToUserData = (data: any) => {
  if (!data) return null;
  
  return {
    subscription_status: (data.subscription_status as 'none' | 'free' | 'paid') || 'none',
    subscription_end_date: data.subscription_end_date || null,
    name: data.name,
    email: data.email,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

function App() {
  const { setUser, setUserData } = useAuthStore();
  const [appReady, setAppReady] = useState(false);
  
  useEffect(() => {
    console.log("App initializing...");
    
    // Firebase Authの状態監視
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? `User: ${user.uid}` : "No user");
      setUser(user);
      
      if (user) {
        // ユーザーデータをFirestoreから取得
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            // 取得したデータを変換してからstoreにセット
            const userData = convertToUserData(docSnap.data());
            setUserData(userData);
            console.log("User data loaded:", userData);
          } else {
            console.log("No user data found in Firestore");
            setUserData(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      
      setAppReady(true);
    });
    
    // コンポーネントのアンマウント時にリスナーを解除
    return () => unsubscribe();
  }, [setUser, setUserData]);
  
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
              <Route path="/" element={<HomePage />} />
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
              <Route path="/subscription" element={<SubscriptionPage />} />
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