// ~/Desktop/smart-paper-v2/frontend/src/pages/EmailVerificationPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  AlertTitle,
  CircularProgress,
  Divider
} from '@mui/material';
import { useAuthStore } from '../store/authStore';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const EmailVerificationPage: React.FC = () => {
  const { 
    user, 
    loading, 
    error, 
    sendVerificationEmail, 
    updateEmailVerificationStatus,
    isEmailVerified
  } = useAuthStore();
  const navigate = useNavigate();
  
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  // メール確認状態をチェック
  const checkVerificationStatus = async () => {
    setCheckingStatus(true);
    try {
      await updateEmailVerificationStatus();
      // 認証状態を確認
      if (isEmailVerified()) {
        // 認証されていればホームページにリダイレクト
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };
  
  // 認証メールを再送信
  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await sendVerificationEmail();
      setResendSuccess(true);
    } catch (error) {
      console.error('Error resending verification email:', error);
    } finally {
      setResendLoading(false);
    }
  };
  
  // コンポーネントマウント時に認証状態をチェック
  useEffect(() => {
    if (user) {
      checkVerificationStatus();
    }
  }, [user]);
  
  // ユーザーがいない場合はログインページにリダイレクト
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);
  
  // すでに認証されている場合はホームページにリダイレクト
  useEffect(() => {
    if (!loading && user && isEmailVerified()) {
      navigate('/');
    }
  }, [loading, user, isEmailVerified, navigate]);
  
  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box sx={{ mb: 3 }}>
            <EmailIcon color="primary" sx={{ fontSize: 64 }} />
          </Box>
          
          <Typography variant="h5" gutterBottom>
            メールアドレスの確認
          </Typography>
          
          <Typography variant="body1" paragraph>
            {user?.email} 宛に確認メールを送信しました。
            メール内のリンクをクリックして、アカウントを有効化してください。
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3, mt: 2 }}>
              <AlertTitle>エラー</AlertTitle>
              {error}
            </Alert>
          )}
          
          {resendSuccess && (
            <Alert severity="success" sx={{ mb: 3, mt: 2 }}>
              <AlertTitle>送信完了</AlertTitle>
              確認メールを再送信しました。メールをご確認ください。
            </Alert>
          )}
          
          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={checkVerificationStatus}
              disabled={checkingStatus}
              startIcon={<CheckCircleIcon />}
              sx={{ mb: 2 }}
            >
              {checkingStatus ? <CircularProgress size={24} /> : '認証状態を確認する'}
            </Button>
            
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              onClick={handleResendVerification}
              disabled={resendLoading}
              startIcon={<EmailIcon />}
            >
              {resendLoading ? <CircularProgress size={24} /> : '確認メールを再送信する'}
            </Button>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              メールが届かない場合は、迷惑メールフォルダをご確認いただくか、
              別のメールアドレスで再登録してください。
            </Typography>
            
            <Button
              variant="text"
              color="error"
              onClick={() => navigate('/login')}
              startIcon={<ErrorOutlineIcon />}
            >
              ログイン画面に戻る
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default EmailVerificationPage;