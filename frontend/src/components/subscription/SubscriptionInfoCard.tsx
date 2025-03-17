// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/SubscriptionInfoCard.tsx
import { Box, Typography, Button, Chip, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface SubscriptionInfoCardProps {
  userData: any;
}

const SubscriptionInfoCard: React.FC<SubscriptionInfoCardProps> = ({ userData }) => {
  const navigate = useNavigate();
  const isPaid = userData?.subscription_status === 'paid';
  const subscriptionEnd = userData?.subscription_end_date 
    ? new Date(userData.subscription_end_date.seconds * 1000) 
    : null;
  
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
        <Typography variant="body2" color="text.secondary">
          有効期限: {subscriptionEnd.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </Typography>
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