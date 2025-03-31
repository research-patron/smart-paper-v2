// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/Payment.tsx
import { useState, memo, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  AlertTitle,
  CircularProgress,
  Paper,
  Divider
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LockIcon from '@mui/icons-material/Lock';
import { redirectToCheckout } from '../../api/stripe';

interface PaymentProps {
  planId: string;
  onPaymentComplete?: () => void;
  onCancel?: () => void;
}

const Payment: React.FC<PaymentProps> = ({ planId, onPaymentComplete, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isAnnualPlan = planId === 'annual';
  const planAmount = useMemo(() => 
    isAnnualPlan ? '5,000' : '500',
    [isAnnualPlan]
  );
  
  // 支払いボタンのテキストをより明確な表現に変更
  const buttonText = useMemo(() => {
    if (loading) return '処理中...';
    return isAnnualPlan 
      ? `年額プランに登録する (¥${planAmount})` 
      : `月額プランに登録する (¥${planAmount})`;
  }, [loading, isAnnualPlan, planAmount]);
  
  const handleCheckout = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Stripeチェックアウトページにリダイレクト
      await redirectToCheckout(planId);
      
      // ここにはリダイレクト後は到達しない
      
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : '決済処理の開始に失敗しました。しばらくしてから再度お試しください。');
      setLoading(false);
    }
  };
  
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
          <AlertTitle>エラー</AlertTitle>
          {error}
        </Alert>
      )}
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>安全なお支払い</AlertTitle>
        <Typography variant="body2">
          お支払いはStripeの安全な決済ページで行われます。クレジットカード情報は当サイトでは保存されません。
        </Typography>
      </Alert>
      
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
          disabled={loading}
        >
          キャンセル
        </Button>
        
        <Button
          type="button"
          variant="contained"
          color="primary"
          disabled={loading}
          onClick={handleCheckout}
          startIcon={loading ? <CircularProgress size={16} /> : <CreditCardIcon />}
          sx={{ flex: 1 }}
        >
          {buttonText}
        </Button>
      </Box>
      
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          「{buttonText}」ボタンをクリックすることで、私たちの
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
    </Paper>
  );
};

// React.memoでコンポーネントをメモ化して不要な再レンダリングを防止
export default memo(Payment);