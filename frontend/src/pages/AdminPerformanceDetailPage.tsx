// ~/Desktop/smart-paper-v2/frontend/src/pages/AdminPerformanceDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Card,
  CardContent,
  CardHeader,
  Breadcrumbs,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
// Timeline関連のコンポーネントを@mui/labからインポート
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import TimerIcon from '@mui/icons-material/Timer';
import DownloadIcon from '@mui/icons-material/Download';
import BarChartIcon from '@mui/icons-material/BarChart';
import InfoIcon from '@mui/icons-material/Info';
import ScienceIcon from '@mui/icons-material/Science';

import { useAuthStore } from '../store/authStore';
import { getProcessingTime, exportProcessingTimeCSV } from '../api/admin';
import { getPaper, formatDate } from '../api/papers';

// タブパネルのプロパティ型定義
interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

// タブパネルコンポーネント
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`performance-tabpanel-${index}`}
      aria-labelledby={`performance-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

// a11yプロパティの設定
const a11yProps = (index: number) => {
  return {
    id: `performance-tab-${index}`,
    'aria-controls': `performance-tabpanel-${index}`,
  };
};

// 処理時間詳細ページ
const AdminPerformanceDetailPage = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<any | null>(null);
  const [performanceData, setPerformanceData] = useState<any | null>(null);
  const [tabValue, setTabValue] = useState(0);

  // 管理者かどうかを確認
  const isAdmin = user?.email === 'smart-paper-v2@student-subscription.com' || 
                  user?.email === 's.kosei0626@gmail.com';

  // データを取得
  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }

    if (!paperId) {
      setError('論文IDが指定されていません');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 論文情報を取得
        const paperData = await getPaper(paperId);
        setPaper(paperData);

        // 処理時間データを取得
        const timeData = await getProcessingTime(paperId);
        setPerformanceData(timeData);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('データの取得に失敗しました');
        setLoading(false);
      }
    };

    fetchData();
  }, [paperId, isAdmin, navigate]);

  // タブ切り替え処理
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // CSV形式でダウンロード
  const handleDownloadCSV = () => {
    if (!performanceData || !paper) return;
    
    // CSVデータを生成
    const csvData = exportProcessingTimeCSV(performanceData);
    
    // ファイル名
    const safeTitle = paper.metadata?.title 
      ? paper.metadata.title.replace(/[^\w\s]/gi, '').substring(0, 30)
      : 'paper';
    const filename = `performance_${safeTitle}_${paperId?.substring(0, 8)}.csv`;
    
    // ダウンロード
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !paper) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Alert severity="error">
            {error || 'データの取得に失敗しました'}
          </Alert>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/admin/papers')}
            sx={{ mt: 2 }}
          >
            管理者ページに戻る
          </Button>
        </Box>
      </Container>
    );
  }

  // 総処理時間を計算
  const getTotalProcessingTime = () => {
    let totalMs = 0;
    
    // 各操作の処理時間を加算
    if (performanceData?.translation?.processing_time_sec) {
      totalMs += performanceData.translation.processing_time_sec * 1000;
    }
    
    if (performanceData?.summary?.processing_time_sec) {
      totalMs += performanceData.summary.processing_time_sec * 1000;
    }
    
    if (performanceData?.metadata?.processing_time_sec) {
      totalMs += performanceData.metadata.processing_time_sec * 1000;
    }
    
    // 秒に変換
    const totalSec = totalMs / 1000;
    
    // ミリ秒 (3桁の精度) も表示
    return {
      totalMs,
      formatted: totalSec >= 60 
        ? `${Math.floor(totalSec / 60)}分 ${Math.round(totalSec % 60)}秒` 
        : `${totalSec.toFixed(1)}秒`
    };
  };

  const totalTime = getTotalProcessingTime();
  
  // 処理ステップのタイムライン
  const renderTimeline = (operationData: any, operationName: string) => {
    if (!operationData || !operationData.steps || operationData.steps.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          {operationName}のステップデータはありません
        </Alert>
      );
    }
    
    return (
      <Timeline position="alternate">
        {operationData.steps.map((step: any, index: number) => {
          // タイムスタンプの処理
          const timestamp = step.timestamp?.seconds 
            ? new Date(step.timestamp.seconds * 1000)
            : null;
            
          // 処理時間の表示形式
          const duration = step.processing_time_sec 
            ? step.processing_time_sec >= 1 
              ? `${step.processing_time_sec.toFixed(2)}秒` 
              : `${(step.processing_time_sec * 1000).toFixed(0)}ms`
            : '不明';
            
          // ステップごとの詳細情報
          const details = step.details ? Object.entries(step.details).map(([key, value]) => (
            <Typography variant="body2" key={key} color="text.secondary">
              {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </Typography>
          )) : null;
          
          return (
            <TimelineItem key={index}>
              <TimelineOppositeContent color="text.secondary">
                {timestamp ? (
                  <>
                    <Typography variant="body2">
                      {timestamp.toLocaleTimeString()}
                    </Typography>
                    <Typography variant="caption">
                      {timestamp.toLocaleDateString()}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2">時刻不明</Typography>
                )}
              </TimelineOppositeContent>
              
              <TimelineSeparator>
                <TimelineDot color={
                  step.step_name.includes('error') ? 'error' : 
                  step.step_name.includes('complete') ? 'success' : 
                  step.step_name.includes('start') ? 'primary' : 
                  'grey'
                }/>
                {index < operationData.steps.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              
              <TimelineContent>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1, px: 2 }}>
                    <Typography variant="subtitle2">
                      {step.step_name}
                    </Typography>
                    
                    <Chip 
                      label={duration} 
                      size="small" 
                      variant="outlined" 
                      sx={{ mt: 0.5 }} 
                    />
                    
                    {details && (
                      <Box sx={{ mt: 1 }}>
                        {details}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
    );
  };

  // 章ごとのデータをテーブルで表示
  const renderChaptersTable = () => {
    const chapters = performanceData?.chapters;
    
    if (!chapters || chapters.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          章ごとの処理データはありません
        </Alert>
      );
    }
    
    // 章番号でソート
    const sortedChapters = [...chapters].sort((a, b) => {
      const aNum = typeof a.chapter_number === 'number' ? a.chapter_number : parseInt(a.chapter_number);
      const bNum = typeof b.chapter_number === 'number' ? b.chapter_number : parseInt(b.chapter_number);
      return aNum - bNum;
    });
    
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>章番号</TableCell>
              <TableCell>タイトル</TableCell>
              <TableCell>処理時間</TableCell>
              <TableCell>開始ページ</TableCell>
              <TableCell>終了ページ</TableCell>
              <TableCell>タイムスタンプ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedChapters.map((chapter, index) => (
              <TableRow key={index}>
                <TableCell>{chapter.chapter_number}</TableCell>
                <TableCell>{chapter.title}</TableCell>
                <TableCell>
                  {chapter.processing_time_sec 
                    ? chapter.processing_time_sec >= 1
                      ? `${chapter.processing_time_sec.toFixed(2)}秒`
                      : `${(chapter.processing_time_sec * 1000).toFixed(0)}ms`
                    : '不明'}
                </TableCell>
                <TableCell>{chapter.start_page}</TableCell>
                <TableCell>{chapter.end_page}</TableCell>
                <TableCell>
                  {chapter.timestamp?.seconds 
                    ? formatDate(new Date(chapter.timestamp.seconds * 1000))
                    : '不明'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        {/* パンくずリスト */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link 
            component={RouterLink} 
            to="/" 
            underline="hover" 
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            ホーム
          </Link>
          <Link
            component={RouterLink}
            to="/admin/papers"
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <AdminPanelSettingsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            管理者ページ
          </Link>
          <Link
            component={RouterLink}
            to={`/papers/${paperId}`}
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            論文詳細
          </Link>
          <Typography
            sx={{ display: 'flex', alignItems: 'center' }}
            color="text.primary"
          >
            <TimerIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            処理時間分析
          </Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4" component="h1">
            処理時間分析
          </Typography>
          
          <Box>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCSV}
              sx={{ mr: 1 }}
              disabled={!performanceData}
            >
              CSVダウンロード
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/admin/papers')}
            >
              管理者ページに戻る
            </Button>
          </Box>
        </Box>

        {/* 論文情報 */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            {paper.metadata?.title || '無題の論文'}
          </Typography>
          
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {paper.metadata?.authors?.map((a: any) => a.name).join(', ') || '著者不明'}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Chip 
              label={`論文ID: ${paperId?.substring(0, 8)}...`} 
              variant="outlined" 
              title={paperId}
            />
            <Chip 
              label={`ステータス: ${paper.status}`}
              color={paper.status === 'completed' ? 'success' : 'default'} 
              variant="outlined" 
            />
            <Chip 
              label={`アップロード日: ${formatDate(paper.uploaded_at)}`}
              variant="outlined" 
            />
            {paper.completed_at && (
              <Chip 
                label={`完了日: ${formatDate(paper.completed_at)}`}
                color="success"
                variant="outlined" 
              />
            )}
            <Chip 
              icon={<TimerIcon />}
              label={`総処理時間: ${totalTime.formatted}`}
              color="primary"
              variant="outlined" 
            />
          </Box>
        </Paper>

        {/* サマリーカード */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <BarChartIcon sx={{ mr: 1 }} />
            処理時間サマリー
          </Typography>
          
          <Grid container spacing={2}>
            {/* メタデータ抽出 */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    メタデータ抽出
                  </Typography>
                  <Typography variant="h4">
                    {performanceData?.metadata?.processing_time_sec 
                      ? `${performanceData.metadata.processing_time_sec.toFixed(1)}秒`
                      : '不明'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    ステップ数: {performanceData?.metadata?.steps?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            {/* 翻訳処理 */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    翻訳処理
                  </Typography>
                  <Typography variant="h4">
                    {performanceData?.translation?.processing_time_sec 
                      ? `${performanceData.translation.processing_time_sec.toFixed(1)}秒`
                      : '不明'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    ステップ数: {performanceData?.translation?.steps?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    章数: {performanceData?.chapters?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            {/* 要約処理 */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    要約処理
                  </Typography>
                  <Typography variant="h4">
                    {performanceData?.summary?.processing_time_sec 
                      ? `${performanceData.summary.processing_time_sec.toFixed(1)}秒`
                      : '不明'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    ステップ数: {performanceData?.summary?.steps?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* タブ付きのステップ詳細 */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="processing steps tabs" sx={{ mb: 2 }}>
            <Tab label="メタデータ抽出" {...a11yProps(0)} />
            <Tab label="翻訳処理" {...a11yProps(1)} />
            <Tab label="要約処理" {...a11yProps(2)} />
            <Tab label="章別処理時間" {...a11yProps(3)} />
          </Tabs>
          
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              メタデータ抽出ステップ
            </Typography>
            {renderTimeline(performanceData?.metadata, 'メタデータ抽出')}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              翻訳処理ステップ
            </Typography>
            {renderTimeline(performanceData?.translation, '翻訳処理')}
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              要約処理ステップ
            </Typography>
            {renderTimeline(performanceData?.summary, '要約処理')}
          </TabPanel>
          
          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" gutterBottom>
              章別処理時間
            </Typography>
            {renderChaptersTable()}
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
};

export default AdminPerformanceDetailPage;