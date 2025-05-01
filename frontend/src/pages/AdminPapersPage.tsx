import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ScienceIcon from '@mui/icons-material/Science';
import PublicIcon from '@mui/icons-material/Public';
import PrivateIcon from '@mui/icons-material/LockOutlined';

import { useAuthStore } from '../store/authStore';
import { getAdminPapers, getReportedPapers, togglePaperPublicStatus } from '../api/admin';
import { Paper as PaperType, formatDate } from '../api/papers';

// タブの値定義
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// タブパネル
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-paper-tabpanel-${index}`}
      aria-labelledby={`admin-paper-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

// 論文のステータスに応じたチップを返す
const StatusChip = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending':
      return <Chip size="small" label="処理待ち" color="default" />;
    case 'metadata_extracted':
      return <Chip size="small" label="メタデータ抽出完了" color="info" />;
    case 'processing':
      return <Chip size="small" label="翻訳中" color="primary" />;
    case 'completed':
      return (
        <Chip
          size="small"
          label="完了"
          color="success"
          icon={<CheckCircleIcon />}
        />
      );
    case 'error':
      return (
        <Chip
          size="small"
          label="エラー"
          color="error"
          icon={<ErrorIcon />}
        />
      );
    case 'reported':
      return (
        <Chip
          size="small"
          label="問題報告あり"
          color="warning"
          icon={<ReportProblemIcon />}
          sx={{ 
            fontWeight: 'bold',
            animation: 'pulse 2s infinite'
          }}
        />
      );
    case 'problem':
      return (
        <Chip
          size="small"
          label="問題発生"
          color="error"
          icon={<ReportProblemIcon />}
          sx={{ 
            fontWeight: 'bold',
            bgcolor: 'error.dark',
            animation: 'pulse 2s infinite'
          }}
        />
      );
    default:
      return <Chip size="small" label="不明" color="default" />;
  }
};

const AdminPapersPage = () => {
  const navigate = useNavigate();
  const { user, userData } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [papers, setPapers] = useState<PaperType[]>([]);
  const [reportedPapers, setReportedPapers] = useState<PaperType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [publicPapers, setPublicPapers] = useState<PaperType[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paperToToggle, setPaperToToggle] = useState<PaperType | null>(null);

  // マスターアカウントとその他の管理者アカウントを区別
  const isMasterAdmin = user?.email === 's.kosei0626@gmail.com';
  const isAdmin = isMasterAdmin || user?.email === 'smart-paper-v2@student-subscription.com';

  // 論文データを取得
  const fetchPapers = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // 全ての論文を取得
      const allPapers = await getAdminPapers();
      setPapers(allPapers);
      
      // 公開設定されている論文を抽出
      const publicPapers = allPapers.filter(paper => paper.public === true);
      setPublicPapers(publicPapers);
      
      // 問題報告がある論文を取得
      const reported = await getReportedPapers();
      setReportedPapers(reported);
    } catch (err) {
      console.error('Error fetching admin papers:', err);
      setError('論文データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // 公開状態を切り替える
  const handleTogglePublic = async (paper: PaperType) => {
    setPaperToToggle(paper);
    setConfirmDialogOpen(true);
  };

  // 公開状態切り替え確認
  const confirmTogglePublic = async () => {
    if (!paperToToggle) return;
    
    try {
      setLoading(true);
      
      // 公開状態を反転
      const newPublicStatus = !paperToToggle.public;
      
      // APIを呼び出して公開状態を更新
      await togglePaperPublicStatus(paperToToggle.id, newPublicStatus);
      
      // ローカルの状態を更新
      setPapers(prevPapers => 
        prevPapers.map(p => 
          p.id === paperToToggle.id 
            ? { ...p, public: newPublicStatus } 
            : p
        )
      );
      
      // 公開論文リストも更新
      if (newPublicStatus) {
        setPublicPapers(prev => [...prev, { ...paperToToggle, public: true }]);
      } else {
        setPublicPapers(prev => prev.filter(p => p.id !== paperToToggle.id));
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error('Failed to toggle public status:', err);
      setError('公開状態の更新に失敗しました。');
      setLoading(false);
    }
    
    setConfirmDialogOpen(false);
    setPaperToToggle(null);
  };

  // 初回ロード時にデータを取得
  useEffect(() => {
    if (isAdmin) {
      fetchPapers();
    } else if (user) {
      // 管理者でない場合はホームページにリダイレクト
      navigate('/');
    }
  }, [user, isAdmin, navigate]);

  // タブ切り替え
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 検索関数
  const filterPapers = (papers: PaperType[]) => {
    if (!searchTerm.trim()) return papers;
    
    const term = searchTerm.toLowerCase();
    return papers.filter(paper => 
      paper.metadata?.title?.toLowerCase().includes(term) ||
      paper.metadata?.authors?.some(a => a.name.toLowerCase().includes(term)) ||
      paper.id.toLowerCase().includes(term)
    );
  };

  if (!isAdmin) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Alert severity="error">
            このページにアクセスする権限がありません。
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1">
            管理者用論文一覧
            {isMasterAdmin && (
              <Chip
                size="small"
                label="マスター管理者"
                color="primary"
                sx={{ ml: 2, fontWeight: 'bold' }}
              />
            )}
          </Typography>
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchPapers}
          >
            更新
          </Button>
        </Box>

        <Paper sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="admin paper tabs"
            >
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <span>すべての論文</span>
                    <Chip 
                      label={papers.length} 
                      size="small" 
                      sx={{ ml: 1 }} 
                    />
                  </Box>
                } 
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ReportProblemIcon sx={{ mr: 0.5, color: 'warning.main' }} />
                    <span>問題報告あり</span>
                    <Chip 
                      label={reportedPapers.length} 
                      size="small" 
                      color="warning"
                      sx={{ ml: 1 }} 
                    />
                  </Box>
                } 
              />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PublicIcon sx={{ mr: 0.5, color: 'success.main' }} />
                    <span>公開中の論文</span>
                    <Chip 
                      label={publicPapers.length} 
                      size="small" 
                      color="success"
                      sx={{ ml: 1 }} 
                    />
                  </Box>
                } 
              />
            </Tabs>
          </Box>
          
          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="タイトル、著者名、ID で検索..."
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
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : (
          <>
            <TabPanel value={tabValue} index={0}>
              <PaperTable 
                papers={filterPapers(papers)}
                navigate={navigate}
                isMasterAdmin={isMasterAdmin}
                onTogglePublic={handleTogglePublic}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <PaperTable 
                papers={filterPapers(reportedPapers)}
                navigate={navigate}
                isMasterAdmin={isMasterAdmin}
                isReportedView
                onTogglePublic={handleTogglePublic}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={2}>
              <PaperTable 
                papers={filterPapers(publicPapers)}
                navigate={navigate}
                isMasterAdmin={isMasterAdmin}
                isPublicView
                onTogglePublic={handleTogglePublic}
              />
            </TabPanel>
          </>
        )}
      </Box>
      
      {/* 公開設定変更確認ダイアログ */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setPaperToToggle(null);
        }}
      >
        <DialogTitle>
          {paperToToggle?.public ? '論文の公開を解除しますか？' : '論文を公開しますか？'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {paperToToggle?.public 
              ? '論文の公開を解除すると、未ログインユーザーはこの論文を閲覧できなくなります。' 
              : '論文を公開すると、未ログインユーザーもこの論文を閲覧できるようになります。ログイン済みユーザーは変わらず閲覧可能です。'}
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              論文情報:
            </Typography>
            <Typography variant="body2">
              タイトル: {paperToToggle?.metadata?.title || '無題'}
            </Typography>
            <Typography variant="body2">
              著者: {paperToToggle?.metadata?.authors?.map(a => a.name).join(', ') || '不明'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setConfirmDialogOpen(false);
              setPaperToToggle(null);
            }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={confirmTogglePublic} 
            color={paperToToggle?.public ? "error" : "primary"}
            variant="contained"
            autoFocus
          >
            {paperToToggle?.public ? '公開を解除する' : '公開する'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </Container>
  );
};

