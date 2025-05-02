// ~/Desktop/smart-paper-v2/frontend/src/pages/HomePage.tsx
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  CircularProgress,
  Divider,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import StarIcon from '@mui/icons-material/Star';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PublicIcon from '@mui/icons-material/Public';
import LoginIcon from '@mui/icons-material/Login';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import SubscriptionInfoCard from '../components/subscription/SubscriptionInfoCard';
import PdfUpload from '../components/papers/PdfUpload';
import { Paper as PaperType, getPublicPapers } from '../api/papers';

const HomePage = () => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState<string | null>(null);
  const [limitAlertOpen, setLimitAlertOpen] = useState(false);
  const [publicPapers, setPublicPapers] = useState<PaperType[]>([]);
  const [loadingPublicPapers, setLoadingPublicPapers] = useState(false);
  
  // ファイル選択状態を追加
  const [isFileSelected, setIsFileSelected] = useState(false);
  // 一時的な処理中論文データ
  const [tempProcessingPaper, setTempProcessingPaper] = useState<PaperType | null>(null);
  // データ更新用タイマーの参照
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 論文IDの参照（タイマー内で最新の値を使用するため）
  const paperIdRef = useRef<string | null>(null);
  // サイレント更新フラグ（ロード表示を避けるため）
  const [silentUpdate, setSilentUpdate] = useState(false);
  // ローカルのローディング状態
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  const { user, userData, forceRefreshUserData } = useAuthStore();
  const { 
    papers, 
    loading, 
    error, 
    fetchUserPapers, 
    deletePaper,
    watchPaperProgress,
    setRedirectOnCompletion,
    clearError
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

  // 独自の論文データ更新関数（サイレント更新）
  const silentlyUpdatePapers = useCallback(async () => {
    if (!user) return;
    
    try {
      // サイレント更新フラグを設定
      setSilentUpdate(true);
      // エラーをクリア
      clearError();
      // 論文データを取得
      await fetchUserPapers(user.uid);
    } catch (error) {
      console.error('Failed to silently update papers:', error);
    } finally {
      // 更新完了後にフラグをリセット
      setSilentUpdate(false);
    }
  }, [user, fetchUserPapers, clearError]);

  // 公開論文を取得する - 非会員ユーザーの場合のみ
  const fetchPublicPapers = async () => {
    // ログイン済みユーザーの場合は公開論文を表示しない
    if (user) {
      setPublicPapers([]);
      return;
    }
    
    try {
      setLoadingPublicPapers(true);
      
      // 公開設定されている論文を取得
      const papersList = await getPublicPapers(6);
      setPublicPapers(papersList);
      
    } catch (error) {
      console.error('Failed to fetch public papers:', error);
    } finally {
      setLoadingPublicPapers(false);
    }
  };

  // 公開論文データを初期ロード - ユーザー状態に応じて実行
  useEffect(() => {
    fetchPublicPapers();
  }, [user]); // userの状態が変わったら再取得（ログイン/ログアウト時）

  // PDFアップロード成功時の処理
  const handleUploadSuccess = useCallback((paperId: string) => {
    // 論文IDを参照に保存（タイマー内で使用するため）
    paperIdRef.current = paperId;
    forceRefreshUserData();
    
    // 論文データを更新（初回はサイレント更新ではない）
    if (user) {
      fetchUserPapers(user.uid);
    }
    
    // 一定時間後に自動更新を開始
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    
    // 10秒後に自動更新を開始（アップロード処理が完了するまでの猶予）
    refreshTimerRef.current = setTimeout(() => {
      startPeriodicRefresh();
    }, 10000);
    
  }, [forceRefreshUserData, fetchUserPapers, user]);

  // 定期的な論文データ更新を開始
  const startPeriodicRefresh = useCallback(() => {
    // 既存のタイマーがあればクリア
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    
    // 8秒ごとに論文データを更新（サイレント更新を使用）
    refreshTimerRef.current = setInterval(() => {
      if (user) {
        console.log('Silently refreshing paper data...');
        silentlyUpdatePapers();
      }
    }, 8000);
    
    // ログ出力
    console.log('Periodic refresh started');
  }, [silentlyUpdatePapers, user]);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  // 新しい関数: ファイル選択時の処理
  const handleFileSelect = useCallback((file: File) => {
    // ファイル選択状態を有効化
    setIsFileSelected(true);
    
    // 未ログインの場合は何もしない（PdfUploadコンポーネント側で処理）
    if (!user) return;
    
    // 一時的な処理中論文データを作成
    const tempPaper: PaperType = {
      id: 'temp_' + Date.now(),
      user_id: user?.uid || '',
      file_path: '',
      status: 'pending',
      uploaded_at: { toMillis: () => Date.now() } as any,
      completed_at: null,
      metadata: {
        title: file.name.replace('.pdf', ''),
        authors: [],
        year: new Date().getFullYear(),
        journal: '',
        doi: '',
        keywords: [],
        abstract: ''
      },
      chapters: null,
      summary: null,
      translated_text: null,
      translated_text_path: null,
      progress: 5
    };
    
    setTempProcessingPaper(tempPaper);
    
    // 一定時間後に自動更新を開始
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    
    // 15秒後に強制的にユーザーの論文を再取得（アップロード完了を想定）
    refreshTimerRef.current = setTimeout(() => {
      if (user) {
        console.log('Forced refresh after file selection');
        silentlyUpdatePapers();
        
        // 定期更新も開始
        startPeriodicRefresh();
      }
    }, 15000);
    
  }, [user, silentlyUpdatePapers, startPeriodicRefresh]);

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
      // 初回ロードのみフラグを更新
      fetchUserPapers(user.uid).finally(() => {
        setInitialLoadComplete(true);
      });
    }
  }, [user, fetchUserPapers]);

  // ページロード時にリダイレクトを有効化
  useEffect(() => {
    // リダイレクト機能を有効化
    setRedirectOnCompletion(true);
    
    // クリーンアップでも状態を維持
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

  // 最新の処理中の論文を、実際のものか一時的なものかで判断
  const latestProcessingPaper = useMemo(() => {
    // ファイルが選択されたばかりでまだアップロード中なら一時データを優先
    if (isFileSelected && tempProcessingPaper) {
      return tempProcessingPaper;
    }
    // 実際のデータがあればそれを表示
    return processingPapers.length > 0 ? processingPapers[0] : null;
  }, [isFileSelected, tempProcessingPaper, processingPapers]);

  // アップロード完了時に一時データをクリア
  useEffect(() => {
    if (isFileSelected && processingPapers.length > 0) {
      console.log('Real paper data loaded, clearing temporary data');
      
      // 実際の論文データが取得できたら一時データを破棄
      setIsFileSelected(false);
      setTempProcessingPaper(null);
      
      // 定期更新も開始（まだ開始されていない場合）
      startPeriodicRefresh();
    }
  }, [isFileSelected, processingPapers, startPeriodicRefresh]);

  // 処理中の論文を監視
  useEffect(() => {
    if (latestProcessingPaper && !isFileSelected && user) {
      // 実際の論文データの場合はwatchPaperProgressを呼び出す
      // （一時データの場合は呼ばない）
      watchPaperProgress(latestProcessingPaper.id);
      
      // 論文IDを参照に保存
      paperIdRef.current = latestProcessingPaper.id;
    }
  }, [latestProcessingPaper?.id, watchPaperProgress, isFileSelected, user]);

  // 論文の完了またはエラー状態を監視し、定期更新を停止
  useEffect(() => {
    // 処理中の論文が完了またはエラー状態になったら定期更新を停止
    if (processingPapers.length > 0) {
      const latestPaper = processingPapers[0];
      if (latestPaper.status === 'completed' || latestPaper.status === 'error') {
        if (refreshTimerRef.current) {
          console.log('Paper processing completed or failed, stopping periodic refresh');
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
    }
  }, [processingPapers]);

  // 表示できる論文一覧（処理中以外または最新の処理中以外の論文）
  const displayablePapers = useMemo(() => {
    if (!user) return [];
    
    return papers
      .filter(paper => !latestProcessingPaper || paper.id !== latestProcessingPaper.id)
      .slice(0, 6); // 最大6件まで表示
  }, [papers, latestProcessingPaper, user]);

  // ローディング状態の計算 - サイレント更新中は表示用のローディングをfalseにする
  const showLoading = loading && !silentUpdate && !initialLoadComplete && user && displayablePapers.length === 0;

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        {/* 未ログインユーザー向けウェルカムメッセージ */}
        {!user && (
          <Box sx={{ mb: 8 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7}>
                <Typography variant="h3" component="h1" gutterBottom>
                  Smart Paper V2
                </Typography>
                <Typography variant="h5" color="text.secondary" gutterBottom>
                  英語論文を簡単に日本語で理解
                </Typography>
                <Typography variant="body1" paragraph>
                  Smart Paper V2は、英語で書かれた学術論文を日本語に翻訳し、要約してくれるAIツールです。
                  研究者や学生の論文読解をサポートします。
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="large"
                    startIcon={<LoginIcon />}
                    onClick={() => navigate('/login')}
                  >
                    ログイン
                  </Button>
                  <Button 
                    variant="outlined"
                    size="large"
                    startIcon={<HowToRegIcon />}
                    onClick={() => navigate('/register')}
                  >
                    会員登録
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} md={5}>
                <Box component="img" 
                  src="/images/paper-illustration.png" 
                  alt="論文翻訳イメージ"
                  sx={{ 
                    width: '100%', 
                    maxWidth: 400,
                    display: 'block',
                    mx: 'auto'
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* 装飾的な区切り線（非会員ユーザーにのみ表示） */}
        {!user ? (
          <Box sx={{ position: 'relative', my: 4 }}>
            <Divider sx={{ 
              borderColor: 'primary.main',
              borderWidth: 2,
              width: '100%',
              opacity: 0.7
            }} />
            <Box sx={{
              position: 'absolute',
              top: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'background.default',
              px: 3,
            }}>
              <Typography 
                variant="h4" 
                component="h2" 
                align="center"
                sx={{ 
                  color: 'primary.main',
                  fontWeight: 'medium'
                }}
              >
                論文を翻訳する
              </Typography>
            </Box>
          </Box>
        ) : (
          /* 会員ユーザー向けに元のシンプルな見出し */
          !latestProcessingPaper && (
            <Box sx={{ display: 'flex', justifyContent: 'left', alignItems: 'left', mb: 1 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                論文を翻訳する
              </Typography>
            </Box>
          )
        )}

        {/* PDFアップロードエリアを画面幅いっぱいに拡大 */}
        <Grid container sx={{ mb: 6 }}>
          <Grid item xs={12}>
            {user && latestProcessingPaper ? (
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
                        disabled={isFileSelected} // 一時データの場合はボタンを無効化
                      >
                        詳細を見る
                      </Button>
                      
                      <IconButton 
                        size="small"
                        color="error"
                        onClick={() => {
                          if (!isFileSelected) { // 一時データの場合は削除しない
                            setPaperToDelete(latestProcessingPaper.id);
                            setDeleteDialogOpen(true);
                          }
                        }}
                        disabled={isFileSelected} // 一時データの場合はボタンを無効化
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <PdfUpload 
                onUploadSuccess={handleUploadSuccess} 
                onFileSelect={handleFileSelect} // 新しいコールバックを追加
              />
            )}
          </Grid>
        </Grid>

        {/* 公開論文セクション - 非ログインユーザーのみに表示 */}
        {!user && publicPapers.length > 0 && (
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              公開されている論文
            </Typography>
            
            {loadingPublicPapers ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {publicPapers.map((paper) => (
                  <Grid item xs={12} sm={6} md={4} key={paper.id}>
                    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardActionArea 
                        onClick={() => navigate(`/papers/${paper.id}`)}
                        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                      >
                        <CardContent sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, width: '100%' }}>
                            <Chip
                              icon={<PublicIcon />}
                              label="公開論文"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
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

                          {/* 短い要約（あれば） */}
                          {paper.summary && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mt: 2,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {paper.summary.slice(0, 100)}...
                            </Typography>
                          )}
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* 論文一覧とプランカードを同じ高さレベルに配置 */}
        <Grid container spacing={3}>
          {/* 論文一覧（ログイン済みの場合のみ） */}
          {user && (
            <Grid item xs={12} md={8}>
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

                {showLoading ? (
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
                                {paper.public && (
                                  <Chip
                                    icon={<PublicIcon />}
                                    label="公開中"
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
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
          )}

          <Grid item xs={12} md={user ? 4 : 12}>
            {/* ログイン済みユーザー向け：プロフィールと翻訳状況表示 */}
            {user && (
              <>
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
              </>
            )}
            
            {/* ここから非会員向けブロックを削除 */}
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