// ~/Desktop/smart-paper-v2/frontend/src/pages/AdminReportDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  Link,
  Breadcrumbs,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ArticleIcon from '@mui/icons-material/Article';

import { useAuthStore } from '../store/authStore';
import { getReportDetail } from '../api/admin';
import { getPaper, formatDate } from '../api/papers';

const AdminReportDetailPage = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [paper, setPaper] = useState<any | null>(null);

  // 管理者かどうかを確認
  const isAdmin = user?.email === 'smart-paper-v2@student-subscription.com' || 
                 user?.email === 's.kosei0626@gmail.com';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }

    if (!reportId) {
      setError('レポートIDが指定されていません');
      setLoading(false);
      return;
    }

    const fetchReportData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 問題報告の詳細を取得
        const reportData = await getReportDetail(reportId);
        setReport(reportData);

        // 関連する論文が存在する場合はその情報も取得
        if (reportData.paper_id) {
          try {
            const paperData = await getPaper(reportData.paper_id);
            setPaper(paperData);
          } catch (paperError) {
            console.error('Failed to fetch paper:', paperError);
            // 論文取得エラーは表示するが、続行する
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching report details:', err);
        setError('問題報告の取得に失敗しました');
        setLoading(false);
      }
    };

    fetchReportData();
  }, [reportId, isAdmin, navigate]);

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

  if (error || !report) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Alert severity="error">
            {error || '問題報告の取得に失敗しました'}
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

  // フォーマットされた日付
  const reportDate = report.created_at ? formatDate(report.created_at) : '不明';

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
          <Typography
            sx={{ display: 'flex', alignItems: 'center' }}
            color="text.primary"
          >
            <ReportProblemIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            問題報告詳細
          </Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4" component="h1">
            問題報告詳細
          </Typography>
          
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/papers')}
          >
            管理者ページに戻る
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* 左側: 問題報告の詳細 */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardHeader 
                title="報告詳細" 
                avatar={<ReportProblemIcon color="warning" />}
                action={
                  <Chip 
                    label={`ID: ${reportId?.substring(0, 8)}...`} 
                    variant="outlined" 
                    size="small" 
                  />
                }
              />
              <Divider />
              <CardContent>
                <List disablePadding>
                  <ListItem divider>
                    <ListItemText
                      primary="報告日時"
                      secondary={reportDate}
                    />
                  </ListItem>
                  <ListItem divider>
                    <ListItemText
                      primary="カテゴリ"
                      secondary={
                        (() => {
                          switch (report.category) {
                            case 'translation':
                              return '翻訳の問題';
                            case 'summary':
                              return '要約の問題';
                            case 'upload':
                              return 'アップロードの問題';
                            case 'display':
                              return '表示の問題';
                            case 'export':
                              return 'エクスポートの問題';
                            default:
                              return report.category || 'その他';
                          }
                        })()
                      }
                    />
                  </ListItem>
                  <ListItem divider>
                    <ListItemText
                      primary="報告者"
                      secondary={
                        report.user_id ? `ユーザーID: ${report.user_id}` : '匿名ユーザー'
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="論文共有"
                      secondary={report.share_with_admin ? '許可されています' : '許可されていません'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ mt: 3 }}>
              <CardHeader 
                title="問題の詳細" 
              />
              <Divider />
              <CardContent>
                <Typography variant="body1" paragraph>
                  {report.description || '詳細が入力されていません'}
                </Typography>
                
                {report.steps_to_reproduce && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      再現手順:
                    </Typography>
                    <Typography variant="body1">
                      {report.steps_to_reproduce}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 右側: 関連する論文の情報 */}
          <Grid item xs={12} md={6}>
            {paper ? (
              <Card variant="outlined">
                <CardHeader 
                  title="関連する論文" 
                  avatar={<ArticleIcon color="primary" />}
                  action={
                    <Button
                      size="small"
                      component={RouterLink}
                      to={`/papers/${paper.id}`}
                      variant="contained"
                    >
                      論文を表示
                    </Button>
                  }
                />
                <Divider />
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {paper.metadata?.title || '無題の論文'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {paper.metadata?.authors?.map((a: any) => a.name).join(', ') || '著者不明'}
                  </Typography>
                  
                  {paper.metadata?.year && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      出版年: {paper.metadata.year}
                    </Typography>
                  )}
                  
                  {paper.metadata?.journal && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      ジャーナル: {paper.metadata.journal}
                    </Typography>
                  )}
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <List disablePadding>
                    <ListItem divider>
                      <ListItemText
                        primary="論文ID"
                        secondary={paper.id}
                      />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText
                        primary="アップロード日時"
                        secondary={paper.uploaded_at ? formatDate(paper.uploaded_at) : '不明'}
                      />
                    </ListItem>
                    <ListItem divider>
                      <ListItemText
                        primary="状態"
                        secondary={
                          <Chip 
                            size="small" 
                            label={paper.status === 'reported' ? '問題報告あり' : paper.status} 
                            color={paper.status === 'reported' ? 'warning' : 'default'}
                          />
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="ユーザーID"
                        secondary={paper.user_id}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            ) : (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  関連する論文はありません
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  この問題報告には特定の論文が関連付けられていないか、論文が削除されています。
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default AdminReportDetailPage;