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
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import StarIcon from '@mui/icons-material/Star';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import SubscriptionInfoCard from '../components/subscription/SubscriptionInfoCard';
import PdfUpload from '../components/papers/PdfUpload';
import { Paper as PaperType } from '../api/papers';

const HomePage = () => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState<string | null>(null);
  const [limitAlertOpen, setLimitAlertOpen] = useState(false);
  
  const { user, userData, forceRefreshUserData } = useAuthStore();
  const { 
    papers, 
    loading, 
    error, 
    fetchUserPapers, 
    deletePaper,
    watchPaperProgress,
    setRedirectOnCompletion
  } = usePaperStore();

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

  // ページロード時にリダイレクトを有効化
  useEffect(() => {
    // リダイレクト機能を有効化
    setRedirectOnCompletion(true);
    
    // クリーンアップでも状態を維持（他の画面での動作に影響しないため）
    return () => {
      // ここでfalseに戻さない
    };
  }, [setRedirectOnCompletion]);

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

  // 処理中の論文を監視
  useEffect(() => {
    if (latestProcessingPaper) {
      console.log(`Setting up global status watch for paper: ${latestProcessingPaper.id}`);
      // グローバルなStore内の監視機能を使用
      watchPaperProgress(latestProcessingPaper.id);
    }
  }, [latestProcessingPaper?.id, watchPaperProgress]);

  // 表示できる論文一覧（処理中以外または最新の処理中以外の論文）
  const displayablePapers = useMemo(() => {
    return papers
      .filter(paper => !latestProcessingPaper || paper.id !== latestProcessingPaper.id)
      .slice(0, 6); // 最大6件まで表示
  }, [papers, latestProcessingPaper]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        {/* 処理中の論文がない場合のみ「論文を翻訳する」見出しを表示 */}
        {!latestProcessingPaper && (
          <Box sx={{ display: 'flex', justifyContent: 'left', alignItems: 'left', mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              論文を翻訳する
            </Typography>
          </Box>
        )}

        {/* PDFアップロードエリアを画面幅いっぱいに拡大 */}
        <Grid container sx={{ mb: 6 }}> {/* ここに mb: 5 を追加 */}
          <Grid item xs={12}>
            {latestProcessingPaper ? (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom>
                  処理中の論文
                </Typography>
                <Card sx={{ mb: 3, boxShadow: 3 }}>
                  <CardContent sx={{ padding: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Chip
                        label={getStatusText(latestProcessingPaper.status)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {/* パーセンテージ表示を削除 */}
                    </Box>
                    
                    <Typography variant="h5" gutterBottom>
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
                          sx={{ height: 8, borderRadius: 4 }}
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
                      >
                        詳細を見る
                      </Button>
                      
                      <IconButton 
                        size="small"
                        color="error"
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
          </Grid>
        </Grid>

        {/* 論文一覧とプランカードを同じ高さレベルに配置 */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {/* 論文一覧 */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
                mb: 2 
              }}>
                <Typography variant="h5" component="h2">
                  最近の翻訳履歴
                </Typography>
                
                <Button
                  variant="outlined"
                  startIcon={<MenuBookIcon />}
                  onClick={() => navigate('/my-papers')}
                >
                  すべての論文を見る
                </Button>
              </Box>

              {loading ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography>読み込み中...</Typography>
                </Paper>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : displayablePapers.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <MenuBookIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.3 }} />
                  <Typography variant="h6">論文がありません</Typography>
                  <Typography variant="body2" color="text.secondary">
                    PDFをアップロードして論文を翻訳してみましょう
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={2}>
                  {displayablePapers.map((paper) => (
                    <Grid item xs={12} sm={6} key={paper.id}>
                      <Card variant="outlined">
                        <CardActionArea onClick={() => navigate(`/papers/${paper.id}`)}>
                          <CardContent sx={{ minHeight: 180 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Chip
                                label={getStatusText(paper.status)}
                                size="small"
                                color={
                                  paper.status === 'completed' ? 'success' :
                                  paper.status === 'error' ? 'error' :
                                  'primary'
                                }
                                variant={paper.status === 'completed' ? 'filled' : 'outlined'}
                              />
                              {/* パーセンテージ表示を削除 */}
                            </Box>
                            
                            <Typography variant="h6" noWrap title={paper.metadata?.title}>
                              {paper.metadata?.title || '無題の論文'}
                            </Typography>
                            
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {paper.metadata?.authors?.map(a => a.name).join(', ') || '著者不明'}
                            </Typography>
                            
                            {paper.metadata?.year && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                {paper.metadata.year}年
                              </Typography>
                            )}
                            
                            {paper.metadata?.journal && (
                              <Typography 
                                variant="caption" 
                                display="block" 
                                color="text.secondary"
                                sx={{ mt: 1 }}
                                noWrap
                              >
                                {paper.metadata.journal}
                              </Typography>
                            )}
                            
                            {paper.status === 'processing' && paper.progress && (
                              <Box sx={{ mt: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">処理中...</Typography>
                                  <Typography variant="caption" color="text.secondary">{paper.progress}%</Typography>
                                </Box>
                                <Box sx={{ width: '100%', mr: 1 }}>
                                  <LinearProgress variant="determinate" value={paper.progress} />
                                </Box>
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

          <Grid item xs={12} md={4}>
            {/* プロフィールと翻訳状況表示 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AccountCircleIcon />}
                onClick={() => navigate('/profile')}
              >
                プロフィール
              </Button>
            </Box>
            {userData && <SubscriptionInfoCard userData={userData} />}
            
            {/* 機能紹介 */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Smart Paper v2の機能
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <PictureAsPdfIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="論文の翻訳" 
                    secondary="英語論文を日本語に自動翻訳" 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <DescriptionIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="要約生成" 
                    secondary="論文の要点をAIが簡潔にまとめる" 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <ArrowForwardIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Zoteroに登録" 
                    secondary="ボタンクリックで自動でZoteroに論文を登録" 
                  />
                </ListItem>
              </List>
            </Paper>
            
            {/* プレミアムプラン宣伝 */}
            {!isPremium && (
              <Paper sx={{ p: 3, borderLeft: '4px solid', borderColor: 'primary.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <StarIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    プレミアム特典
                  </Typography>
                </Box>
                
                <List dense>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <StarIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="翻訳回数無制限" 
                      secondary="月3件の制限なくいつでも翻訳可能" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <StarIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="保存期間延長" 
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
                  sx={{ mt: 2 }}
                >
                  プレミアムにアップグレード
                </Button>
                <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 1 }}>
                  月額¥500 または 年額¥5,000 (月あたり¥417)
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Box>
      
      {/* 論文削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setPaperToDelete(null);
        }}
      >
        <DialogTitle>論文の削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この論文を削除しますか？この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setPaperToDelete(null);
            }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error"
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
      >
        <DialogTitle>翻訳制限に達しました</DialogTitle>
        <DialogContent>
          <DialogContentText>
            無料プランでは月に3件までしか翻訳できません。今月の翻訳回数上限に達しました。
            プレミアムプランにアップグレードすると、翻訳回数が無制限になります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLimitAlertOpen(false)}>
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