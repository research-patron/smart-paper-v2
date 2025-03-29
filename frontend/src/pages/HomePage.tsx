// ~/Desktop/smart-paper-v2/frontend/src/pages/HomePage.tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Button, 
  Box, 
  Paper, 
  Grid, 
  Alert, 
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  ListItem,
  ListItemIcon,
  ListItemText,
  List,
  IconButton,
  Link,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import StarIcon from '@mui/icons-material/Star';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SchoolIcon from '@mui/icons-material/School';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import ArticleIcon from '@mui/icons-material/Article';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import SubscriptionInfoCard from '../components/subscription/SubscriptionInfoCard';
import PdfUpload from '../components/papers/PdfUpload';
import { Paper as PaperType } from '../api/papers';

// SANGOテーマ風のセクションタイトルコンポーネント
const SectionTitle = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ 
      position: 'relative', 
      mb: 3,
      display: 'inline-block',
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: -1,
        left: 0,
        width: '40%',
        height: 3,
        backgroundColor: theme.palette.primary.main,
        borderRadius: 1.5,
      }
    }}>
      <Typography 
        variant="h5" 
        component="h2" 
        sx={{ 
          fontWeight: 700,
          position: 'relative',
          pb: 0.5,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState<string | null>(null);
  const [limitAlertOpen, setLimitAlertOpen] = useState(false);
  
  const { user, userData, forceRefreshUserData } = useAuthStore();
  const { papers, loading, error, fetchUserPapers, deletePaper } = usePaperStore();

  // ユーザーデータを初期ロード時に強制リフレッシュ
  useEffect(() => {
    if (user) {
      forceRefreshUserData();
    }
  }, [user, forceRefreshUserData]);

  // 論文のステータスに応じたテキストを返す
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '処理待ち';
      case 'metadata_extracted':
        return 'メタデータ抽出完了';
      case 'processing':
        return '翻訳中';
      case 'completed':
        return '完了';
      case 'error':
        return 'エラー';
      default:
        return '不明';
    }
  };

  // PDFアップロード成功時の処理
  const handleUploadSuccess = useCallback((paperId: string) => {
    forceRefreshUserData();
    // ブラウザ全体をリロード
    window.location.reload();
  }, [forceRefreshUserData]);

  // 論文削除のハンドラー
  const handleConfirmDelete = async () => {
    if (!paperToDelete) return;
    
    try {
      await deletePaper(paperToDelete);
      setDeleteDialogOpen(false);
      setPaperToDelete(null);
    } catch (error) {
      console.error('Failed to delete paper:', error);
    }
  };

  // ユーザーの論文一覧を取得
  useEffect(() => {
    if (user) {
      fetchUserPapers(user.uid);
    }
  }, [user, fetchUserPapers]);

  // ユーザーデータ情報
  const isPremium = userData?.subscription_status === 'paid';

  // 処理中の論文を取得（ステータスが 'pending', 'metadata_extracted', 'processing'のもの）
  const processingPapers = useMemo(() => {
    return papers.filter(paper => 
      ['pending', 'metadata_extracted', 'processing'].includes(paper.status)
    ).sort((a, b) => {
      // uploaded_atで降順に並べ替え（最新のものが先頭に）
      return b.uploaded_at.toMillis() - a.uploaded_at.toMillis();
    });
  }, [papers]);

  // 最新の処理中の論文
  const latestProcessingPaper = processingPapers.length > 0 ? processingPapers[0] : null;

  // 表示できる論文一覧（処理中以外または最新の処理中以外の論文）
  const displayablePapers = useMemo(() => {
    return papers
      .filter(paper => !latestProcessingPaper || paper.id !== latestProcessingPaper.id)
      .slice(0, 6); // 最大6件まで表示
  }, [papers, latestProcessingPaper]);

  return (
    <Container maxWidth="xl" sx={{ pb: 6, px: { xs: 2, sm: 3 } }}>
      {/* ヒーローセクションを削除 */}

      <Grid container spacing={3}>
        <Grid item xs={12} md={9}>
          {/* PDFアップロードセクション */}
          <Box id="upload-section" sx={{ pt: 2, mb: 5 }}>
            <Typography 
              variant="h5" 
              component="h1" 
              sx={{ 
                fontWeight: 700,
                mb: 3,
                position: 'relative',
                display: 'inline-block',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: -8,
                  left: 0,
                  width: '40%',
                  height: 3,
                  backgroundColor: theme.palette.primary.main,
                  borderRadius: 1.5,
                }
              }}
            >
              論文をアップロード
            </Typography>
            
            {/* 最新の処理中の論文があれば表示、なければPDFアップロードを表示 */}
            {latestProcessingPaper ? (
              <Box sx={{ mb: 4 }}>
                <Card 
                  sx={{ 
                    mb: 3, 
                    borderRadius: 3,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: '0 15px 35px rgba(0,0,0,0.1)',
                    },
                  }}
                >
                  <CardContent sx={{ padding: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Chip
                        label={getStatusText(latestProcessingPaper.status)}
                        size="small"
                        color="primary"
                        sx={{ 
                          fontWeight: 600,
                          px: 1,
                        }}
                      />
                      {latestProcessingPaper.status === 'processing' && latestProcessingPaper.progress && (
                        <Typography variant="caption" color="text.secondary">
                          {latestProcessingPaper.progress}%
                        </Typography>
                      )}
                    </Box>
                    
                    <Typography 
                      variant="h5" 
                      gutterBottom
                      sx={{ 
                        fontWeight: 700,
                        color: theme.palette.text.primary, 
                      }}
                    >
                      {latestProcessingPaper.metadata?.title || '無題の論文'}
                    </Typography>
                    
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {latestProcessingPaper.metadata?.authors?.map(a => a.name).join(', ') || '著者不明'}
                    </Typography>
                    
                    {latestProcessingPaper.metadata?.journal && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {latestProcessingPaper.metadata.journal}
                      </Typography>
                    )}
                    
                    {latestProcessingPaper.status === 'processing' && latestProcessingPaper.progress && (
                      <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">処理中...</Typography>
                          <Typography variant="body2">{latestProcessingPaper.progress}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={latestProcessingPaper.progress}
                          sx={{ 
                            height: 10, 
                            borderRadius: 5,
                            bgcolor: alpha(theme.palette.primary.main, 0.15),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 5,
                              backgroundImage: `linear-gradient(to right, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                            }
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          処理が完了すると自動的に詳細ページに移動します
                        </Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate(`/papers/${latestProcessingPaper.id}`)}
                        sx={{ 
                          borderRadius: 3,
                          px: 3,
                          boxShadow: '0 4px 10px rgba(248, 198, 119, 0.3)',
                        }}
                      >
                        詳細を見る
                      </Button>
                      
                      <IconButton 
                        size="medium"
                        color="error"
                        sx={{ 
                          bgcolor: alpha(theme.palette.error.main, 0.1),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.error.main, 0.2),
                          }
                        }}
                        onClick={() => {
                          setPaperToDelete(latestProcessingPaper.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <PdfUpload onUploadSuccess={handleUploadSuccess} />
            )}
          </Box>

          {/* 論文一覧 */}
          <Box sx={{ mb: 6 }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
              mb: 3 
            }}>
              <SectionTitle>最近の翻訳履歴</SectionTitle>
              
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/my-papers')}
                startIcon={<MenuBookIcon />}
                sx={{ 
                  borderRadius: 3,
                  textTransform: 'none',
                  px: 3,
                }}
              >
                すべての論文を見る
              </Button>
            </Box>

            {loading ? (
              <Paper 
                sx={{ 
                  p: 3, 
                  textAlign: 'center',
                  borderRadius: 3,
                }}
              >
                <Typography>読み込み中...</Typography>
              </Paper>
            ) : error ? (
              <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>
            ) : displayablePapers.length === 0 ? (
              <Paper 
                sx={{ 
                  p: 4, 
                  textAlign: 'center',
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <MenuBookIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>論文がありません</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  PDFをアップロードして論文を翻訳してみましょう
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={3}>
                {displayablePapers.map((paper) => (
                  <Grid item xs={12} sm={6} key={paper.id}>
                    <Card 
                      sx={{ 
                        borderRadius: 3,
                        overflow: 'hidden',
                        boxShadow: '0 6px 15px rgba(0,0,0,0.07)',
                        transition: 'all 0.3s ease',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': {
                          transform: 'translateY(-5px)',
                          boxShadow: '0 12px 25px rgba(0,0,0,0.1)',
                        }
                      }}
                    >
                      <CardActionArea 
                        onClick={() => navigate(`/papers/${paper.id}`)}
                        sx={{ 
                          flexGrow: 1, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'stretch'
                        }}
                      >
                        <CardContent sx={{ p: 3, flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Chip
                              label={getStatusText(paper.status)}
                              size="small"
                              color={
                                paper.status === 'completed' ? 'success' :
                                paper.status === 'error' ? 'error' :
                                'primary'
                              }
                              sx={{ 
                                fontWeight: 600,
                                px: 1, 
                                borderRadius: '50px',
                              }}
                            />
                            {paper.status === 'processing' && paper.progress && (
                              <Typography variant="caption" color="text.secondary">
                                {paper.progress}%
                              </Typography>
                            )}
                          </Box>
                          
                          <Typography 
                            variant="h6" 
                            noWrap 
                            title={paper.metadata?.title}
                            sx={{ 
                              fontWeight: 700,
                              mb: 1,
                            }}
                          >
                            {paper.metadata?.title || '無題の論文'}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <SchoolIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {paper.metadata?.authors?.map(a => a.name).join(', ') || '著者不明'}
                            </Typography>
                          </Box>
                          
                          {paper.metadata?.year && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <ArticleIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
                              <Typography variant="body2" color="text.secondary">
                                {paper.metadata.year}年
                              </Typography>
                            </Box>
                          )}
                          
                          {paper.metadata?.journal && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <LocalLibraryIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
                              <Typography 
                                variant="body2"
                                color="text.secondary"
                                noWrap
                              >
                                {paper.metadata.journal}
                              </Typography>
                            </Box>
                          )}
                          
                          {paper.status === 'processing' && paper.progress && (
                            <Box sx={{ mt: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">処理中...</Typography>
                                <Typography variant="caption" color="text.secondary">{paper.progress}%</Typography>
                              </Box>
                              <LinearProgress 
                                variant="determinate" 
                                value={paper.progress} 
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 3,
                                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                                }}
                              />
                            </Box>
                          )}
                        </CardContent>
                      </CardActionArea>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'flex-end', 
                        p: 1, 
                        borderTop: '1px solid',
                        borderColor: 'divider'
                      }}>
                        <IconButton 
                          size="small"
                          color="error"
                          sx={{ 
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            '&:hover': {
                              bgcolor: alpha(theme.palette.error.main, 0.2),
                            }
                          }}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setPaperToDelete(paper.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          {/* プロフィールと翻訳状況表示 */}
          {userData && <SubscriptionInfoCard userData={userData} />}
          
          {/* 機能紹介 */}
          <Paper 
            sx={{ 
              p: 4, 
              mb: 4, 
              borderRadius: 3,
              boxShadow: '0 6px 20px rgba(0,0,0,0.07)',
            }}
          >
            <Typography 
              variant="h6" 
              gutterBottom
              sx={{ 
                fontWeight: 700,
                position: 'relative',
                display: 'inline-block',
                pb: 1,
                mb: 3,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '40%',
                  height: 3,
                  backgroundColor: theme.palette.primary.main,
                  borderRadius: 1.5,
                }
              }}
            >
              Smart Paper v2の機能
            </Typography>
            
            <List>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 42 }}>
                  <Box 
                    sx={{ 
                      width: 34, 
                      height: 34, 
                      borderRadius: '50%', 
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>論文の翻訳</Typography>
                  }
                  secondary="英語論文を日本語に自動翻訳" 
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 42 }}>
                  <Box 
                    sx={{ 
                      width: 34, 
                      height: 34, 
                      borderRadius: '50%', 
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <DescriptionIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>要約生成</Typography>
                  }
                  secondary="論文の要点をAIが簡潔にまとめる" 
                />
              </ListItem>
              <ListItem sx={{ px: 0, py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 42 }}>
                  <Box 
                    sx={{ 
                      width: 34, 
                      height: 34, 
                      borderRadius: '50%', 
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowForwardIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>Zoteroに登録</Typography>
                  }
                  secondary="ボタンクリックで自動でZoteroに論文を登録" 
                />
              </ListItem>
            </List>
          </Paper>
          
          {/* プレミアムプラン宣伝 */}
          {!isPremium && (
            <Paper 
              sx={{ 
                p: 4, 
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 15px 35px rgba(248, 198, 119, 0.2)',
                backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
              }}
            >
              {/* 装飾的な背景要素 */}
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: -30, 
                  right: -30, 
                  width: 120, 
                  height: 120, 
                  borderRadius: '50%', 
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  zIndex: 0 
                }} 
              />
              
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Box 
                    sx={{ 
                      bgcolor: theme.palette.primary.main, 
                      color: 'white',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2
                    }}
                  >
                    <StarIcon />
                  </Box>
                  <Typography 
                    variant="h6"
                    sx={{ 
                      fontWeight: 700,
                      color: theme.palette.primary.dark
                    }}
                  >
                    プレミアム特典
                  </Typography>
                </Box>
                
                <List sx={{ mb: 2 }}>
                  <ListItem sx={{ px: 0, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <StarIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>翻訳回数無制限</Typography>
                      }
                      secondary="月3件の制限なくいつでも翻訳可能" 
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <StarIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>保存期間延長</Typography>
                      }
                      secondary="論文を1ヶ月間保存" 
                    />
                  </ListItem>
                </List>
                
                <Button 
                  variant="contained" 
                  color="primary"
                  fullWidth 
                  onClick={() => navigate('/subscription')}
                  startIcon={<StarIcon />}
                  sx={{ 
                    py: 1.5, 
                    borderRadius: 3,
                    fontWeight: 600,
                    boxShadow: '0 6px 15px rgba(248, 198, 119, 0.4)',
                  }}
                >
                  プレミアムにアップグレード
                </Button>
                <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 1 }}>
                  月額¥350 または 年額¥3,000 (月あたり¥250)
                </Typography>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
      
      {/* 論文削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setPaperToDelete(null);
        }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>論文の削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この論文を削除しますか？この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setPaperToDelete(null);
            }}
            sx={{ borderRadius: 2 }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error"
            variant="contained"
            sx={{ borderRadius: 2 }}
            autoFocus
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 翻訳制限ダイアログ */}
      <Dialog
        open={limitAlertOpen}
        onClose={() => setLimitAlertOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>翻訳制限に達しました</DialogTitle>
        <DialogContent>
          <DialogContentText>
            無料プランでは月に3件までしか翻訳できません。今月の翻訳回数上限に達しました。
            プレミアムプランにアップグレードすると、翻訳回数が無制限になります。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setLimitAlertOpen(false)}
            sx={{ borderRadius: 2 }}
          >
            閉じる
          </Button>
          <Button 
            onClick={() => {
              setLimitAlertOpen(false);
              navigate('/subscription');
            }} 
            color="primary"
            variant="contained"
            startIcon={<StarIcon />}
            sx={{ borderRadius: 2 }}
            autoFocus
          >
            プレミアムにアップグレード
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default HomePage;