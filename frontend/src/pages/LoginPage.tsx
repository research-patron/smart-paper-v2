// ~/Desktop/smart-paper-v2/frontend/src/pages/LoginPage.tsx
import { useEffect } from 'react';
import { Container, Grid, Paper, Typography, Box, useTheme, useMediaQuery } from '@mui/material';
import LoginForm from '../components/auth/LoginForm';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ユーザーが既にログインしている場合はホームページにリダイレクト
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        minHeight: 'calc(100vh - 64px - 48px)', // 高さを画面いっぱいに (ヘッダーとフッターを考慮)
        alignItems: 'center', // 垂直方向の中央揃え
        py: 4 // 上下のパディングを追加
      }}
    >
      <Container maxWidth="xl"> {/* xlサイズに拡大 */}
        <Grid 
          container 
          spacing={6} // 間隔を広げる
          alignItems="center" 
          justifyContent="center"
        >
          {/* モバイル表示の場合は縦に積み重ねる */}
          {isMobile ? (
            <>
              <Grid item xs={12} md={6}>
                <Box 
                  component="div" 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    flexDirection: 'column',
                    mb: 3 
                  }}
                >
                  <Typography variant="h3" align="center" gutterBottom> {/* サイズ拡大 */}
                    Smart Paper V2
                  </Typography>
                  <Typography variant="h6" align="center" color="text.secondary" gutterBottom> {/* サイズ拡大 */}
                    英語論文を簡単に日本語で理解
                  </Typography>
                  
                  {/* ビデオコンポーネント */}
                  <Box 
                    component="video"
                    controls
                    sx={{ 
                      width: '100%',
                      maxHeight: '70vh', // 画面の高さの70%を最大高さに
                      borderRadius: 3, // 角丸を大きく
                      boxShadow: 4, // 影を強く
                      mb: 3
                    }}
                  >
                    <source src="/videos/smart-paper-demo.mp4" type="video/mp4" />
                    お使いのブラウザは動画再生に対応していません。
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <LoginForm enlargedSize={true} /> {/* 拡大フラグを渡す */}
              </Grid>
            </>
          ) : (
            <>
              {/* デスクトップ表示では横に並べる */}
              <Grid item xs={12} md={5}>
                <LoginForm enlargedSize={true} /> {/* 拡大フラグを渡す */}
              </Grid>
              
              <Grid item xs={12} md={6}> {/* 少し縮小 */}
                <Box 
                  component="div" 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    flexDirection: 'column',
                    maxWidth: '90%', // 最大幅を設定
                    mx: 'auto' // 中央寄せ
                  }}
                >
                  <Typography variant="h3" align="center" gutterBottom> {/* サイズ拡大 */}
                    Smart Paper V2
                  </Typography>
                  <Typography variant="h6" align="center" color="text.secondary" gutterBottom sx={{ mb: 3 }}> {/* サイズ拡大 */}
                    英語論文を簡単に日本語で理解
                  </Typography>
                  
                  {/* ビデオコンポーネント */}
                  <Box 
                    component="video"
                    controls
                    autoPlay
                    muted
                    loop
                    sx={{ 
                      width: '100%',
                      maxHeight: '70vh', // 画面の高さの70%を最大高さに
                      borderRadius: 3, // 角丸を大きく
                      boxShadow: 4 // 影を強く
                    }}
                  >
                    <source src="/videos/smart-paper-demo.mp4" type="video/mp4" />
                    お使いのブラウザは動画再生に対応していません。
                  </Box>
                </Box>
              </Grid>
            </>
          )}
        </Grid>
      </Container>
    </Box>
  );
};

export default LoginPage;