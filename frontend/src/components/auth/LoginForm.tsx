// ~/Desktop/smart-paper-v2/frontend/src/components/auth/LoginForm.tsx
import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Divider, 
  CircularProgress,
  Alert,
  Paper,
  Link,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

type LoginFormInputs = {
  email: string;
  password: string;
  rememberMe: boolean;
};

interface LoginFormProps {
  enlargedSize?: boolean;
}

const LoginForm = ({ enlargedSize = false }: LoginFormProps) => {
  const { login, loginWithGoogle, error, loading, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [loginFailed, setLoginFailed] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors }
  } = useForm<LoginFormInputs>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  });
  
  const onSubmit: SubmitHandler<LoginFormInputs> = async (data) => {
    try {
      clearError();
      setLoginFailed(false);
      await login(data.email, data.password);
      navigate('/');
    } catch (err) {
      console.error(err);
      setLoginFailed(true);
    }
  };
  
  const handleGoogleLogin = async () => {
    try {
      clearError();
      setLoginFailed(false);
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
      setLoginFailed(true);
    }
  };
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: enlargedSize ? 5 : 4, // パディングを拡大
        maxWidth: enlargedSize ? 500 : 400, // 幅を拡大
        mx: 'auto',
        borderRadius: enlargedSize ? 3 : 2, // 角丸を調整
        boxShadow: enlargedSize ? 5 : 3 // 影を強調
      }}
    >
      <Typography 
        variant={enlargedSize ? "h4" : "h5"} 
        align="center" 
        gutterBottom
        sx={{ mb: enlargedSize ? 3 : 2 }} // 下余白を調整
      >
        ログイン
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {loginFailed && !error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ログインに失敗しました。メールアドレスまたはパスワードを確認してください。
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <TextField
          label="メールアドレス"
          variant="outlined"
          fullWidth
          margin="normal"
          size={enlargedSize ? "medium" : "small"} // フィールドサイズ調整
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
          sx={{ 
            mb: enlargedSize ? 2 : 1,
            '& .MuiInputBase-input': {
              fontSize: enlargedSize ? '1.1rem' : '1rem', // 入力フォントサイズを大きく
              padding: enlargedSize ? '14px 16px' : undefined // 入力エリアのパディングを大きく
            }
          }}
        />
        
        <TextField
          label="パスワード"
          type="password"
          variant="outlined"
          fullWidth
          margin="normal"
          size={enlargedSize ? "medium" : "small"} // フィールドサイズ調整
          autoComplete="current-password"
          {...register('password', { 
            required: 'パスワードを入力してください'
          })}
          error={!!errors.password}
          helperText={errors.password?.message}
          sx={{ 
            mb: enlargedSize ? 2 : 1,
            '& .MuiInputBase-input': {
              fontSize: enlargedSize ? '1.1rem' : '1rem', // 入力フォントサイズを大きく
              padding: enlargedSize ? '14px 16px' : undefined // 入力エリアのパディングを大きく
            }
          }}
        />
        
        <FormControlLabel
          control={
            <Checkbox
              {...register('rememberMe')}
              color="primary"
              size={enlargedSize ? "medium" : "small"} // チェックボックスサイズ調整
            />
          }
          label={
            <Typography variant={enlargedSize ? "body1" : "body2"}>
              ログイン状態を保存する
            </Typography>
          }
          sx={{ mb: 1 }}
        />
        
        <Button 
          type="submit" 
          variant="contained" 
          color="primary" 
          fullWidth 
          size={enlargedSize ? "large" : "medium"} // ボタンサイズ調整
          sx={{ 
            mt: 2,
            mb: 1,
            py: enlargedSize ? 1.5 : 1, // ボタンの高さ調整
            fontSize: enlargedSize ? '1.1rem' : '1rem' // フォントサイズ調整
          }}
          disabled={loading}
        >
          {loading ? <CircularProgress size={enlargedSize ? 28 : 24} /> : 'ログイン'}
        </Button>
      </form>
      
      <Divider sx={{ my: 3 }}>または</Divider>
      
      <Button
        variant="outlined"
        fullWidth
        size={enlargedSize ? "large" : "medium"} // ボタンサイズ調整
        startIcon={<GoogleIcon />}
        onClick={handleGoogleLogin}
        disabled={loading}
        sx={{ 
          py: enlargedSize ? 1.5 : 1, // ボタンの高さ調整
          fontSize: enlargedSize ? '1.1rem' : '1rem' // フォントサイズ調整
        }}
      >
        Googleでログイン
      </Button>
      
      <Box textAlign="center" mt={3}>
        <Typography variant={enlargedSize ? "body1" : "body2"} gutterBottom>
          アカウントをお持ちでない方は{' '}
          <Link href="/register">会員登録</Link>
        </Typography>
        <Typography variant={enlargedSize ? "body1" : "body2"}>
          <Link href="/reset-password">パスワードをお忘れですか？</Link>
        </Typography>
      </Box>
    </Paper>
  );
};

export default LoginForm;