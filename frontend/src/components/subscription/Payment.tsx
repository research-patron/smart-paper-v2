// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/Payment.tsx
import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  Divider,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LockIcon from '@mui/icons-material/Lock';
import EventIcon from '@mui/icons-material/Event';
import SecurityIcon from '@mui/icons-material/Security';

interface PaymentProps {
  planId: string;
  onPaymentComplete?: () => void;
  onCancel?: () => void;
}

const Payment: React.FC<PaymentProps> = ({ planId, onPaymentComplete, onCancel }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [saveCard, setSaveCard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const isAnnualPlan = planId === 'annual';
  const planAmount = isAnnualPlan ? '3,000' : '300';
  
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    setExpiry(value);
  };
  
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    let formattedValue = '';
    
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formattedValue += ' ';
      }
      formattedValue += value[i];
    }
    
    setCardNumber(formattedValue);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // 入力検証
    if (!cardNumber || !cardName || !expiry || !cvc) {
      setError('すべての項目を入力してください');
      setLoading(false);
      return;
    }
    
    // 実際にはStripe等の決済処理が行われますが、ここではモックで成功を返します
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      
      // 1秒後に完了コールバックを呼び出す
      setTimeout(() => {
        if (onPaymentComplete) {
          onPaymentComplete();
        }
      }, 1000);
    }, 2000);
  };
  
  if (success) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          支払いが完了しました！
        </Alert>
        <Typography variant="body1" paragraph>
          ありがとうございます。プレミアムプランへのアップグレードが完了しました。
        </Typography>
        <CircularProgress size={20} sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          ページをリロードしています...
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        お支払い情報
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {isAnnualPlan ? '年額プラン' : '月額プラン'}
          </Typography>
          <Typography variant="h6">
            ¥{planAmount}{isAnnualPlan ? '/年' : '/月'}
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">
            お支払い金額
          </Typography>
          <Typography variant="h6">
            ¥{planAmount}
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <form onSubmit={handleSubmit}>
        <TextField
          label="カード番号"
          value={cardNumber}
          onChange={handleCardNumberChange}
          fullWidth
          margin="normal"
          placeholder="1234 5678 9012 3456"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CreditCardIcon />
              </InputAdornment>
            ),
          }}
          inputProps={{ maxLength: 19 }}
        />
        
        <TextField
          label="カード名義人"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          fullWidth
          margin="normal"
          placeholder="TARO YAMADA"
        />
        
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <TextField
            label="有効期限"
            value={expiry}
            onChange={handleExpiryChange}
            placeholder="MM/YY"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EventIcon />
                </InputAdornment>
              ),
            }}
            inputProps={{ maxLength: 5 }}
            sx={{ flex: 1 }}
          />
          
          <TextField
            label="CVC"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
            placeholder="123"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SecurityIcon />
                </InputAdornment>
              ),
            }}
            inputProps={{ maxLength: 4 }}
            sx={{ flex: 1 }}
          />
        </Box>
        
        <FormControlLabel
          control={
            <Checkbox
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              color="primary"
            />
          }
          label="カード情報を保存する"
          sx={{ mt: 1 }}
        />
        
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 2 }}>
          <LockIcon color="action" fontSize="small" />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            お支払い情報は安全に暗号化されます
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            type="button"
            variant="outlined"
            onClick={onCancel}
            sx={{ flex: 1 }}
          >
            キャンセル
          </Button>
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ flex: 1 }}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              `¥${planAmount}を支払う`
            )}
          </Button>
        </Box>
        
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            「¥{planAmount}を支払う」ボタンをクリックすることで、私たちの
            <Button variant="text" size="small" sx={{ p: 0, minWidth: 'auto', textTransform: 'none' }}>
              利用規約
            </Button>
            および
            <Button variant="text" size="small" sx={{ p: 0, minWidth: 'auto', textTransform: 'none' }}>
              プライバシーポリシー
            </Button>
            に同意したものとみなされます。
          </Typography>
        </Box>
      </form>
    </Paper>
  );
};

export default Payment;