// 論文テーブルコンポーネント
const PaperTable = ({ 
  papers, 
  navigate, 
  isMasterAdmin,
  isReportedView = false,
  isPublicView = false,
  onTogglePublic
}: { 
  papers: PaperType[]; 
  navigate: (path: string) => void;
  isMasterAdmin: boolean;
  isReportedView?: boolean;
  isPublicView?: boolean;
  onTogglePublic: (paper: PaperType) => void;
}) => {
  if (papers.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          {isReportedView 
            ? '問題報告のある論文はありません' 
            : isPublicView
              ? '公開されている論文はありません'
              : '表示できる論文がありません'}
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>タイトル</TableCell>
            <TableCell>著者</TableCell>
            <TableCell>アップロード日</TableCell>
            <TableCell>ステータス</TableCell>
            <TableCell>公開設定</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {papers.map((paper) => (
            <TableRow
              key={paper.id}
              sx={{
                ...(paper.status === 'reported' && {
                  backgroundColor: 'warning.light',
                  '&:hover': {
                    backgroundColor: 'warning.main',
                    '& .MuiTableCell-root': { color: 'white' }
                  }
                }),
                ...(paper.status === 'problem' && {
                  backgroundColor: 'error.light',
                  '&:hover': {
                    backgroundColor: 'error.main',
                    '& .MuiTableCell-root': { color: 'white' }
                  }
                }),
                ...(paper.public && {
                  backgroundColor: 'success.light',
                  '&:hover': {
                    backgroundColor: 'success.light',
                  }
                })
              }}
            >
              <TableCell 
                component="th" 
                scope="row"
                sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {paper.id.substring(0, 8)}...
              </TableCell>
              <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {paper.metadata?.title || '無題'}
              </TableCell>
              <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {paper.metadata?.authors?.map(a => a.name).join(', ') || '不明'}
              </TableCell>
              <TableCell>
                {paper.uploaded_at ? formatDate(paper.uploaded_at) : '不明'}
              </TableCell>
              <TableCell>
                <StatusChip status={paper.status} />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Switch
                    checked={paper.public === true}
                    onChange={() => onTogglePublic(paper)}
                    color="success"
                    size="small"
                    disabled={paper.status !== 'completed'} // 完了した論文のみ公開可能
                  />
                  <Box component="span" sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                    {paper.public ? (
                      <>
                        <PublicIcon fontSize="small" color="success" />
                        <Box component="span" sx={{ ml: 0.5, fontSize: '0.75rem' }}>公開中</Box>
                      </>
                    ) : (
                      <>
                        <PrivateIcon fontSize="small" color="action" />
                        <Box component="span" sx={{ ml: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>
                          非公開
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell align="right">
                <Tooltip title="論文を表示">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => navigate(`/papers/${paper.id}`)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Geminiログを表示">
                  <IconButton
                    size="small"
                    color="info"
                    onClick={() => navigate(`/admin/gemini-logs/${paper.id}`)}
                  >
                    <ScienceIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                {(paper.status === 'reported' || paper.status === 'problem') && paper.report_id && (
                  <Tooltip title="問題報告を確認">
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={() => navigate(`/admin/report/${paper.report_id}`)}
                    >
                      <WarningIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AdminPapersPage;