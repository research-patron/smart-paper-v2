// ~/Desktop/smart-paper-v2/frontend/src/components/common/Header.tsx
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
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
  Link,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import ArticleIcon from '@mui/icons-material/Article';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import StarIcon from '@mui/icons-material/Star';
import EmailIcon from '@mui/icons-material/Email';
import { useAuthStore } from '../../store/authStore';

const Header = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, userData, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  // モバイルのドロワーステート
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // ユーザーメニューステート
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };
  
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      handleCloseUserMenu();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // 現在のページに基づいてnavItemをハイライト
  const isActivePage = (path: string) => {
    return location.pathname === path;
  };
  
  // ナビゲーション項目
  const navItems = [
    { name: 'ホーム', path: '/', icon: <HomeIcon /> },
    { name: '論文一覧', path: '/my-papers', icon: <ArticleIcon /> },
    { name: 'お問い合わせ', path: '/contact', icon: <EmailIcon /> },
  ];
  
  // ログイン後に表示する項目
  const userNavItems = [
    { name: 'プロフィール', path: '/profile', icon: <AccountCircleIcon /> },
    ...(userData?.subscription_status !== 'paid' ? [{ name: 'プレミアム', path: '/subscription', icon: <StarIcon /> }] : []),
  ];
  
  // モバイルのドロワーコンテンツ
  const drawerContent = (
    <Box sx={{ width: 250 }} role="presentation" onClick={handleDrawerToggle}>
      <List>
        <ListItem sx={{ py: 2 }}>
          <Typography variant="h6">Smart Paper v2</Typography>
        </ListItem>
        <Divider />
        
        {user ? (
          <>
            {navItems.map((item) => (
              <ListItem 
                button 
                key={item.name} 
                component={RouterLink} 
                to={item.path}
                selected={isActivePage(item.path)}
                sx={{
                  backgroundColor: isActivePage(item.path) ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  }
                }}
              >
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.name} />
              </ListItem>
            ))}
            
            <Divider />
            
            {userNavItems.map((item) => (
              <ListItem 
                button 
                key={item.name} 
                component={RouterLink} 
                to={item.path}
                selected={isActivePage(item.path)}
                sx={{
                  backgroundColor: isActivePage(item.path) ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  }
                }}
              >
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.name} />
              </ListItem>
            ))}
            
            <Divider />
            
            <ListItem button onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="ログアウト" />
            </ListItem>
          </>
        ) : (
          <>
            <ListItem 
              button 
              component={RouterLink} 
              to="/login"
              selected={isActivePage('/login')}
            >
              <ListItemIcon>
                <LoginIcon />
              </ListItemIcon>
              <ListItemText primary="ログイン" />
            </ListItem>
            
            <ListItem 
              button 
              component={RouterLink} 
              to="/register"
              selected={isActivePage('/register')}
            >
              <ListItemIcon>
                <AccountCircleIcon />
              </ListItemIcon>
              <ListItemText primary="新規登録" />
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );
  
  return (
    <AppBar position="sticky" color="default" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* モバイルビュー */}
          {isMobile && (
            <>
              <IconButton
                size="large"
                edge="start"
                color="inherit"
                aria-label="menu"
                onClick={handleDrawerToggle}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
              
              <Drawer
                anchor="left"
                open={drawerOpen}
                onClose={handleDrawerToggle}
              >
                {drawerContent}
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
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
              display: 'flex',
              flexGrow: isMobile ? 1 : 0,
            }}
          >
            Smart Paper v2
          </Typography>
          
          {/* デスクトップナビゲーション */}
          {!isMobile && user && (
            <Box sx={{ flexGrow: 1, display: 'flex' }}>
              {navItems.map((item) => (
                <Button
                  key={item.name}
                  component={RouterLink}
                  to={item.path}
                  sx={{ 
                    my: 2, 
                    color: 'inherit',
                    display: 'block',
                    backgroundColor: isActivePage(item.path) ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                  }}
                  startIcon={item.icon}
                >
                  {item.name}
                </Button>
              ))}
            </Box>
          )}
          
          {/* ユーザーメニュー（ログイン時） */}
          {user ? (
            <Box sx={{ flexGrow: 0 }}>
              <Tooltip title="ユーザーメニューを開く">
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                  <Avatar alt={user.displayName || undefined} src={user.photoURL || undefined} />
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
                {/* ユーザー情報 */}
                <MenuItem disabled>
                  <Typography textAlign="center">
                    {user.email}
                  </Typography>
                </MenuItem>
                <Divider />
                
                {/* ユーザーメニュー項目 */}
                {userNavItems.map((item) => (
                  <MenuItem 
                    key={item.name} 
                    component={RouterLink} 
                    to={item.path}
                    onClick={handleCloseUserMenu}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <Typography textAlign="center">{item.name}</Typography>
                  </MenuItem>
                ))}
                
                <Divider />
                
                {/* ログアウト */}
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <Typography textAlign="center">ログアウト</Typography>
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            // 未ログイン時のボタン
            <Box sx={{ flexGrow: 0, display: 'flex' }}>
              <Button
                component={RouterLink}
                to="/login"
                sx={{ color: 'inherit' }}
                startIcon={<LoginIcon />}
              >
                ログイン
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color="primary"
                sx={{ ml: 1 }}
              >
                新規登録
              </Button>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;