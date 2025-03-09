// ~/Desktop/smart-paper-v2/frontend/src/components/auth/RegisterForm.tsx
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

type RegisterFormInputs = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
};

const RegisterForm = () => {
  const { register: registerUser, loginWithGoogle, error, loading, clearError } = useAuthStore();
  const [registered, setRegistered] = useState(false);
  const navigate = useNavigate();
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    watch
  } = useForm<RegisterFormInputs>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false
    }
  });
  
  const password = watch('password');
  
  const onSubmit: SubmitHandler<RegisterFormInputs> = async (data) => {
    try {
      clearError();
      await registerUser(data.email, data.password, data.name);
      setRegistered(true);
      // 登録成功後、ホームページにリダイレクト
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error(err);
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
  
  // パスワード強度チェック
  const getPasswordStrength = (password: string): number => {
    if (!password) return 0;
    
    let strength = 0;
    
    // 長さチェック
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    
    // 複雑さチェック
    if (/[A-Z]/.test(password)) strength += 1; // 大文字
    if (/[a-z]/.test(password)) strength += 1; // 小文字
    if (/[0-9]/.test(password)) strength += 1; // 数字
    if (/[^A-Za-z0-9]/.test(password)) strength += 1; // 特殊文字
    
    return Math.min(strength, 5); // 最大5とする
  };
  
  const passwordStrength = getPasswordStrength(watch('password'));
  
  const getPasswordStrengthLabel = (strength: number): string => {
    switch (strength) {
      case 0: return '非常に弱い';
      case 1: return '弱い';
      case 2: return 'やや弱い';
      case 3: return '普通';
      case 4: return '強い';
      case 5: return '非常に強い';
      default: return '';
    }
  };
  
  const getPasswordStrengthColor = (strength: number): string => {
    switch (strength) {
      case 0: return '#f44336'; // red
      case 1: return '#ff9800'; // orange
      case 2: return '#ffeb3b'; // yellow
      case 3: return '#4caf50'; // green
      case 4: return '#2196f3'; // blue
      case 5: return '#673ab7'; // deep purple
      default: return '#e0e0e0';
    }
  };
  
  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" align="center" gutterBottom>
        会員登録
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {registered && (
        <Alert severity="success" sx={{ mb: 2 }}>
          登録が完了しました。ホームページにリダイレクトします...
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <TextField
          label="名前"
          variant="outlined"
          fullWidth
          margin="normal"
          autoComplete="name"
          {...register('name', { required: '名前を入力してください' })}
          error={!!errors.name}
          helperText={errors.name?.message}
        />
        
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
        
        <TextField
          label="パスワード"
          type="password"
          variant="outlined"
          fullWidth
          margin="normal"
          autoComplete="new-password"
          {...register('password', { 
            required: 'パスワードを入力してください',
            minLength: {
              value: 6,
              message: 'パスワードは6文字以上で入力してください'
            }
          })}
          error={!!errors.password}
          helperText={errors.password?.message || (
            password ? (
              <Box>
                <Typography variant="caption" display="block">
                  強度: {getPasswordStrengthLabel(passwordStrength)}
                </Typography>
                <Box 
                  sx={{ 
                    mt: 0.5, 
                    height: 4, 
                    width: '100%', 
                    bgcolor: '#e0e0e0',
                    borderRadius: 2
                  }}
                >
                  <Box 
                    sx={{ 
                      height: '100%', 
                      width: `${passwordStrength * 20}%`,
                      bgcolor: getPasswordStrengthColor(passwordStrength),
                      borderRadius: 2,
                      transition: 'width 0.3s, background-color 0.3s'
                    }} 
                  />
                </Box>
              </Box>
            ) : undefined
          )}
        />
        
        <TextField
          label="パスワード（確認）"
          type="password"
          variant="outlined"
          fullWidth
          margin="normal"
          autoComplete="new-password"
          {...register('confirmPassword', { 
            required: 'パスワードを再入力してください',
            validate: value => value === password || 'パスワードが一致しません'
          })}
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
        />
        
        <FormControlLabel
          control={
            <Checkbox
              {...register('termsAccepted', { 
                required: '利用規約とプライバシーポリシーに同意してください' 
              })}
              color="primary"
            />
          }
          label={
            <Typography variant="body2">
              <Link href="/terms" target="_blank">利用規約</Link>と
              <Link href="/privacy" target="_blank">プライバシーポリシー</Link>に同意します
            </Typography>
          }
        />
        {errors.termsAccepted && (
          <Typography variant="caption" color="error">
            {errors.termsAccepted.message}
          </Typography>
        )}
        
        <Button 
          type="submit" 
          variant="contained" 
          color="primary" 
          fullWidth 
          sx={{ mt: 2 }}
          disabled={loading || registered}
        >
          {loading ? <CircularProgress size={24} /> : '登録する'}
        </Button>
      </form>
      
      <Divider sx={{ my: 3 }}>または</Divider>
      
      <Button
        variant="outlined"
        fullWidth
        startIcon={<GoogleIcon />}
        onClick={handleGoogleLogin}
        disabled={loading || registered}
      >
        Googleで登録
      </Button>
      
      <Box textAlign="center" mt={2}>
        <Typography variant="body2">
          すでにアカウントをお持ちですか？{' '}
          <Link href="/login">ログイン</Link>
        </Typography>
      </Box>
    </Paper>
  );
};

export default RegisterForm;