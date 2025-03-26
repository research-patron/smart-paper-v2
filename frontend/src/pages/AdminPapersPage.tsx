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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import { useAuthStore } from '../store/authStore';
import { getAdminPapers, getReportedPapers } from '../api/admin';
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
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <PaperTable 
                papers={filterPapers(reportedPapers)}
                navigate={navigate}
                isMasterAdmin={isMasterAdmin}
                isReportedView
              />
            </TabPanel>
          </>
        )}
      </Box>
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
  isReportedView = false 
}: { 
  papers: PaperType[]; 
  navigate: (path: string) => void;
  isMasterAdmin: boolean;
  isReportedView?: boolean;
}) => {
  if (papers.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          {isReportedView 
            ? '問題報告のある論文はありません' 
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
