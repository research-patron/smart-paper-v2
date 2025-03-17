// ~/Desktop/smart-paper-v2/frontend/src/pages/ProfilePage.tsx
import { useState, useEffect } from 'react';
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
  Tab
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import BookIcon from '@mui/icons-material/Book';
import StarIcon from '@mui/icons-material/Star';
import PaymentIcon from '@mui/icons-material/Payment';
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
  const { user, userData, logout, updateUserData, loading } = useAuthStore();
  const navigate = useNavigate();
  
  const [editMode, setEditMode] = useState(false);
  const [userName, setUserName] = useState(user?.displayName || '');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  
  // userDataが変更されたらuserNameも更新
  useEffect(() => {
    if (userData) {
      setUserName(userData.name || user?.displayName || '');
    }
  }, [userData, user]);

  // タブの切り替え
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
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
      await updateUserData();
      
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
  const getSubscriptionText = () => {
    switch (effectiveUserData.subscription_status) {
      case 'paid':
        return '有料会員';
      case 'free':
        return '無料会員';
      default:
        return '非会員';
    }
  };
  
  // サブスクリプションの期限を表示
  const getSubscriptionEndDate = () => {
    if (!effectiveUserData.subscription_end_date) return '無期限';
    
    // Firestoreの Timestamp 型を適切に処理
    let date;
    if (typeof effectiveUserData.subscription_end_date.toDate === 'function') {
      // Firestoreの Timestamp オブジェクトの場合
      date = effectiveUserData.subscription_end_date.toDate();
    } else if (effectiveUserData.subscription_end_date instanceof Date) {
      // JavaScript の Date オブジェクトの場合
      date = effectiveUserData.subscription_end_date;
    } else {
      // 文字列や数値の場合
      date = new Date(effectiveUserData.subscription_end_date as any);
    }
      
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  if (loading) {
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
    created_at: null,
    updated_at: null
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
          
          <Divider sx={{ my: 3 }} />
          
          {/* タブナビゲーション */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="プロフィール設定タブ">
              <Tab label="基本情報" id="profile-tab-0" />
              <Tab label="セキュリティ" id="profile-tab-1" />
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
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  基本情報
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
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
                  
                  <Typography variant="subtitle2" color="text.secondary">
                    アカウント作成日
                  </Typography>
                  <Typography variant="body1">
                    {effectiveUserData.created_at ? 
                      (typeof effectiveUserData.created_at.toDate === 'function' 
                        ? effectiveUserData.created_at.toDate().toLocaleDateString('ja-JP') 
                        : effectiveUserData.created_at instanceof Date
                          ? effectiveUserData.created_at.toLocaleDateString('ja-JP')
                          : new Date(effectiveUserData.created_at as any).toLocaleDateString('ja-JP')) : 
                      '不明'}
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  サブスクリプション情報
                </Typography>
                
                <SubscriptionInfoCard userData={effectiveUserData} />
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* セキュリティタブ */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              セキュリティ設定
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
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
          </TabPanel>
          
          {/* Obsidian連携タブ */}
          <TabPanel value={tabValue} index={2}>
            <ObsidianSettings onSaved={() => setUpdateSuccess(true)} />
          </TabPanel>
          
          {/* サブスクリプションタブ（新規追加） */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" gutterBottom>
              サブスクリプション管理
            </Typography>
            
            <Box sx={{ mb: 4 }}>
              <SubscriptionInfoCard userData={effectiveUserData} />
              
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
              
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => navigate('/subscription')}
                sx={{ mt: 3 }}
              >
                サブスクリプション詳細ページへ
              </Button>
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
                    <strong>翻訳数無制限：</strong> 1日あたりの翻訳制限がなくなります
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