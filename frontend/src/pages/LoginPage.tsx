// ~/Desktop/smart-paper-v2/frontend/src/pages/LoginPage.tsx
import { useEffect } from 'react';
import { Container, Typography, Box } from '@mui/material';
import LoginForm from '../components/auth/LoginForm';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // すでにログインしている場合はホームページにリダイレクト
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <Container maxWidth="sm">
      <Box mt={4} textAlign="center">
        <Typography variant="h4" component="h1" gutterBottom>
          Smart Paper v2
        </Typography>
        <Typography variant="subtitle1" color="textSecondary" gutterBottom>
          英語論文を簡単に翻訳・要約・管理
        </Typography>
      </Box>
      <LoginForm />
    </Container>
  );
};

export default LoginPage;