// ~/Desktop/smart-paper-v2/frontend/src/components/common/Header.tsx
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  Container,
  Avatar,
  Button,
  Tooltip,
  MenuItem,
  Divider,
  ListItemIcon,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArticleIcon from '@mui/icons-material/Article';
import PaymentIcon from '@mui/icons-material/Payment';
import StarIcon from '@mui/icons-material/Star';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import WarningIcon from '@mui/icons-material/Warning';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import { useAuthStore } from '../../store/authStore';

const Header = () => {
  const { user, userData, logout } = useAuthStore();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ユーザーメニューの状態
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  
  // モバイルサイドメニューの状態
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 管理者かどうかをチェック
  const isAdmin = user?.email === 'smart-paper-v2@student-subscription.com' ||
                 user?.email === 's.kosei0626@gmail.com';

  // 会員種別に基づくラベルとモデル
  const getPlanLabel = () => {
    if (!userData) return null;
    if (userData.subscription_status === 'paid') {
      return (
        <Chip 
          icon={<StarIcon fontSize="small" />} 
          label="プレミアム会員" 
          color="primary" 
          size="small" 
          sx={{ ml: 1, height: 24 }}
        />
      );
    }
    return (
      <Chip 
        label="無料会員" 
        variant="outlined" 
        size="small" 
        sx={{ ml: 1, height: 24 }}
      />
    );
  };

  // ユーザーメニューを開く
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  // ユーザーメニューを閉じる
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  // メニュー項目クリック時の処理
  const handleMenuClick = (path: string) => {
    handleCloseUserMenu();
    navigate(path);
  };

  // ログアウト処理
  const handleLogout = async () => {
    handleCloseUserMenu();
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // モバイルサイドメニューの開閉
  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  // 認証状態に基づくボタン表示
  const renderAuthButton = () => {
    if (user) {
      return (
        <Box sx={{ flexGrow: 0 }}>
          <Tooltip title="ユーザーメニューを開く">
            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
              {user.photoURL ? (
                <Avatar alt={user.displayName || 'ユーザー'} src={user.photoURL} />
              ) : (
                <Avatar alt={user.displayName || 'ユーザー'}>
                  {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                </Avatar>
              )}
            </IconButton>
          </Tooltip>
          <Menu
            sx={{ mt: '45px' }}
            id="menu-appbar"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            <MenuItem onClick={handleCloseUserMenu} sx={{ pointerEvents: 'none' }}>
              <Typography textAlign="center">
                {user.displayName || user.email}
                {getPlanLabel()}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleMenuClick('/profile')}>
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              プロフィール
            </MenuItem>
            <MenuItem onClick={() => handleMenuClick('/my-papers')}>
              <ListItemIcon>
                <ArticleIcon fontSize="small" />
              </ListItemIcon>
              マイ論文
            </MenuItem>
            <MenuItem onClick={() => handleMenuClick('/subscription')}>
              <ListItemIcon>
                <PaymentIcon fontSize="small" />
              </ListItemIcon>
              サブスクリプション
            </MenuItem>
            <MenuItem onClick={() => handleMenuClick('/contact')}>
              <ListItemIcon>
                <HelpOutlineIcon fontSize="small" />
              </ListItemIcon>
              お問い合わせ
            </MenuItem>
            {isAdmin && (
              <>
                <Divider sx={{ my: 1 }} />
                <MenuItem onClick={() => handleMenuClick('/admin/papers')}>
                  <ListItemIcon>
                    <AdminPanelSettingsIcon fontSize="small" />
                  </ListItemIcon>
                  管理者ページ
                </MenuItem>
              </>
            )}
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              ログアウト
            </MenuItem>
          </Menu>
        </Box>
      );
    }
    return (
      <Button
        color="inherit"
        component={RouterLink}
        to="/login"
        startIcon={<AccountCircleIcon />}
      >
        ログイン
      </Button>
    );
  };

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* モバイル用メニューボタンとロゴ */}
          {isMobile && (
            <>
              <IconButton
                size="large"
                aria-label="menu"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={toggleDrawer(true)}
                color="inherit"
                edge="start"
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
              <Drawer
                anchor="left"
                open={drawerOpen}
                onClose={toggleDrawer(false)}
              >
                <Box
                  sx={{ width: 250 }}
                  role="presentation"
                  onClick={toggleDrawer(false)}
                  onKeyDown={toggleDrawer(false)}
                >
                  <List>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => navigate('/')}>
                        <ListItemIcon>
                          <ArticleIcon />
                        </ListItemIcon>
                        <ListItemText primary="ホーム" />
                      </ListItemButton>
                    </ListItem>
                    {user && (
                      <>
                        <ListItem disablePadding>
                          <ListItemButton onClick={() => navigate('/my-papers')}>
                            <ListItemIcon>
                              <ArticleIcon />
                            </ListItemIcon>
                            <ListItemText primary="マイ論文" />
                          </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                          <ListItemButton onClick={() => navigate('/subscription')}>
                            <ListItemIcon>
                              <StarIcon />
                            </ListItemIcon>
                            <ListItemText primary="プレミアム" />
                          </ListItemButton>
                        </ListItem>
                      </>
                    )}
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => navigate('/contact')}>
                        <ListItemIcon>
                          <HelpOutlineIcon />
                        </ListItemIcon>
                        <ListItemText primary="お問い合わせ" />
                      </ListItemButton>
                    </ListItem>
                    {isAdmin && (
                      <>
                        <Divider />
                        <ListItem disablePadding>
                          <ListItemButton onClick={() => navigate('/admin/papers')}>
                            <ListItemIcon>
                              <AdminPanelSettingsIcon />
                            </ListItemIcon>
                            <ListItemText primary="管理者ページ" />
                          </ListItemButton>
                        </ListItem>
                      </>
                    )}
                  </List>
                </Box>
              </Drawer>
            </>
          )}

          {/* ロゴ */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              mr: 2,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.1rem',
              color: 'inherit',
              textDecoration: 'none',
              flexGrow: { xs: 1, md: 0 },
            }}
          >
            Smart Paper v2
          </Typography>

          {/* デスクトップ用メニュー - 文字のずれを修正するためにスタイルを統一 */}
          {!isMobile && (
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <Button
                component={RouterLink}
                to="/"
                color="inherit"
                sx={{ height: 40, display: 'flex', alignItems: 'center', mx: 0.5 }}
              >
                ホーム
              </Button>
              {user && (
                <>
                  <Button
                    component={RouterLink}
                    to="/my-papers"
                    color="inherit"
                    sx={{ height: 40, display: 'flex', alignItems: 'center', mx: 0.5 }}
                  >
                    マイ論文
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/subscription"
                    color="inherit"
                    startIcon={<StarIcon />}
                    sx={{ height: 40, display: 'flex', alignItems: 'center', mx: 0.5 }}
                  >
                    プレミアム
                  </Button>
                </>
              )}
              <Button
                component={RouterLink}
                to="/contact"
                color="inherit"
                sx={{ height: 40, display: 'flex', alignItems: 'center', mx: 0.5 }}
              >
                お問い合わせ
              </Button>
              {isAdmin && (
                <Button
                  component={RouterLink}
                  to="/admin/papers"
                  color="inherit"
                  startIcon={<AdminPanelSettingsIcon />}
                  sx={{ height: 40, display: 'flex', alignItems: 'center', mx: 0.5 }}
                >
                  管理者ページ
                </Button>
              )}
            </Box>
          )}

          {/* 認証ボタン */}
          {renderAuthButton()}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

// Chipコンポーネント
const Chip = (props: any) => {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        bgcolor: props.variant === 'outlined' ? 'transparent' : (props.color === 'primary' ? 'primary.main' : 'grey.300'),
        color: props.variant === 'outlined' ? (props.color === 'primary' ? 'primary.main' : 'text.primary') : (props.color === 'primary' ? 'white' : 'text.primary'),
        borderRadius: 4,
        px: 1,
        py: 0.3,
        fontSize: '0.75rem',
        fontWeight: 'medium',
        letterSpacing: 0.5,
        border: props.variant === 'outlined' ? 1 : 0,
        borderColor: props.color === 'primary' ? 'primary.main' : 'grey.400',
        ...props.sx
      }}
    >
      {props.icon && (
        <Box component="span" sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>
          {props.icon}
        </Box>
      )}
      {props.label}
    </Box>
  );
};

export default Header;