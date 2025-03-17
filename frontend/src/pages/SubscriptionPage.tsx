// ~/Desktop/smart-paper-v2/frontend/src/pages/SubscriptionPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { user, userData } = useAuthStore();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // userDataがない場合は、無料プランとして扱う
  // 必要な型定義の追加
  interface UserData {
    subscription_status: 'none' | 'free' | 'paid';
    subscription_end_date: { seconds: number } | null;
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
  
  useEffect(() => {
    // 未認証ユーザーはログインページにリダイレクト
    if (!user) {
      navigate('/login', { state: { returnUrl: '/subscription' } });
    }
  }, [user, navigate]);
  
  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    // 無料プランの場合は確認ダイアログを表示
    if (planId === 'free' && isPaid) {
      setCancelDialogOpen(true);
    } else {
      // 有料プランの場合は支払いステップへ
      setActiveStep(1);
    }
  };
  
  const handleConfirmCancel = () => {
    setCancelDialogOpen(false);
    // ダウングレード完了
    setActiveStep(2);
    setPaymentSuccess(true);
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
  
  // ユーザーが認証されていない場合はログインページにリダイレクト
  if (!user) {
    return (
      <Container maxWidth="md">
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <Typography>ログインが必要です。ログインページにリダイレクトします...</Typography>
          <Box sx={{ mt: 2 }}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => navigate('/login')}
            >
              ログインページへ
            </Button>
          </Box>
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" gutterBottom>
          あなたにぴったりのプランをお選びください
        </Typography>
        
        {isPaid ? (
          <Alert severity="info" sx={{ mb: 4 }}>
            現在、プレミアムプランをご利用中です。有効期限: {subscriptionEnd 
              ? subscriptionEnd.toLocaleDateString('ja-JP', {year: 'numeric', month: 'long', day: 'numeric'}) 
              : '無期限'}
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 4 }}>
            現在、無料プランをご利用中です。機能をフル活用するにはプレミアムプランへのアップグレードをご検討ください。
          </Alert>
        )}
        
        {/* 現在のプラン情報 */}
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
                    secondary="年額 ¥3,000（税込）" 
                  />
                </ListItem>
                
                <ListItem disablePadding sx={{ mt: 1 }}>
                  <EventIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText 
                    primary="次回更新日" 
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
                    secondary="クレジットカード（下4桁: 4242）" 
                  />
                </ListItem>
                
                <ListItem disablePadding sx={{ mt: 1 }}>
                  <AutorenewIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText 
                    primary="自動更新" 
                    secondary="有効" 
                  />
                </ListItem>
              </List>
              
              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  size="small"
                  onClick={() => {}}
                >
                  支払い方法を変更
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="small"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  サブスクリプションを解約
                </Button>
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
                ? 'プランを変更しました'
                : 'プレミアムプランへのアップグレードが完了しました！'}
            </Typography>
            
            <Typography variant="body1" paragraph>
              {selectedPlan === 'free'
                ? '無料プランに変更されました。サブスクリプションは現在の期間の終了時に終了します。'
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
            <Button onClick={handleConfirmCancel} color="error">
              解約する
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default SubscriptionPage;