// ~/Desktop/smart-paper-v2/frontend/src/pages/ProfilePage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Divider,
  Grid,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookIcon from '@mui/icons-material/Book';
import StarIcon from '@mui/icons-material/Star';
import PaymentIcon from '@mui/icons-material/Payment';
import ArticleIcon from '@mui/icons-material/Article';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useAuthStore } from '../store/authStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import ObsidianSettings from '../components/obsidian/Settings';
import SubscriptionInfoCard from '../components/subscription/SubscriptionInfoCard';

// タブパネルの型定義
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// タブパネルコンポーネント
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const ProfilePage = () => {
  const { user, userData, logout, forceRefreshUserData, loading } = useAuthStore();
  const navigate = useNavigate();
  
  const [editMode, setEditMode] = useState(false);
  const [userName, setUserName] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [dataInitialized, setDataInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // デバウンスと重複実行防止のための参照
  const isUpdatingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  
  // userDataが変更されたらuserNameも更新（依存配列を最適化）
  useEffect(() => {
    if (userData && !dataInitialized) {
      setUserName(userData.name || user?.displayName || '');
      setDataInitialized(true);
    }
  }, [userData, user, dataInitialized]);

  // タブの切り替え
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // データ更新のスロットル付き関数
  const refreshUserData = useCallback(async () => {
    // 最後の更新から3秒以内または更新中ならスキップ
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 3000 || isUpdatingRef.current || isRefreshing) {
      console.log('Skipping redundant user data update');
      return;
    }
    
    try {
      setIsRefreshing(true);
      isUpdatingRef.current = true;
      lastUpdateTimeRef.current = now;
      
      await forceRefreshUserData();
      console.log('User data refreshed successfully');
      
    } catch (err) {
      console.error('Failed to refresh user data:', err);
    } finally {
      setIsRefreshing(false);
      isUpdatingRef.current = false;
    }
  }, [forceRefreshUserData, isRefreshing]);
  
  // ユーザー名を更新
  const handleUpdateUserName = async () => {
    if (!user) return;
    
    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: userName,
        updated_at: new Date()
      });
      
      // ユーザーデータを再取得
      await refreshUserData();
      
      setUpdateSuccess(true);
      setEditMode(false);
    } catch (error) {
      console.error('Error updating user name:', error);
      setUpdateError('ユーザー名の更新に失敗しました。');
    } finally {
      setUpdateLoading(false);
    }
  };
  
  // ログアウトを実行
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // サブスクリプションの表示テキストを取得
  const getSubscriptionText = useCallback(() => {
    if (!userData) return '非会員';
    
    switch (userData.subscription_status) {
      case 'paid':
        return '有料会員';
      case 'free':
        return '無料会員';
      default:
        return '非会員';
    }
  }, [userData]);
  
  // サブスクリプションの期限を表示
  const getSubscriptionEndDate = useCallback(() => {
    if (!userData || !userData.subscription_end_date) return '無期限';
    
    try {
      // Firestoreの Timestamp 型を適切に処理
      let date;
      if (typeof userData.subscription_end_date.toDate === 'function') {
        // Firestoreの Timestamp オブジェクトの場合
        date = userData.subscription_end_date.toDate();
      } else if (userData.subscription_end_date instanceof Date) {
        // JavaScript の Date オブジェクトの場合
        date = userData.subscription_end_date;
      } else {
        // 文字列や数値の場合
        date = new Date(userData.subscription_end_date as any);
      }
        
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting subscription end date:', error);
      return '日付不明';
    }
  }, [userData]);
  
  // 翻訳の利用状況情報
  const translationCount = userData?.translation_count || 0;
  const translationPeriodStart = userData?.translation_period_start
    ? typeof userData.translation_period_start.toDate === 'function'
      ? userData.translation_period_start.toDate()
      : new Date(userData.translation_period_start as any)
    : null;
  const translationPeriodEnd = userData?.translation_period_end
    ? typeof userData.translation_period_end.toDate === 'function'
      ? userData.translation_period_end.toDate()
      : new Date(userData.translation_period_end as any)
    : null;
  
  // 翻訳数の制限（無料会員: 3件/月, 有料会員: 無制限）
  const translationLimit = userData?.subscription_status === 'paid' ? '無制限' : '3';
  
  // 使用率を計算（無料会員の場合のみ）
  const usagePercentage = userData?.subscription_status !== 'paid' ? Math.min((translationCount / 3) * 100, 100) : 0;
  
  // 初回マウント時にのみユーザーデータを更新
  useEffect(() => {
    if (user && !dataInitialized && !isUpdatingRef.current) {
      isUpdatingRef.current = true;
      
      const initData = async () => {
        try {
          setIsRefreshing(true);
          await forceRefreshUserData();
          setDataInitialized(true);
        } catch (err) {
          console.error('Failed to initialize user data:', err);
        } finally {
          setIsRefreshing(false);
          isUpdatingRef.current = false;
          lastUpdateTimeRef.current = Date.now();
        }
      };
      
      initData();
    }
  }, [user, dataInitialized, forceRefreshUserData]);
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      isUpdatingRef.current = false;
    };
  }, []);
  
  if (loading && !userData) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  if (!user) {
    return (
      <Container maxWidth="md">
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>ログインが必要です</Typography>
          <Typography paragraph>このページにアクセスするにはログインが必要です。</Typography>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => navigate('/login')}
          >
            ログインページへ
          </Button>
        </Box>
      </Container>
    );
  }
  
  // userDataがない場合は、デフォルト値を使用
  const effectiveUserData = userData || {
    subscription_status: 'free',
    subscription_end_date: null,
    name: user.displayName || user.email?.split('@')[0] || 'ユーザー',
    email: user.email,
    updated_at: null,
    translation_count: 0,
    translation_period_start: null,
    translation_period_end: null
  };
  
  // 翻訳期間をフォーマット
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
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          ホームに戻る
        </Button>
        
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar 
              sx={{ width: 80, height: 80, mr: 3 }}
              src={user.photoURL || undefined}
            >
              {!user.photoURL && <AccountCircleIcon sx={{ fontSize: 60 }} />}
            </Avatar>
            
            <Box>
              <Typography variant="h4" gutterBottom>
                {effectiveUserData.name || user.displayName || user.email?.split('@')[0]}
              </Typography>
              
              <Chip 
                label={getSubscriptionText()} 
                color={effectiveUserData.subscription_status === 'paid' ? 'primary' : 'default'}
                variant="outlined" 
                sx={{ mr: 1 }}
              />
            </Box>
          </Box>
          
          {updateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {updateError}
            </Alert>
          )}
          
          {updateSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              プロフィールを更新しました。
            </Alert>
          )}
          
          {isRefreshing && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2">
                  データを更新中...
                </Typography>
              </Box>
            </Alert>
          )}
          
          <Divider sx={{ my: 3 }} />
          
          {/* タブナビゲーション */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="プロフィール設定タブ">
              <Tab label="基本情報" id="profile-tab-0" />
              <Tab
                label="Obsidian連携"
                id="profile-tab-2"
                icon={<BookIcon sx={{ fontSize: 18 }} />}
                iconPosition="end"
              />
              <Tab
                label="サブスクリプション"
                id="profile-tab-3"
                icon={<PaymentIcon sx={{ fontSize: 18 }} />}
                iconPosition="end"
              />
            </Tabs>
          </Box>
          
          {/* 基本情報タブ */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ maxWidth: "100%", width: "100%" }}>
              <Typography variant="h6" gutterBottom>
                基本情報
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  メールアドレス
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {user.email}
                </Typography>
                
                {editMode ? (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ユーザー名
                    </Typography>
                    <TextField
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      fullWidth
                      margin="dense"
                      variant="outlined"
                      size="small"
                    />
                    
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<SaveIcon />}
                        onClick={handleUpdateUserName}
                        disabled={updateLoading}
                      >
                        {updateLoading ? <CircularProgress size={24} /> : '保存'}
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={() => {
                          setEditMode(false);
                          setUserName(userData?.name || user.displayName || '');
                        }}
                      >
                        キャンセル
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ユーザー名
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body1" sx={{ flex: 1 }}>
                        {effectiveUserData.name || user.displayName || user.email?.split('@')[0]}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setEditMode(true)}
                      >
                        編集
                      </Button>
                    </Box>
                  </Box>
                )}
              </Paper>

              {/* 翻訳使用状況 */}
              <Typography variant="h6" gutterBottom>
                翻訳使用状況
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ArticleIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">
                      月間翻訳
                    </Typography>
                    <Typography variant="h5">
                      {translationCount} / {translationLimit} （件）
                    </Typography>
                  </Box>
                </Box>
                
                {/* 使用率プログレスバー (無料会員のみ表示) */}
                {effectiveUserData.subscription_status !== 'paid' && (
                  <Box sx={{ mt: 1, mb: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={usagePercentage} 
                      color={usagePercentage >= 100 ? "error" : usagePercentage >= 75 ? "warning" : "primary"}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {usagePercentage >= 100 ? "上限に達しました" : 
                       usagePercentage >= 75 ? "残りわずかです" : 
                       "まだ余裕があります"}
                    </Typography>
                  </Box>
                )}
                
                {/* 翻訳期間情報 */}
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                  <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="subtitle2">
                      翻訳使用期間
                    </Typography>
                    <Typography variant="body2">
                      {translationPeriodStart && translationPeriodEnd ? 
                        `${formatDate(translationPeriodStart)} 〜 ${formatDate(translationPeriodEnd)}` : 
                        '期間情報がありません'}
                    </Typography>
                  </Box>
                </Box>
                
                {/* 翻訳数の上限に達している場合は警告 */}
                {effectiveUserData.subscription_status !== 'paid' && translationCount >= 3 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    月間翻訳数の上限に達しています。プレミアムプランにアップグレードすると無制限で翻訳できます。
                  </Alert>
                )}
              </Paper>

              {/* セキュリティ機能を基本情報タブに統合 */}
              <Typography variant="h6" gutterBottom>
                セキュリティ設定
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<LockIcon />}
                  fullWidth
                  sx={{ mb: 1 }}
                  onClick={() => navigate('/reset-password')}
                >
                  パスワードを変更
                </Button>
                
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<LogoutIcon />}
                  fullWidth
                  onClick={() => setLogoutDialogOpen(true)}
                >
                  ログアウト
                </Button>
              </Paper>
              
              <Typography variant="h6" gutterBottom>
                サブスクリプション情報
              </Typography>
              
              {userData && <SubscriptionInfoCard userData={userData} />}
            </Box>
          </TabPanel>
          
          {/* Obsidian連携タブ */}
          <TabPanel value={tabValue} index={1}>
            <ObsidianSettings onSaved={() => setUpdateSuccess(true)} />
          </TabPanel>
          
          {/* サブスクリプションタブ */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              サブスクリプション管理
            </Typography>
            
            <Box sx={{ mb: 4 }}>
              {userData && <SubscriptionInfoCard userData={userData} />}
              
              {effectiveUserData.subscription_status === 'paid' && (
                <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    利用状況
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      今月の翻訳数
                    </Typography>
                    <Typography variant="h5">
                      無制限
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      保存された論文
                    </Typography>
                    <Typography variant="h5">
                      12 / 無制限
                    </Typography>
                  </Box>
                </Paper>
              )}
            </Box>
            
            <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StarIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  プレミアム特典
                </Typography>
              </Box>
              
              <Typography variant="body2" paragraph>
                プレミアムプランでは以下の特典が利用できます：
              </Typography>
              
              <ul>
                <li>
                  <Typography variant="body2">
                    <strong>翻訳数無制限：</strong> 1月あたりの翻訳制限がなくなります
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>保存期間延長：</strong> 翻訳済み論文を1ヶ月間保存
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>関連論文推薦数無制限：</strong> 制限なく関連論文を表示
                  </Typography>
                </li>
              </ul>
              
              {effectiveUserData.subscription_status !== 'paid' && (
                <Button
                  variant="outlined"
                  color="primary"
                  fullWidth
                  onClick={() => navigate('/subscription')}
                  sx={{ mt: 2 }}
                  startIcon={<StarIcon />}
                >
                  プレミアムにアップグレード
                </Button>
              )}
            </Paper>
          </TabPanel>
        </Paper>
      </Box>
      
      {/* ログアウト確認ダイアログ */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
      >
        <DialogTitle>ログアウトしますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ログアウトすると、再度ログインするまでサービスを利用できなくなります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleLogout} color="error" autoFocus>
            ログアウト
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfilePage;