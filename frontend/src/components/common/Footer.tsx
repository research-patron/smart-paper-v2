// ~/Desktop/smart-paper-v2/frontend/src/components/common/Footer.tsx
import { Box, Container, Grid, Link, Typography, Divider, useTheme, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Footer = () => {
  const theme = useTheme();
  const year = new Date().getFullYear();
  
  // リンクスタイル - 洗練されたシンプルなデザイン
  const linkStyle = {
    color: theme.palette.text.secondary,
    textDecoration: 'none',
    transition: 'color 0.2s ease',
    fontSize: '0.85rem',
    display: 'inline-block',
    marginRight: 2.5,
    '&:hover': {
      color: theme.palette.primary.main,
    }
  };
  
  return (
    <Box
      component="footer"
      sx={{
        borderTop: '1px solid',
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper,
        position: 'relative',
        mt: 'auto',
      }}
    >
      {/* 上部のアクセントライン */}
      <Box 
        sx={{ 
          height: 3, 
          width: '100%', 
          background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
        }} 
      />
      
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              order: { xs: 2, sm: 1 }, 
              mt: { xs: 2, sm: 0 },
              fontSize: '0.85rem',
            }}
          >
            &copy; {year} Smart Paper v2
          </Typography>
          
          <Stack 
            direction="row" 
            spacing={0} 
            sx={{ 
              order: { xs: 1, sm: 2 }, 
              flexWrap: 'wrap',
            }}
          >
            <Link component={RouterLink} to="/" sx={linkStyle}>
              ホーム
            </Link>
            <Link component={RouterLink} to="/subscription" sx={linkStyle}>
              料金プラン
            </Link>
            <Link 
              component="a" 
              href="https://github.com/your-repository/issues/new" 
              target="_blank"
              sx={linkStyle}
            >
              問題を報告
            </Link>
            <Link component={RouterLink} to="/terms" sx={linkStyle}>
              利用規約
            </Link>
            <Link component={RouterLink} to="/privacy" sx={linkStyle}>
              プライバシーポリシー
            </Link>
            <Link component={RouterLink} to="/commerce" sx={linkStyle}>
              特商法表記
            </Link>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;