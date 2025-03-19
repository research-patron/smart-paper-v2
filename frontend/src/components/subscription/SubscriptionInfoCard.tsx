// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/SubscriptionInfoCard.tsx
import { Box, Typography, Button, Chip, Paper, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CreditCardIcon from '@mui/icons-material/CreditCard';

interface SubscriptionInfoCardProps {
  userData: any;
}

const SubscriptionInfoCard: React.FC<SubscriptionInfoCardProps> = ({ userData }) => {
  const navigate = useNavigate();
  const isPaid = userData?.subscription_status === 'paid';
  const subscriptionEnd = userData?.subscription_end_date 
    ? new Date(userData.subscription_end_date.seconds * 1000) 
    : null;
  
  // サブスクリプション開始日（仮のデータ - 実際のアプリではこれを本物のデータに置き換える）
  const subscriptionStart = subscriptionEnd 
    ? new Date(subscriptionEnd.getTime() - (30 * 24 * 60 * 60 * 1000)) // 30日前と仮定
    : null;
  
  // 次回の請求日（仮のデータ - 実際のアプリではこれを本物のデータに置き換える）
  const nextBillingDate = subscriptionEnd 
    ? new Date(subscriptionEnd.getTime() - (3 * 24 * 60 * 60 * 1000)) // 3日前と仮定
    : null;
  
  // 日付のフォーマット関数
  const formatDate = (date: Date | null) => {
    if (!date) return '不明';
    
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        現在のプラン
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 'bold', flex: 1 }}>
          {isPaid ? 'プレミアムプラン' : '無料プラン'}
        </Typography>
        <Chip 
          label={isPaid ? 'アクティブ' : '基本'} 
          size="small" 
          color={isPaid ? 'primary' : 'default'}
        />
      </Box>
      
      {isPaid && subscriptionEnd && (
        <>
          <Divider sx={{ my: 1.5 }} />
          
          {/* サブスクリプション開始日 */}
          {subscriptionStart && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  ご利用開始日
                </Typography>
                <Typography variant="body2">
                  {formatDate(subscriptionStart)}
                </Typography>
              </Box>
            </Box>
          )}
          
          {/* 有効期限 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                プラン有効期限
              </Typography>
              <Typography variant="body2">
                {formatDate(subscriptionEnd)}
              </Typography>
            </Box>
          </Box>
          
          {/* 次回請求日 */}
          {nextBillingDate && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CreditCardIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  次回請求日
                </Typography>
                <Typography variant="body2">
                  {formatDate(nextBillingDate)}
                </Typography>
              </Box>
            </Box>
          )}
        </>
      )}
      
      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={() => navigate('/subscription')}
        sx={{ mt: 2 }}
      >
        {isPaid ? 'サブスクリプションを管理' : 'プランをアップグレード'}
      </Button>
    </Paper>
  );
};

export default SubscriptionInfoCard;