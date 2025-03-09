// ~/Desktop/smart-paper-v2/frontend/src/pages/HomePage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  CardActions, 
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import ArticleIcon from '@mui/icons-material/Article';
import PdfUpload from '../components/papers/PdfUpload';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import { Paper } from '../api/papers';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, userData } = useAuthStore();
  const { papers, loading, error, fetchUserPapers, deletePaper } = usePaperStore();
  const [showUpload, setShowUpload] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState<string | null>(null);
  
  // 論文一覧の取得
  useEffect(() => {
    if (user) {
      fetchUserPapers(user.uid);
    }
  }, [user, fetchUserPapers]);
  
  // アップロード成功時の処理
  const handleUploadSuccess = (paperId: string) => {
    setShowUpload(false);
    // 論文ビューページに遷移
    navigate(`/papers/${paperId}`);
  };
  
  // 論文削除の確認ダイアログを開く
  const handleDeleteClick = (paperId: string) => {
    setPaperToDelete(paperId);
    setDeleteDialogOpen(true);
  };
  
  // 論文削除の実行
  const handleDeleteConfirm = async () => {
    if (paperToDelete) {
      await deletePaper(paperToDelete);
      setDeleteDialogOpen(false);
      setPaperToDelete(null);
    }
  };
  
  // 論文削除のキャンセル
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPaperToDelete(null);
  };
  
  // 翻訳の制限をチェック
  const canUploadNewPaper = (): boolean => {
    if (!userData) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 今日アップロードした論文の数を集計
    const todayUploads = papers.filter(paper => {
      const uploadDate = paper.uploaded_at.toDate();
      uploadDate.setHours(0, 0, 0, 0);
      return uploadDate.getTime() === today.getTime();
    }).length;
    
    // サブスクリプションレベルに応じた制限
    if (userData.subscription_status === 'paid') {
      return true; // 無制限
    } else if (userData.subscription_status === 'free') {
      return todayUploads < 3; // 1日3個まで
    } else {
      return todayUploads < 1; // 1日1個まで
    }
  };
  
  // ステータスに応じたチップの色を取得
  const getStatusChipColor = (status: Paper['status']) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'metadata_extracted':
      case 'processing':
        return 'warning';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // ステータスの日本語表示を取得
  const getStatusLabel = (status: Paper['status']) => {
    switch (status) {
      case 'pending':
        return '準備中';
      case 'metadata_extracted':
        return 'メタデータ抽出済み';
      case 'processing':
        return '処理中';
      case 'completed':
        return '完了';
      case 'error':
        return 'エラー';
      default:
        return status;
    }
  };
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Smart Paper v2
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          英語論文を簡単に翻訳・要約・管理
        </Typography>
        
        {!user ? (
          // 未ログインユーザー向け
          <Box sx={{ my: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              論文をアップロードして翻訳を始めましょう
            </Typography>
            <Typography variant="body1" paragraph>
              英語論文の理解を簡単に。AI翻訳で研究をサポートします。
            </Typography>
            <Button 
              variant="contained" 
              size="large" 
              onClick={() => navigate('/login')}
              sx={{ mt: 2 }}
            >
              ログインして始める
            </Button>
          </Box>
        ) : (
          // ログインユーザー向け
          <>
            {!showUpload ? (
              <Box sx={{ mt: 4, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5">
                  マイ論文
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowUpload(true)}
                  disabled={!canUploadNewPaper()}
                >
                  新しい論文をアップロード
                </Button>
              </Box>
            ) : (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h5" gutterBottom>
                  PDFをアップロード
                </Typography>
                <PdfUpload onUploadSuccess={handleUploadSuccess} />
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => setShowUpload(false)}
                  >
                    キャンセル
                  </Button>
                </Box>
              </Box>
            )}
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            ) : papers.length === 0 ? (
              <Box sx={{ textAlign: 'center', my: 4 }}>
                <ArticleIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  まだ論文がありません
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  「新しい論文をアップロード」ボタンからPDFをアップロードしてください
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={3} sx={{ mt: 1 }}>
                {papers.map((paper) => (
                  <Grid item xs={12} sm={6} md={4} key={paper.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" component="div" noWrap>
                          {paper.metadata?.title || '無題の論文'}
                        </Typography>
                        <Typography sx={{ mb: 1.5 }} color="text.secondary" noWrap>
                          {paper.metadata?.authors?.map(author => author.name).join(', ') || '著者不明'}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">
                            {paper.uploaded_at ? new Date(paper.uploaded_at.seconds * 1000).toLocaleDateString() : ''}
                          </Typography>
                          <Chip 
                            label={getStatusLabel(paper.status)} 
                            size="small" 
                            color={getStatusChipColor(paper.status)}
                          />
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button 
                          size="small" 
                          startIcon={<VisibilityIcon />}
                          onClick={() => navigate(`/papers/${paper.id}`)}
                        >
                          詳細
                        </Button>
                        <Button 
                          size="small" 
                          startIcon={<DeleteIcon />}
                          color="error"
                          onClick={() => handleDeleteClick(paper.id)}
                        >
                          削除
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Box>
      
      {/* 論文削除の確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>論文を削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この操作は元に戻せません。論文とその翻訳結果がすべて削除されます。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>キャンセル</Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default HomePage;