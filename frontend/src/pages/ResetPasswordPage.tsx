// ~/Desktop/smart-paper-v2/frontend/src/pages/ResetPasswordPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuthStore } from '../store/authStore';
import { useForm, SubmitHandler } from 'react-hook-form';

type ResetPasswordInputs = {
  email: string;
};

const ResetPasswordPage = () => {
  const { resetPassword, error, loading, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [resetSent, setResetSent] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<ResetPasswordInputs>({
    defaultValues: {
      email: ''
    }
  });
  
  const onSubmit: SubmitHandler<ResetPasswordInputs> = async (data) => {
    try {
      clearError();
      await resetPassword(data.email);
      setResetSent(true);
    } catch (err) {
      console.error(err);
      // エラーはuseAuthStoreで処理されるのでここでは何もしない
    }
  };
  
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          戻る
        </Button>
        
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" align="center" gutterBottom>
            パスワードリセット
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            登録したメールアドレスを入力してください。パスワードリセット用のリンクを送信します。
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {resetSent && (
            <Alert severity="success" sx={{ mb: 2 }}>
              パスワードリセット用のメールを送信しました。メールをご確認ください。
            </Alert>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              label="メールアドレス"
              variant="outlined"
              fullWidth
              margin="normal"
              autoComplete="email"
              {...register('email', { 
                required: 'メールアドレスを入力してください', 
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: '有効なメールアドレスを入力してください'
                }
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
              disabled={resetSent}
            />
            
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              fullWidth 
              sx={{ mt: 3 }}
              disabled={loading || resetSent}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                'リセットメールを送信'
              )}
            </Button>
            
            {resetSent && (
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => navigate('/login')}
              >
                ログインページに戻る
              </Button>
            )}
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPasswordPage;