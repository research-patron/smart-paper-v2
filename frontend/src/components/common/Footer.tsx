// ~/Desktop/smart-paper-v2/frontend/src/components/common/Footer.tsx
import { Box, Container, Grid, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Footer = () => {
  const year = new Date().getFullYear();
  
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) => theme.palette.grey[200],
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Smart Paper v2
            </Typography>
            <Typography variant="body2" color="text.secondary">
              英語論文を簡単に翻訳・要約・管理
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              リンク
            </Typography>
            <Link component={RouterLink} to="/" color="inherit" display="block">
              ホーム
            </Link>
            <Link component={RouterLink} to="/subscription" color="inherit" display="block">
              料金プラン
            </Link>
            <Link component="a" href="https://github.com/your-repository/issues/new" target="_blank" color="inherit" display="block">
              問題を報告
            </Link>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              法的情報
            </Typography>
            <Link component={RouterLink} to="/terms" color="inherit" display="block">
              利用規約
            </Link>
            <Link component={RouterLink} to="/privacy" color="inherit" display="block">
              プライバシーポリシー
            </Link>
            <Link component={RouterLink} to="/commerce" color="inherit" display="block">
              特定商取引法に基づく表記
            </Link>
          </Grid>
        </Grid>
        
        <Box mt={3}>
          <Typography variant="body2" color="text.secondary" align="center">
            {"Copyright © "}
            <Link component={RouterLink} to="/" color="inherit">
              Smart Paper v2
            </Link>{" "}
            {year}
            {"."}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;