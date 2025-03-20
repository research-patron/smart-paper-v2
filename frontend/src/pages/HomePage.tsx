import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Chip,
  Avatar,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  FormGroup,
  FormControlLabel,
  RadioGroup,
  Radio
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import ErrorIcon from '@mui/icons-material/Error';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import { uploadPDF } from '../api/papers';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, userData } = useAuthStore();
  const { 
    papers, 
    loading, 
    error, 
    clearError, 
    fetchUserPapers,
    deletePaper 
  } = usePaperStore();
  
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ドラッグ&ドロップ状態管理
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  
  // フィルターと並び替えの状態
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [filters, setFilters] = useState({
    completed: true,
    processing: true,
    error: true
  });
  const [sortBy, setSortBy] = useState<'title_asc' | 'title_desc' | 'date_newest' | 'date_oldest'>('date_newest');
  
  // ユーザーがログインしている場合、論文一覧を取得
  useEffect(() => {
    if (user) {
      fetchUserPapers(user.uid);
    }
  }, [user, fetchUserPapers]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        handleUpload(selectedFile);
      } else {
        setUploadError('PDFファイルのみアップロード可能です');
      }
    }
  };
  
  const handleUpload = async (selectedFile: File) => {
    if (!user) {
      setUploadError('ファイルをアップロードするにはログインが必要です');
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      
      // アップロード処理を開始
      // 進捗表示のためのインターバル（実際にはアップロード進捗を監視する処理が入る）
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + 5;
        });
      }, 300);
      
      // PDFのアップロード
      const paperId = await uploadPDF(selectedFile, user.uid);
      
      clearInterval(interval);
      setUploadProgress(100);
      
      // アップロード完了後、1秒待ってから論文ページに遷移
      setTimeout(() => {
        setUploading(false);
        navigate(`/papers/${paperId}`);
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : '論文のアップロードに失敗しました');
      setUploading(false);
    }
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    dragCounterRef.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        handleUpload(droppedFile);
      } else {
        setUploadError('PDFファイルのみアップロード可能です');
      }
    }
  };
  
  const handleDeleteClick = (paperId: string) => {
    setPaperToDelete(paperId);
    setDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (paperToDelete) {
      try {
        await deletePaper(paperToDelete);
        setPaperToDelete(null);
        setDeleteDialogOpen(false);
      } catch (error) {
        console.error('Delete error:', error);
        // エラー処理
      }
    }
  };
  
  const handleCancelDelete = () => {
    setPaperToDelete(null);
    setDeleteDialogOpen(false);
  };
  
  // フィルターメニュー操作
  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };
  
  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };
  
  const handleFilterChange = (filterName: keyof typeof filters) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };
  
  // 並び替えメニュー操作
  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  };
  
  const handleSortClose = () => {
    setSortAnchorEl(null);
  };
  
  const handleSortChange = (value: typeof sortBy) => {
    setSortBy(value);
    setSortAnchorEl(null);
  };
  
  // 検索条件とフィルターに基づいて論文をフィルタリング
  const filteredPapers = papers.filter(paper => {
    // 検索クエリでフィルタリング
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (paper.metadata?.title?.toLowerCase().includes(query)) ||
        (paper.metadata?.authors?.some(author => author.name.toLowerCase().includes(query))) ||
        (paper.metadata?.journal?.toLowerCase().includes(query)) ||
        // キーワードでの検索を追加
        (paper.metadata?.keywords?.some(keyword => keyword.toLowerCase().includes(query)));
      
      if (!matchesSearch) return false;
    }
    
    // ステータスでフィルタリング
    if (paper.status === 'completed' && !filters.completed) return false;
    if (['pending', 'metadata_extracted', 'processing'].includes(paper.status) && !filters.processing) return false;
    if (paper.status === 'error' && !filters.error) return false;
    
    return true;
  });

  // フィルタリングされた論文を並び替え
  const sortedPapers = [...filteredPapers].sort((a, b) => {
    switch (sortBy) {
      case 'title_asc':
        return (a.metadata?.title || '').localeCompare(b.metadata?.title || '');
      case 'title_desc':
        return (b.metadata?.title || '').localeCompare(a.metadata?.title || '');
      case 'date_newest':
        // Timestampオブジェクトの場合とDate型の場合を処理
        const dateA = typeof a.uploaded_at?.toDate === 'function' ? a.uploaded_at.toDate() : a.uploaded_at;
        const dateB = typeof b.uploaded_at?.toDate === 'function' ? b.uploaded_at.toDate() : b.uploaded_at;
        return dateB instanceof Date && dateA instanceof Date ? dateB.getTime() - dateA.getTime() : 0;
      case 'date_oldest':
        // Timestampオブジェクトの場合とDate型の場合を処理
        const dateC = typeof a.uploaded_at?.toDate === 'function' ? a.uploaded_at.toDate() : a.uploaded_at;
        const dateD = typeof b.uploaded_at?.toDate === 'function' ? b.uploaded_at.toDate() : b.uploaded_at;
        return dateC instanceof Date && dateD instanceof Date ? dateC.getTime() - dateD.getTime() : 0;
      default:
        return 0;
    }
  });

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ minHeight: '100vh' }}
    >
      <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
        {/* ドラッグオーバーレイ */}
        {isDragging && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 72, mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              PDFファイルをドロップしてアップロード
            </Typography>
            <Typography variant="body1">
              PDFファイルをここにドロップして論文の翻訳を開始します
            </Typography>
          </Box>
        )}
        
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Smart Paper v2
          </Typography>
          <Typography variant="h6" component="h2" color="text.secondary" gutterBottom>
            研究論文を素早く読み、整理し、理解するためのAIツール
          </Typography>
        </Box>
        
        {/* エラー表示 */}
        {error && (
          <Alert 
            severity="error" 
            onClose={clearError}
            sx={{ mb: 3 }}
          >
            {error}
          </Alert>
        )}
        
        {/* アップロードエラー表示 */}
        {uploadError && (
          <Alert 
            severity="error" 
            onClose={() => setUploadError(null)}
            sx={{ mb: 3 }}
          >
            {uploadError}
          </Alert>
        )}
        
        {/* 論文アップロードセクション */}
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            mb: 4,
            borderStyle: 'dashed',
            borderWidth: 2,
            borderColor: 'primary.light',
            backgroundColor: 'background.default',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Box sx={{ width: '100%', textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                アップロード中...
              </Typography>
              <Box sx={{ width: '100%', mb: 2 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {`${Math.round(uploadProgress)}%`}
              </Typography>
            </Box>
          ) : (
            <>
              <input
                type="file"
                accept=".pdf"
                hidden
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              <CloudUploadIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
              
              <Typography variant="h5" gutterBottom>
                PDFファイルをドラッグ＆ドロップ
              </Typography>
              
              <Typography variant="body1" color="text.secondary" paragraph>
                または
              </Typography>
              
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                size="large"
              >
                PDFを選択
              </Button>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                最大ファイルサイズ: 20MB
              </Typography>
            </>
          )}
        </Paper>
        
        {/* ログインプロモーション（非ログイン時） */}
        {!user && (
          <Alert 
            severity="info" 
            sx={{ mb: 4 }}
            action={
              <Button color="inherit" size="small" onClick={() => navigate('/login')}>
                ログイン
              </Button>
            }
          >
            翻訳済み論文を保存したり、高度な機能を利用するにはログインが必要です。
          </Alert>
        )}
        
        {/* マイ論文セクション（ログイン時） */}
        {user && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" component="h2">
                マイ論文
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  placeholder="論文を検索..."
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 250 }}
                />
                
                <Tooltip title="フィルター">
                  <IconButton onClick={handleFilterClick}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="並び替え">
                  <IconButton onClick={handleSortClick}>
                    <SortIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* フィルターメニュー */}
            <Menu
              anchorEl={filterAnchorEl}
              open={Boolean(filterAnchorEl)}
              onClose={handleFilterClose}
            >
              <MenuItem dense>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  ステータスでフィルター
                </Typography>
              </MenuItem>
              <MenuItem>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={filters.completed}
                      onChange={() => handleFilterChange('completed')}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CloudDoneIcon fontSize="small" color="success" sx={{ mr: 1 }} />
                      <Typography variant="body2">翻訳済み</Typography>
                    </Box>
                  }
                />
              </MenuItem>
              <MenuItem>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={filters.processing}
                      onChange={() => handleFilterChange('processing')}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CloudSyncIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2">処理中</Typography>
                    </Box>
                  }
                />
              </MenuItem>
              <MenuItem>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={filters.error}
                      onChange={() => handleFilterChange('error')}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ErrorIcon fontSize="small" color="error" sx={{ mr: 1 }} />
                      <Typography variant="body2">エラー</Typography>
                    </Box>
                  }
                />
              </MenuItem>
            </Menu>
            
            {/* 並び替えメニュー */}
            <Menu
              anchorEl={sortAnchorEl}
              open={Boolean(sortAnchorEl)}
              onClose={handleSortClose}
            >
              <MenuItem dense>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  並び替え
                </Typography>
              </MenuItem>
              <MenuItem 
                onClick={() => handleSortChange('title_asc')}
                selected={sortBy === 'title_asc'}
              >
                <ListItemIcon>
                  <SortByAlphaIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="タイトル (A-Z)" />
              </MenuItem>
              <MenuItem 
                onClick={() => handleSortChange('title_desc')}
                selected={sortBy === 'title_desc'}
              >
                <ListItemIcon>
                  <SortByAlphaIcon fontSize="small" sx={{ transform: 'scaleY(-1)' }} />
                </ListItemIcon>
                <ListItemText primary="タイトル (Z-A)" />
              </MenuItem>
              <MenuItem 
                onClick={() => handleSortChange('date_newest')}
                selected={sortBy === 'date_newest'}
              >
                <ListItemIcon>
                  <DateRangeIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="最新のアップロード順" />
              </MenuItem>
              <MenuItem 
                onClick={() => handleSortChange('date_oldest')}
                selected={sortBy === 'date_oldest'}
              >
                <ListItemIcon>
                  <DateRangeIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="古いアップロード順" />
              </MenuItem>
            </Menu>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : sortedPapers.length === 0 ? (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 4, 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <Typography variant="h6" gutterBottom>
                  まだ論文がありません
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  PDFをアップロードして、論文の翻訳と分析を始めましょう。
                </Typography>
                <Button 
                  variant="contained" 
                  startIcon={<UploadFileIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  PDFをアップロード
                </Button>
              </Paper>
            ) : (
              <Grid container spacing={3}>
                {sortedPapers.map((paper) => (
                  <Grid item xs={12} md={6} key={paper.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                            {paper.metadata?.title || '無題の論文'}
                          </Typography>
                          
                          <Box>
                            {paper.status === 'completed' && (
                              <Chip
                                icon={<CloudDoneIcon />}
                                label="翻訳済み"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                            {['pending', 'metadata_extracted', 'processing'].includes(paper.status) && (
                              <Chip
                                icon={<CloudSyncIcon />}
                                label="処理中"
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            )}
                            {paper.status === 'error' && (
                              <Chip
                                icon={<ErrorIcon />}
                                label="エラー"
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                        
                        {/* 著者名と出版ジャーナル情報を削除 */}
                        
                        {['pending', 'metadata_extracted', 'processing'].includes(paper.status) && (
                          <Box sx={{ width: '100%', mt: 2 }}>
                            <LinearProgress variant="determinate" value={paper.progress || 0} />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {paper.status === 'pending' ? '準備中...' : 
                               paper.status === 'metadata_extracted' ? 'メタデータ抽出完了...' : 
                               `処理中... ${paper.progress || 0}%`}
                            </Typography>
                          </Box>
                        )}
                        
                        {paper.uploaded_at && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            アップロード日: {
                              // Timestampオブジェクトの場合
                              typeof paper.uploaded_at.toDate === 'function' ? 
                                format(paper.uploaded_at.toDate(), 'yyyy/MM/dd HH:mm') : 
                                // Date型だった場合
                                paper.uploaded_at instanceof Date ? 
                                  format(paper.uploaded_at, 'yyyy/MM/dd HH:mm') : 
                                  // 文字列などその他の場合
                                  String(paper.uploaded_at)
                            }
                          </Typography>
                        )}
                      </CardContent>
                      
                      <Divider />
                      
                      <CardActions>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => navigate(`/papers/${paper.id}`)}
                          sx={{ '&:hover': { boxShadow: 2 } }}
                          startIcon={<SearchIcon />}
                        >
                          詳細を見る
                        </Button>
                        
                        <Box sx={{ ml: 'auto' }}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(paper.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
        
        {/* サブスクリプション情報 */}
        {user && userData && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                現在のプラン: {userData.subscription_status === 'paid' ? 'プレミアムプラン' : '無料プラン'}
              </Typography>
              
              {userData.subscription_status !== 'paid' && (
                <Button
                  variant="outlined"
                  size="small"
                  color="primary"
                  onClick={() => navigate('/subscription')}
                >
                  プレミアムにアップグレード
                </Button>
              )}
            </Box>
          </Box>
        )}
        
        {/* 削除確認ダイアログ */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleCancelDelete}
        >
          <DialogTitle>論文を削除しますか？</DialogTitle>
          <DialogContent>
            <DialogContentText>
              この操作は元に戻せません。論文と関連するすべてのデータが削除されます。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelDelete}>キャンセル</Button>
            <Button onClick={handleConfirmDelete} color="error" autoFocus>
              削除
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default HomePage;