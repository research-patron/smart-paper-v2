// ~/Desktop/smart-paper-v2/frontend/src/pages/SubscriptionPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Slide,
  CircularProgress
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import EventIcon from '@mui/icons-material/Event';
import StarIcon from '@mui/icons-material/Star';
import PeopleIcon from '@mui/icons-material/People';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import React from 'react';
import { useAuthStore } from '../store/authStore';
import Plans from '../components/subscription/Plans';
import Payment from '../components/subscription/Payment';
import { cancelSubscription, redirectToCardUpdate } from '../api/stripe';

// スライドトランジション
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, updateUserData } = useAuthStore();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // URLパラメータからステータスを取得
  const urlParams = new URLSearchParams(location.search);
  const isSuccess = urlParams.get('success') === 'true';
  const isCanceled = urlParams.get('canceled') === 'true';
  
  // userDataがない場合は、無料プランとして扱う
  // 必要な型定義の追加
  interface UserData {
    subscription_status: 'none' | 'free' | 'paid';
    subscription_end_date: { seconds: number } | null;
    subscription_cancel_at_period_end?: boolean;
    name: string;
    email: string | null;
  }

  const defaultUserData: UserData = {
    subscription_status: 'none',
    subscription_end_date: null,
    name: user?.displayName || user?.email?.split('@')[0] || 'ユーザー',
    email: user?.email || null
  };

  const effectiveUserData = userData as UserData || defaultUserData;
  
  const isPaid = effectiveUserData.subscription_status === 'paid';
  const subscriptionEnd = effectiveUserData.subscription_end_date
    ? new Date(effectiveUserData.subscription_end_date.seconds * 1000)
    : null;
  
  const steps = ['プラン選択', '支払い情報', '完了'];
  
  // URLパラメータに基づいて支払い完了ステップを設定
  useEffect(() => {
    if (isSuccess) {
      setActiveStep(2);
      setPaymentSuccess(true);
      
      // URLをクリーンアップ
      if (window.history && window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
      
      // ユーザーデータを更新
      if (user) {
        updateUserData();
      }
    } else if (isCanceled) {
      setActiveStep(0);
      setError('お支払いがキャンセルされました。別のプランを選択するか、再度お試しください。');
      
      // URLをクリーンアップ
      if (window.history && window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [isSuccess, isCanceled, user, updateUserData]);
  
  useEffect(() => {
    // ステップが支払いか完了の場合に未認証ユーザーはログインページにリダイレクト
    if (activeStep > 0 && !user) {
      navigate('/login', { state: { returnUrl: '/subscription' } });
    }
  }, [user, navigate, activeStep]);
  
  const handleSelectPlan = (planId: string, requiresPayment: boolean) => {
    setSelectedPlan(planId);
    
    // 未ログインユーザーが無料会員を選択した場合、ログインを促す
    if (!user && planId === 'free') {
      setRegisterDialogOpen(true);
      return;
    }
    
    // 未ログインユーザーがプレミアムプランを選択した場合、ログインを促す
    if (!user && requiresPayment) {
      setRegisterDialogOpen(true);
      return;
    }
    
    // 有料会員が無料プランを選択した場合、解約確認ダイアログを表示
    if (planId === 'free' && isPaid) {
      setCancelDialogOpen(true);
      return;
    } 
    
    // 有料プランが選択された場合、支払い画面に進む
    if (requiresPayment) {
      setActiveStep(1);
      return;
    }
    
    // 非会員または無料会員がプランを選択した場合
    if (planId === 'free') {
      if (!userData || userData.subscription_status === 'none') {
        // 非会員→無料会員の場合、すでにログイン済みなら直接完了画面へ
        setActiveStep(2);
        setPaymentSuccess(true);
      } else {
        // すでに無料会員ならメッセージだけ表示（または何もしない）
        // すでにボタンがdisabledになっているはずなので、ここには来ないはず
      }
      return;
    }
  };
  
  const handleConfirmCancel = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // サブスクリプションを解約
      const result = await cancelSubscription();
      
      // ダイアログを閉じる
      setCancelDialogOpen(false);
      
      if (result.canceled) {
        // ユーザーデータを更新
        await updateUserData();
        
        // 完了画面に進む
        setActiveStep(2);
        setPaymentSuccess(true);
      }
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err instanceof Error ? err.message : 'サブスクリプションの解約に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegisterConfirm = () => {
    setRegisterDialogOpen(false);
    // ログインページにリダイレクト
    navigate('/login', { state: { returnUrl: '/subscription' } });
  };
  
  const handlePaymentComplete = () => {
    setActiveStep(2);
    setPaymentSuccess(true);
  };
  
  const handleBackToPlans = () => {
    setActiveStep(0);
    setSelectedPlan(null);
  };
  
  const handleClose = () => {
    navigate('/');
  };
  
  const handleUpdatePaymentMethod = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 支払い方法更新ページにリダイレクト
      await redirectToCardUpdate();
      
      // ここにはリダイレクト後は到達しない
      
    } catch (err) {
      console.error('Error updating payment method:', err);
      setError(err instanceof Error ? err.message : '支払い方法の更新に失敗しました');
      setLoading(false);
    }
  };
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" gutterBottom>
          あなたにぴったりのプランをお選びください
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            <AlertTitle>エラー</AlertTitle>
            {error}
          </Alert>
        )}
        
        {isPaid ? (
          <Alert severity="info" sx={{ mb: 4 }}>
            <AlertTitle>プレミアムプラン利用中</AlertTitle>
            <Typography variant="body2">
              現在、プレミアムプランをご利用中です。有効期限: {subscriptionEnd 
                ? subscriptionEnd.toLocaleDateString('ja-JP', {year: 'numeric', month: 'long', day: 'numeric'}) 
                : '無期限'}
            </Typography>
            
            {effectiveUserData.subscription_cancel_at_period_end && (
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                このサブスクリプションは期間終了時に自動更新されず、無料プランに戻ります。
              </Typography>
            )}
          </Alert>
        ) : user ? (
          <Alert severity="info" sx={{ mb: 4 }}>
            <AlertTitle>無料プラン利用中</AlertTitle>
            <Typography variant="body2">
              現在、無料プランをご利用中です。機能をフル活用するにはプレミアムプランへのアップグレードをご検討ください。
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 4 }}>
            <AlertTitle>非会員の方へ</AlertTitle>
            <Typography variant="body2">
              非会員としてご利用中です。無料会員になるには会員登録が必要です。プレミアム機能を利用するには有料プランへのアップグレードをご検討ください。
            </Typography>
          </Alert>
        )}
        
        {/* 現在のプラン情報 - 有料会員の場合のみ表示 */}
        {isPaid && (
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StarIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  プレミアムプラン
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    ml: 1, 
                    bgcolor: 'primary.main', 
                    color: 'white', 
                    px: 1, 
                    py: 0.5, 
                    borderRadius: 1 
                  }}
                >
                  アクティブ
                </Typography>
              </Box>
              
              <List disablePadding>
                <ListItem disablePadding>
                  <ReceiptIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText 
                    primary="料金プラン" 
                    secondary={subscriptionEnd && effectiveUserData.subscription_end_date 
                      ? (new Date(effectiveUserData.subscription_end_date.seconds * 1000).getMonth() - new Date().getMonth() + 12) % 12 >= 11
                        ? "年額 ¥3,000（税込）" 
                        : "月額 ¥300（税込）"
                      : "プレミアムプラン"} 
                  />
                </ListItem>
                
                <ListItem disablePadding sx={{ mt: 1 }}>
                  <EventIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText 
                    primary={effectiveUserData.subscription_cancel_at_period_end ? "サービス終了日" : "次回更新日"} 
                    secondary={subscriptionEnd ? 
                      subscriptionEnd.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) 
                      : '無期限'} 
                  />
                </ListItem>
                
                <ListItem disablePadding sx={{ mt: 1 }}>
                  <PaymentIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText 
                    primary="支払い方法" 
                    secondary="クレジットカード" 
                  />
                </ListItem>
                
                <ListItem disablePadding sx={{ mt: 1 }}>
                  <AutorenewIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText 
                    primary="自動更新" 
                    secondary={effectiveUserData.subscription_cancel_at_period_end ? "無効（期間終了時に解約）" : "有効"} 
                  />
                </ListItem>
              </List>
              
              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  size="small"
                  onClick={handleUpdatePaymentMethod}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={20} /> : "支払い方法を変更"}
                </Button>
                
                {!effectiveUserData.subscription_cancel_at_period_end && (
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="small"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={20} /> : "サブスクリプションを解約"}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        )}
        
        {/* ステップ表示（フローがアクティブな場合のみ表示） */}
        {activeStep > 0 && !paymentSuccess && (
          <Box sx={{ mb: 4 }}>
            <Stepper activeStep={activeStep - 1} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}
        
        {/* ステップコンテンツ */}
        {activeStep === 0 && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              プラン選択
            </Typography>
            <Plans 
              onSelectPlan={handleSelectPlan}
              selectedPlan={selectedPlan || undefined}
            />
          </>
        )}
        
        {activeStep === 1 && selectedPlan && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              支払い情報
            </Typography>
            <Payment 
              planId={selectedPlan}
              onPaymentComplete={handlePaymentComplete}
              onCancel={handleBackToPlans}
            />
          </>
        )}
        
        {activeStep === 2 && paymentSuccess && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Box sx={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              bgcolor: 'success.light', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto',
              mb: 3
            }}>
              {selectedPlan === 'free' ? (
                <FreeBreakfastIcon sx={{ fontSize: 40, color: 'white' }} />
              ) : (
                <StarIcon sx={{ fontSize: 40, color: 'white' }} />
              )}
            </Box>
            
            <Typography variant="h5" gutterBottom>
              {selectedPlan === 'free' 
                ? (isPaid ? 'プランを変更しました' : '無料会員プランにアップグレードしました')
                : 'プレミアムプランへのアップグレードが完了しました！'}
            </Typography>
            
            <Typography variant="body1" paragraph>
              {selectedPlan === 'free'
                ? (isPaid 
                   ? '無料プランに変更されました。サブスクリプションは現在の期間の終了時に終了します。' 
                   : '無料会員プランへアップグレードされました。より多くの機能をご利用いただけます。')
                : 'おめでとうございます！すべての機能を無制限でご利用いただけるようになりました。'}
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleClose}
              >
                ホームに戻る
              </Button>
            </Box>
          </Paper>
        )}
        
        {!paymentSuccess && (
          <>
            <Divider sx={{ my: 4 }} />
            
            <Typography variant="h5" gutterBottom>
              プラン比較
            </Typography>
            
            <Plans showComparisonOnly />
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                startIcon={<PeopleIcon />}
                variant="outlined"
                href="https://github.com/your-repository/issues/new"
                target="_blank"
              >
                質問・問い合わせ
              </Button>
            </Box>
          </>
        )}
        
        {/* 解約確認ダイアログ */}
        <Dialog
          open={cancelDialogOpen}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => setCancelDialogOpen(false)}
        >
          <DialogTitle>サブスクリプションを解約しますか？</DialogTitle>
          <DialogContent>
            <DialogContentText>
              サブスクリプションを解約すると、現在の請求期間の終了時に無料プランに戻ります。それまでは引き続きプレミアムプランの特典をお楽しみいただけます。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleConfirmCancel} 
              color="error"
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : "解約する"}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* 会員登録促進ダイアログ */}
        <Dialog
          open={registerDialogOpen}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => setRegisterDialogOpen(false)}
        >
          <DialogTitle>会員登録が必要です</DialogTitle>
          <DialogContent>
            <DialogContentText>
              このプランを利用するには会員登録が必要です。登録またはログインして続行しますか？
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRegisterDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleRegisterConfirm} color="primary">
              登録/ログインへ進む
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default SubscriptionPage;