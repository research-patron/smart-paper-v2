// ~/Desktop/smart-paper-v2/frontend/src/components/common/Footer.tsx
import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Link, Grid, Divider } from '@mui/material';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) => theme.palette.grey[100],
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              Smart Paper v2
            </Typography>
            <Typography variant="body2" color="text.secondary">
              研究者のための論文翻訳・要約ツール
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              リンク
            </Typography>
            <Link component={RouterLink} to="/" color="inherit" sx={{ display: 'block', mb: 1 }}>
              ホーム
            </Link>
            <Link component={RouterLink} to="/my-papers" color="inherit" sx={{ display: 'block', mb: 1 }}>
              論文一覧
            </Link>
            <Link component={RouterLink} to="/contact" color="inherit" sx={{ display: 'block', mb: 1 }}>
              お問い合わせ・問題報告
            </Link>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" color="text.primary" gutterBottom>
              法的情報
            </Typography>
            <Link component={RouterLink} to="/terms" color="inherit" sx={{ display: 'block', mb: 1 }}>
              利用規約
            </Link>
            <Link component={RouterLink} to="/privacy" color="inherit" sx={{ display: 'block', mb: 1 }}>
              プライバシーポリシー
            </Link>
            <Link component={RouterLink} to="/commerce" color="inherit" sx={{ display: 'block', mb: 1 }}>
              特定商取引法に基づく表記
            </Link>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            &copy; {currentYear} Smart Paper v2. All rights reserved.
          </Typography>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              <Link color="inherit" href="mailto:smart-paper-v2@student-subscription.com">
                smart-paper-v2@student-subscription.com
              </Link>
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;