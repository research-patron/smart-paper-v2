// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/SubscriptionInfoCard.tsx
import { useState, memo } from 'react';
import { Box, Typography, Button, Chip, Paper, Divider, CircularProgress, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import StarIcon from '@mui/icons-material/Star';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArticleIcon from '@mui/icons-material/Article';
import { redirectToCardUpdate } from '../../api/stripe';

interface SubscriptionInfoCardProps {
  userData: any;
}

const SubscriptionInfoCard: React.FC<SubscriptionInfoCardProps> = ({ userData }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  if (!userData) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          現在のプラン
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold', flex: 1 }}>
            無料プラン
          </Typography>
          <Chip 
            label="基本" 
            size="small" 
            color="default"
          />
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={() => navigate('/subscription')}
          startIcon={<StarIcon />}
          sx={{ mt: 2 }}
        >
          プランをアップグレード
        </Button>
      </Paper>
    );
  }
  
  const isPaid = userData?.subscription_status === 'paid';
  const isCanceled = userData?.subscription_cancel_at_period_end === true;
  
  const subscriptionEnd = userData?.subscription_end_date 
    ? new Date(userData.subscription_end_date.seconds * 1000) 
    : null;
  
  // 次回の請求日を計算（実際にはAPIから取得するべき情報）
  const nextBillingDate = subscriptionEnd 
    ? new Date(subscriptionEnd.getTime()) // 期間終了日と同じと仮定
    : null;
  
  // 翻訳期間と回数の情報
  const translationCount = userData?.translation_count || 0;
  const translationLimit = isPaid ? '無制限' : '3';
  const translationPeriodStart = userData?.translation_period_start
    ? new Date(userData.translation_period_start.seconds * 1000)
    : null;
  const translationPeriodEnd = userData?.translation_period_end
    ? new Date(userData.translation_period_end.seconds * 1000)
    : null;
  
  // 使用率の計算 (無料会員の場合のみ)
  const usagePercentage = !isPaid ? Math.min((translationCount / 3) * 100, 100) : 0;
  
  // 日付のフォーマット関数
  const formatDate = (date: Date | null) => {
    if (!date) return '不明';
    
    try {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return '日付形式エラー';
    }
  };
  
  // サブスクリプションページへ移動
  const goToSubscriptionPage = () => {
    navigate('/subscription');
  };
  
  // 支払い方法の更新
  const handleUpdatePaymentMethod = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      // カード更新ページにリダイレクト
      await redirectToCardUpdate();
      
      // ここにはリダイレクト後は到達しない
      
    } catch (error) {
      console.error('Error updating payment method:', error);
      setLoading(false);
    }
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
          label={isPaid ? (isCanceled ? '期間終了時に解約' : 'アクティブ') : '基本'} 
          size="small" 
          color={isPaid ? (isCanceled ? 'warning' : 'primary') : 'default'}
        />
      </Box>
      
      {/* 翻訳使用状況の表示 - すべてのユーザーに表示 */}
      <Divider sx={{ my: 1.5 }} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <ArticleIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            月間翻訳使用状況
          </Typography>
          <Typography variant="body2">
            {isPaid 
              ? `無制限（${translationCount}件）` 
              : `${translationCount} / ${translationLimit}件`}
          </Typography>
        </Box>
      </Box>
      
      {/* 使用率プログレスバー (無料会員のみ表示) */}
      {!isPaid && (
        <Box sx={{ mt: 0.5, mb: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={usagePercentage} 
            color={usagePercentage >= 100 ? "error" : usagePercentage >= 75 ? "warning" : "primary"}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {translationPeriodStart && translationPeriodEnd ? 
              `有効期間: ${formatDate(translationPeriodStart)} 〜 ${formatDate(translationPeriodEnd)}` : 
              '翻訳期間: 未設定'
            }
          </Typography>
        </Box>
      )}
      
      {isPaid && subscriptionEnd && (
        <>          
          {/* 有効期限または次回更新日 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                {isCanceled ? 'サービス終了日' : 'プラン有効期限'}
              </Typography>
              <Typography variant="body2">
                {formatDate(subscriptionEnd)}
              </Typography>
            </Box>
          </Box>
          
          {/* 次回請求日（解約していない場合のみ表示） */}
          {!isCanceled && nextBillingDate && (
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
          
          {/* 自動更新状態 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <AutorenewIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                自動更新
              </Typography>
              <Typography variant="body2">
                {isCanceled ? '無効（期間終了時に解約）' : '有効'}
              </Typography>
            </Box>
          </Box>
          
          {/* 支払い方法変更ボタン */}
          <Box sx={{ mt: 2 }}>
            <Button
              startIcon={loading ? <CircularProgress size={16} /> : <CreditCardIcon />}
              variant="outlined"
              size="small"
              fullWidth
              onClick={handleUpdatePaymentMethod}
              disabled={loading}
            >
              {loading ? '処理中...' : '支払い方法を変更'}
            </Button>
          </Box>
        </>
      )}
      
      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={goToSubscriptionPage}
        startIcon={isPaid ? null : <StarIcon />}
        sx={{ mt: 2 }}
      >
        {isPaid ? 'サブスクリプションを管理' : 'プランをアップグレード'}
      </Button>
    </Paper>
  );
};

// React.memoでコンポーネントをメモ化して不要な再レンダリングを防止
export default memo(SubscriptionInfoCard);