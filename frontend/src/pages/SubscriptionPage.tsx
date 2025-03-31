// ~/Desktop/smart-paper-v2/frontend/src/pages/SubscriptionPage.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  CircularProgress,
  LinearProgress
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
import { cancelSubscription } from '../api/stripe';

// スライドトランジション
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// ユーザーデータの型定義を明示
interface UserData {
  subscription_status: 'free' | 'paid' | 'none'; // 'none'は後方互換性のために残す
  subscription_end_date: { seconds: number } | null;
  subscription_cancel_at_period_end?: boolean;
  subscription_plan?: string;
  name: string;
  email: string | null;
}

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, forceRefreshUserData } = useAuthStore();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingUserData, setRefreshingUserData] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // 初期化完了フラグを追加
  // 新しく追加: 支払い成功後のリトライ処理のための状態
  const [retryCount, setRetryCount] = useState(0);
  const [retryProgress, setRetryProgress] = useState(false);
  // 新しく追加: データ確定フラグ - 支払い成功後にユーザーデータが完全に更新されたかどうか
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const MAX_RETRIES = 0; // リトライなし（即時表示）
  const RETRY_DELAY = 2000; // リトライ間隔（ms）
  
  // データ更新タイマーと更新要求フラグ
  const updateTimerRef = useRef<number | null>(null);
  const dataUpdateRequestedRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  // 新規追加: リトライ処理を追跡するための参照
  const retryTimerRef = useRef<number | null>(null);
  const isRetryingRef = useRef(false);
  
  // URLパラメータからステータスを取得
  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isSuccess = urlParams.get('success') === 'true';
  const isCanceled = urlParams.get('canceled') === 'true';
  
  // ユーザー未認証の場合はログインページへリダイレクト
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { returnUrl: '/subscription' } });
    }
  }, [user, navigate]);
  
  // userDataがない場合のデフォルト値
  const defaultUserData: UserData = useMemo(() => ({
    subscription_status: 'free', // デフォルトは無料会員に
    subscription_end_date: null,
    subscription_plan: 'monthly', // デフォルト値を設定
    name: user?.displayName || user?.email?.split('@')[0] || 'ユーザー',
    email: user?.email || null
  }), [user]);

  // TypeScriptエラーを解消するために型アサーションを追加
  const effectiveUserData = useMemo<UserData>(() => 
    (userData as UserData) || defaultUserData, 
    [userData, defaultUserData]
  );
  
  const isPaid = effectiveUserData.subscription_status === 'paid';
  
  const subscriptionEnd = useMemo(() => {
    if (!effectiveUserData.subscription_end_date) return null;
    
    try {
      return new Date(effectiveUserData.subscription_end_date.seconds * 1000);
    } catch (error) {
      console.error('Error parsing subscription end date:', error);
      return null;
    }
  }, [effectiveUserData.subscription_end_date]);
  
  const steps = ['プラン選択', '支払い情報', '完了'];
  
  // effectiveUserDataが変更されたときにデータを確認
  useEffect(() => {
    if (effectiveUserData) {
      console.log("Current subscription plan:", effectiveUserData.subscription_plan);
      console.log("Current subscription status:", effectiveUserData.subscription_status);
      
      // 支払い成功後かつステータスが更新されている場合、データ確定フラグをセット
      if (paymentSuccess && selectedPlan) {
        if (selectedPlan === 'free' || effectiveUserData.subscription_status === 'paid') {
          setDataConfirmed(true);
        }
      }
    }
  }, [effectiveUserData, paymentSuccess, selectedPlan]);
  
  // メモ化した関数：ユーザーデータを強制更新
  const refreshUserData = useCallback(async () => {
    // 直前の更新から3秒以内なら何もしない
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 3000) {
      console.log('Throttling update request - too recent');
      return;
    }
    
    if (!user || refreshingUserData || !dataUpdateRequestedRef.current) return;
    
    // 更新要求フラグをリセット（二重実行防止）
    dataUpdateRequestedRef.current = false;
    lastUpdateTimeRef.current = now;
    
    setRefreshingUserData(true);
    try {
      console.log('Refreshing user data...');
      await forceRefreshUserData();
      console.log('User data refreshed successfully.');
    } catch (err) {
      console.error('Error refreshing user data:', err);
    } finally {
      setRefreshingUserData(false);
      
      // 安全のためタイマーをクリア
      if (updateTimerRef.current !== null) {
        window.clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    }
  }, [user, refreshingUserData, forceRefreshUserData]);
  
  // 新規追加: サブスクリプションステータス更新リトライ関数
  const retryRefreshUserData = useCallback(async () => {
    if (!user || isRetryingRef.current) return;
    
    // リトライカウンターを増やし、実行中フラグを設定
    isRetryingRef.current = true;
    const currentRetry = retryCount + 1;
    setRetryCount(currentRetry);
    setRetryProgress(true);
    
    try {
      console.log(`Retry ${currentRetry}/${MAX_RETRIES}: Refreshing user data...`);
      await forceRefreshUserData();
      
      // 更新後のステータスをチェック
      if (userData?.subscription_status === 'paid') {
        console.log('Success! Subscription status updated to paid.');
        isRetryingRef.current = false;
        setRetryProgress(false);
        setDataConfirmed(true); // データ確定フラグをセット
        return true; // 成功
      }
      
      console.log(`Retry ${currentRetry}/${MAX_RETRIES}: Status still ${userData?.subscription_status}`);
      
      // 最大リトライ回数をチェック
      if (currentRetry >= MAX_RETRIES) {
        console.log(`Maximum retries (${MAX_RETRIES}) reached. Stopping retries.`);
        isRetryingRef.current = false;
        setRetryProgress(false);
        // 最大リトライ回数に達しても更新されなかった場合でも、表示はする
        setDataConfirmed(true);
        return false; // 失敗
      }
      
      // 次のリトライをスケジュール
      retryTimerRef.current = window.setTimeout(() => {
        isRetryingRef.current = false; // フラグをリセット（次のリトライ用）
        setRetryCount(currentRetry);
        retryRefreshUserData();
      }, RETRY_DELAY);
      
      return false; // まだ成功していない
    } catch (err) {
      console.error(`Error during retry ${currentRetry}:`, err);
      
      // エラーが発生しても最大回数に達していなければリトライ
      if (currentRetry < MAX_RETRIES) {
        retryTimerRef.current = window.setTimeout(() => {
          isRetryingRef.current = false;
          retryRefreshUserData();
        }, RETRY_DELAY);
      } else {
        isRetryingRef.current = false;
        setRetryProgress(false);
        // 最大リトライ回数に達しても更新されなかった場合でも、表示はする
        setDataConfirmed(true);
      }
      
      return false;
    }
  }, [user, userData, retryCount, forceRefreshUserData]);
  
  // URLパラメータによる処理 - success=true の場合（リトライロジック追加）
  useEffect(() => {
    if (isSuccess && !paymentSuccess) {
      setActiveStep(2);
      setPaymentSuccess(true);
      
      // URLをクリーンアップ
      if (window.history && window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
      
      // 支払い成功時のユーザーデータ更新をリクエスト
      if (user) {
        // Webhookの処理完了を待つために少し待機してからデータ更新
        console.log('Payment success detected, updating user data in 3 seconds...');
        setTimeout(async () => {
          try {
            await forceRefreshUserData();
            // データ確定フラグを設定（リトライ無しの場合は即時表示）
            setDataConfirmed(true);
          } catch (err) {
            console.error('Error updating user data:', err);
            // エラーが発生しても表示は行う
            setDataConfirmed(true);
          }
        }, 3000);
      } else {
        // ユーザーがいない場合でも表示は行う
        setDataConfirmed(true);
      }
    }
  }, [isSuccess, user, forceRefreshUserData, paymentSuccess]);
  
  // URLパラメータによる処理 - canceled=true の場合
  useEffect(() => {
    if (isCanceled) {
      setActiveStep(0);
      setError('お支払いがキャンセルされました。別のプランを選択するか、再度お試しください。');
      
      // URLをクリーンアップ
      if (window.history && window.history.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [isCanceled]);
  
  // 初期化済みフラグの設定（マウント時に一度だけ）
  useEffect(() => {
    if (user && !isInitialized) {
      setIsInitialized(true);
    }
  }, [user, isInitialized]);
  
  // クリーンアップ: コンポーネントのアンマウント時に更新フラグとタイマーをリセット
  useEffect(() => {
    return () => {
      dataUpdateRequestedRef.current = false;
      isRetryingRef.current = false;
      
      if (updateTimerRef.current !== null) {
        window.clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);
  
  const handleSelectPlan = useCallback((planId: string, requiresPayment: boolean) => {
    setSelectedPlan(planId);
    
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
    
    // 無料会員プランを選択した場合
    if (planId === 'free') {
      // すでに無料会員ならメッセージだけ表示（または何もしない）
      // すでにボタンがdisabledになっているはずなので、ここには来ないはず
      return;
    }
  }, [isPaid]);
  
  const handleConfirmCancel = async () => {
    if (cancelLoading) return;
    
    try {
      setCancelLoading(true);
      setError(null);
      
      // サブスクリプションを解約
      const result = await cancelSubscription();
      
      // ダイアログを閉じる
      setCancelDialogOpen(false);
      
      if (result.canceled) {
        // データ更新をリクエスト
        dataUpdateRequestedRef.current = true;
        await refreshUserData();
        
        // 完了画面に進む
        setActiveStep(2);
        setPaymentSuccess(true);
        setDataConfirmed(true); // 解約は即時反映される
      }
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err instanceof Error ? err.message : 'サブスクリプションの解約に失敗しました');
    } finally {
      setCancelLoading(false);
    }
  };
  
  const handlePaymentComplete = () => {
    setActiveStep(2);
    setPaymentSuccess(true);
    // データ確定フラグをリセット - 支払い完了後に再度確認が必要
    setDataConfirmed(false);
  };
  
  const handleBackToPlans = () => {
    setActiveStep(0);
    setSelectedPlan(null);
  };
  
  const handleClose = () => {
    navigate('/');
  };

  // 支払い成功時のコンポーネント表示条件
  const showSuccessComponent = activeStep === 2 && paymentSuccess;

  // 支払い成功時のロード表示条件（データ未確定かつリトライ中またはデータ確認待ち）
  const showSuccessLoading = showSuccessComponent && !dataConfirmed && 
    (refreshingUserData || retryProgress || (selectedPlan !== 'free' && userData?.subscription_status !== 'paid'));
  
  // ユーザーが存在しない場合、ログインページにリダイレクト
  if (!user) {
    return null; // useEffectでリダイレクト処理をしているので、ここでは何も表示しない
  }
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        {/* ヘッダータイトル - paymentSuccessが真またはプレミアム会員の場合は表示しない */}
        {!paymentSuccess && !isPaid && (
          <Typography variant="h4" gutterBottom>
            あなたにぴったりのプランをお選びください
          </Typography>
        )}
        
        {refreshingUserData && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>ユーザー情報を更新中...</AlertTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography variant="body2">
                最新の会員情報を取得しています。しばらくお待ちください。
              </Typography>
            </Box>
          </Alert>
        )}
        
        {/* 支払い後のステータス更新中の表示 */}
        {retryProgress && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>決済処理の確認中...</AlertTitle>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                サブスクリプション情報を確認しています。完了まで少しお待ちください。
                これには最大30秒程度かかる場合があります。
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LinearProgress sx={{ flexGrow: 1, mr: 1 }} />
                <Typography variant="caption">
                  {retryCount}/{MAX_RETRIES}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                注: この処理はページを閉じても継続されます。あとで再確認いただくこともできます。
              </Typography>
            </Box>
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            <AlertTitle>エラー</AlertTitle>
            {error}
          </Alert>
        )}
        
        {/* 現在のプラン情報 - 有料会員の場合のみ表示 && 支払い成功画面でなければ表示 */}
        {isPaid && isInitialized && !paymentSuccess && (
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
                    secondary={effectiveUserData.subscription_plan === 'annual' 
                      ? "年額 ¥5,000（税込）" 
                      : "月額 ¥500（税込）"} 
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
                {!effectiveUserData.subscription_cancel_at_period_end && (
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="small"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? <CircularProgress size={20} /> : "サブスクリプションを解約"}
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
        {activeStep === 0 && !paymentSuccess && (
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
        
        {activeStep === 1 && selectedPlan && !paymentSuccess && (
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
            {/* データ未確定の場合はロード表示 */}
            {showSuccessLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={60} sx={{ mb: 3 }} />
                <Typography variant="h6" gutterBottom>
                  サブスクリプション情報を更新中...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  決済処理は完了しました。会員情報の更新まで少々お待ちください。
                </Typography>

              </Box>
            ) : (
              <>
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
                  {selectedPlan === 'free' || effectiveUserData.subscription_cancel_at_period_end ? (
                    <FreeBreakfastIcon sx={{ fontSize: 40, color: 'white' }} />
                  ) : (
                    <StarIcon sx={{ fontSize: 40, color: 'white' }} />
                  )}
                </Box>
                
                <Typography variant="h5" gutterBottom>
                  {effectiveUserData.subscription_cancel_at_period_end 
                    ? 'サブスクリプションの解約手続きが完了しました'
                    : selectedPlan === 'free' 
                      ? (isPaid ? 'プランを変更しました' : '無料会員プランにアップグレードしました')
                      : 'プレミアムプランへのアップグレードが完了しました！'}
                </Typography>
                
                <Typography variant="body1" paragraph>
                  {effectiveUserData.subscription_cancel_at_period_end
                    ? `サブスクリプションは ${subscriptionEnd ? subscriptionEnd.toLocaleDateString('ja-JP', {year: 'numeric', month: 'long', day: 'numeric'}) : '現在の支払い期間終了時'} まで有効です。その後は自動的に無料プランに切り替わります。`
                    : selectedPlan === 'free'
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
              </>
            )}
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
              disabled={cancelLoading}
            >
              {cancelLoading ? <CircularProgress size={20} /> : "解約する"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

// React.memoでコンポーネントをメモ化して不要な再レンダリングを防止
export default React.memo(SubscriptionPage);