// ~/Desktop/smart-paper-v2/frontend/src/pages/ProfilePage.tsx
import { useState } from 'react';
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
  DialogTitle
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../store/authStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../api/firebase';

const ProfilePage = () => {
  const { user, userData, logout, updateUserData, loading } = useAuthStore();
  const navigate = useNavigate();
  
  const [editMode, setEditMode] = useState(false);
  const [userName, setUserName] = useState(userData?.name || user?.displayName || '');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  
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
    if (!userData) return 'データがありません';
    
    switch (userData.subscription_status) {
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
    if (!userData?.subscription_end_date) return '無期限';
    
    const date = userData.subscription_end_date.toDate();
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  if (loading || !user) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
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
                {userData?.name || user.displayName || user.email?.split('@')[0]}
              </Typography>
              
              <Chip 
                label={getSubscriptionText()} 
                color={userData?.subscription_status === 'paid' ? 'primary' : 'default'}
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
                        {userData?.name || user.displayName || user.email?.split('@')[0]}
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
                  {userData?.created_at ? 
                    userData.created_at.toDate().toLocaleDateString('ja-JP') : 
                    '不明'}
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                サブスクリプション情報
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  現在のプラン
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {getSubscriptionText()}
                </Typography>
                
                {userData?.subscription_status === 'paid' && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary">
                      有効期限
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {getSubscriptionEndDate()}
                    </Typography>
                  </>
                )}
                
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate('/subscription')}
                  fullWidth
                >
                  {userData?.subscription_status === 'paid' ? 
                    'プランを管理する' : 
                    'プランをアップグレードする'}
                </Button>
              </Paper>
              
              <Typography variant="h6" gutterBottom>
                セキュリティ
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
            </Grid>
          </Grid>
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