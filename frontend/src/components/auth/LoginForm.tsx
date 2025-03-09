// ~/Desktop/smart-paper-v2/frontend/src/components/auth/LoginForm.tsx
import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Link, 
  Divider, 
  CircularProgress,
  Alert,
  Paper,
  Snackbar
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

type LoginFormInputs = {
  email: string;
  password: string;
};

const LoginForm = () => {
  const { login, loginWithGoogle, error, loading, clearError } = useAuthStore();
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const navigate = useNavigate();
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    watch
  } = useForm<LoginFormInputs>({
    defaultValues: {
      email: '',
      password: ''
    }
  });
  
  const onSubmit: SubmitHandler<LoginFormInputs> = async (data) => {
    try {
      clearError();
      if (forgotPassword) {
        await useAuthStore.getState().resetPassword(data.email);
        setResetEmailSent(true);
        setSnackbarOpen(true);
      } else {
        await login(data.email, data.password);
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      // エラーはすでにstore内で設定されるのでここでは何もしない
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      clearError();
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };
  
  const toggleForgotPassword = () => {
    clearError();
    setForgotPassword(!forgotPassword);
    setResetEmailSent(false);
  };
  
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" align="center" gutterBottom>
        {forgotPassword ? 'パスワードをリセット' : 'ログイン'}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {resetEmailSent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          パスワードリセットメールを送信しました。メールをご確認ください。
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
        />
        
        {!forgotPassword && (
          <TextField
            label="パスワード"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            autoComplete="current-password"
            {...register('password', { 
              required: 'パスワードを入力してください',
              minLength: {
                value: 6,
                message: 'パスワードは6文字以上で入力してください'
              }
            })}
            error={!!errors.password}
            helperText={errors.password?.message}
          />
        )}
        
        <Button 
          type="submit" 
          variant="contained" 
          color="primary" 
          fullWidth 
          sx={{ mt: 2 }}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={24} />
          ) : forgotPassword ? (
            'リセットメールを送信'
          ) : (
            'ログイン'
          )}
        </Button>
      </form>
      
      <Box textAlign="center" mt={2}>
        <Link
          component="button"
          variant="body2"
          onClick={toggleForgotPassword}
        >
          {forgotPassword ? 'ログインに戻る' : 'パスワードをお忘れですか？'}
        </Link>
      </Box>
      
      {!forgotPassword && (
        <>
          <Divider sx={{ my: 3 }}>または</Divider>
          
          <Button
            variant="outlined"
            fullWidth
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            Googleでログイン
          </Button>
          
          <Box textAlign="center" mt={2}>
            <Typography variant="body2">
              アカウントをお持ちでない方は{' '}
              <Link href="/register">新規登録</Link>
            </Typography>
          </Box>
        </>
      )}
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message="パスワードリセットメールを送信しました"
      />
    </Paper>
  );
};

export default LoginForm;