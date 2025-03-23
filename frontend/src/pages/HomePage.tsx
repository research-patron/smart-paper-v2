// ~/Desktop/smart-paper-v2/frontend/src/pages/HomePage.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Button, 
  Box, 
  Paper, 
  Grid, 
  Alert, 
  LinearProgress,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FilterListIcon from '@mui/icons-material/FilterList';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import StarIcon from '@mui/icons-material/Star';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import { uploadPDF } from '../api/papers';
import SubscriptionInfoCard from '../components/subscription/SubscriptionInfoCard';

const HomePage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState<string | null>(null);
  const [limitAlertOpen, setLimitAlertOpen] = useState(false);
  
  const { user, userData, forceRefreshUserData } = useAuthStore();
  const { papers, loading, error, fetchUserPapers, deletePaper } = usePaperStore();

  // ユーザーデータを初期ロード時に強制リフレッシュ
  useEffect(() => {
    if (user) {
      // ユーザーデータを強制的に更新
      forceRefreshUserData();
    }
  }, [user, forceRefreshUserData]);

  // ファイル入力参照
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 論文をフィルタリングするための関数
  const filteredPapers = searchTerm
    ? papers.filter(paper => 
        (paper.metadata?.title && paper.metadata.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (paper.metadata?.authors && paper.metadata.authors.some(author => 
          author.name.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      )
    : papers;

  // 検索条件をクリアする
  const clearSearch = () => {
    setSearchTerm('');
  };

  // PDFのアップロードを処理する関数
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    // 翻訳利用制限のチェック
    const isPremium = userData?.subscription_status === 'paid';
    const translationCount = userData?.translation_count || 0;
    
    // 無料会員は月3件まで
    if (!isPremium && translationCount >= 3) {
      setLimitAlertOpen(true);
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(10); // 初期進捗を10%に

      // プログレスバーのアニメーションのための擬似進捗更新
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 500);

      const file = files[0];
      const paperId = await uploadPDF(file, user.uid);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        // ユーザーデータを更新して翻訳カウントを最新状態に
        forceRefreshUserData();
        navigate(`/papers/${paperId}`);
      }, 500);
    } catch (error) {
      console.error('Failed to upload PDF:', error);
      setUploadError(error instanceof Error ? error.message : '論文のアップロードに失敗しました');
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [user, userData, navigate, forceRefreshUserData]);

  // ファイル選択ダイアログを開く
  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  // ドラッグ&ドロップのハンドラー
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileUpload(event.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  // 論文削除のハンドラー
  const handleConfirmDelete = async () => {
    if (!paperToDelete) return;
    
    try {
      await deletePaper(paperToDelete);
      setDeleteDialogOpen(false);
      setPaperToDelete(null);
    } catch (error) {
      console.error('Failed to delete paper:', error);
      setUploadError(error instanceof Error ? error.message : '論文の削除に失敗しました');
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
  const translationCount = userData?.translation_count || 0;
  const translationLimit = isPremium ? '無制限' : 3;
  const usagePercentage = !isPremium ? Math.min((translationCount / 3) * 100, 100) : 0;

  // 翻訳期間の日付を取得してフォーマット
  const formatDate = (date: any) => {
    if (!date) return null;
    
    try {
      // Firestoreのタイムスタンプ変換
      if (typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Date型または他の形式の場合
      return new Date(date).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return null;
    }
  };
  
  // 翻訳期間の表示テキストを作成
  const periodStartText = formatDate(userData?.translation_period_start);
  const periodEndText = formatDate(userData?.translation_period_end);
  const periodText = periodStartText && periodEndText
    ? `${periodStartText} 〜 ${periodEndText}`
    : '翻訳期間: 未設定';

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            論文を翻訳する
          </Typography>
          
          <Box>
            <Button
              variant="outlined"
              startIcon={<AccountCircleIcon />}
              onClick={() => navigate('/profile')}
              sx={{ mr: 1 }}
            >
              プロフィール
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {/* PDF アップロードエリア */}
            <Paper
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              sx={{
                p: 4,
                textAlign: 'center',
                mb: 5,
                borderStyle: 'dashed',
                cursor: 'pointer',
                background: theme => 
                  `linear-gradient(45deg, ${theme.palette.background.paper} 25%, ${theme.palette.grey[100]} 25%, ${theme.palette.grey[100]} 50%, ${theme.palette.background.paper} 50%, ${theme.palette.background.paper} 75%, ${theme.palette.grey[100]} 75%, ${theme.palette.grey[100]} 100%)`,
                backgroundSize: '20px 20px',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                }
              }}
              onClick={handleOpenFileDialog}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              
              <CloudUploadIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
              
              <Typography variant="h5" gutterBottom>
                PDFをドラッグ＆ドロップまたはクリックしてアップロード
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                サポートしているファイル形式: PDFのみ（最大20MB）
              </Typography>

              {isUploading && (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    アップロード中... {uploadProgress}%
                  </Typography>
                </Box>
              )}
            </Paper>

            {uploadError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {uploadError}
              </Alert>
            )}

            {/* 論文一覧 */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" component="h2">
                  あなたの論文
                </Typography>
                
                <TextField
                  variant="outlined"
                  size="small"
                  placeholder="論文またはユーザー名で検索"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={clearSearch}>
                          <FilterListIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{ width: { xs: '100%', sm: '300px' } }}
                />
              </Box>

              {loading ? (
                <LinearProgress />
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : filteredPapers.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  {searchTerm ? (
                    <>
                      <Typography variant="h6">検索結果なし</Typography>
                      <Typography variant="body2" color="text.secondary">
                        「{searchTerm}」に一致する論文は見つかりませんでした
                      </Typography>
                      <Button 
                        variant="text" 
                        onClick={clearSearch}
                        sx={{ mt: 1 }}
                      >
                        検索をクリア
                      </Button>
                    </>
                  ) : (
                    <>
                      <MenuBookIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.3 }} />
                      <Typography variant="h6">論文がありません</Typography>
                      <Typography variant="body2" color="text.secondary">
                        PDFをアップロードして論文を翻訳してみましょう
                      </Typography>
                    </>
                  )}
                </Paper>
              ) : (
                <Grid container spacing={2}>
                  {filteredPapers.map((paper) => (
                    <Grid item xs={12} sm={6} md={4} key={paper.id}>
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
                              {paper.status === 'processing' && paper.progress && (
                                <Typography variant="caption" color="text.secondary">
                                  {paper.progress}%
                                </Typography>
                              )}
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
                              <LinearProgress 
                                variant="determinate" 
                                value={paper.progress} 
                                sx={{ mt: 2 }}
                              />
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
                            onClick={(e) => {
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
              
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={handleOpenFileDialog}
                startIcon={<CloudUploadIcon />}
                sx={{ mt: 2 }}
              >
                論文を翻訳する
              </Button>
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
                  月額¥350 または 年額¥3,000 (月あたり¥250)
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
