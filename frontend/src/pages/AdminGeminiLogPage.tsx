// ~/Desktop/smart-paper-v2/frontend/src/pages/AdminGeminiLogPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Tabs,
  Tab,
  Divider,
  Card,
  CardContent,
  CardHeader,
  Breadcrumbs,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HomeIcon from '@mui/icons-material/Home';
import ScienceIcon from '@mui/icons-material/Science';
import DataObjectIcon from '@mui/icons-material/DataObject';
import TimerIcon from '@mui/icons-material/Timer';
import { useAuthStore } from '../store/authStore';
import { getGeminiLogs } from '../api/admin';
import { getPaper, formatDate } from '../api/papers';

// タブパネルコンポーネント
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`log-tabpanel-${index}`}
      aria-labelledby={`log-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

// JSONから内容を抽出する関数
const extractContentFromJson = (jsonObj: any, operation: string): string => {
  if (!jsonObj || typeof jsonObj !== 'object') {
    return "内容を抽出できません";
  }
  
  // 操作タイプに応じて抽出
  if (operation === "translate") {
    return jsonObj.translated_text || "翻訳内容が見つかりません";
  } else if (operation === "summarize") {
    return jsonObj.summary || "要約内容が見つかりません";
  } else if (operation === "extract_metadata_and_chapters") {
    // メタデータ抽出の場合は構造化データなのでJSON形式で返す
    return JSON.stringify(jsonObj, null, 2);
  } else {
    // その他の操作の場合は、よく使われるキーを探す
    for (const key of ["text", "content", "result", "output", "data"]) {
      if (key in jsonObj) {
        return jsonObj[key];
      }
    }
    
    // 最終手段: JSONをそのまま文字列化して返す
    return JSON.stringify(jsonObj, null, 2);
  }
};

// レスポンスからJSONを抽出する関数
// フロントエンドでextract_json_from_response関数のロジックを再現
const extractJsonFromResponse = (responseText: string, operation: string) => {
  try {
    // 前処理: 余分な空白、改行を削除
    const cleanedText = responseText.trim();
    
    // マークダウンのコードブロックを検索
    const jsonBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      try {
        return JSON.parse(jsonBlockMatch[1]);
      } catch (e) {
        // JSONパースエラー
      }
    }
    
    // JSONオブジェクトパターンを検索
    const jsonPattern = /(\{[\s\S]*\})/;
    const match = jsonPattern.exec(cleanedText);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        // JSONパースエラー
      }
    }
    
    // 翻訳処理の特殊フォールバック
    if (operation === 'translate') {
      return { translated_text: cleanedText };
    } else if (operation === 'summarize') {
      return { summary: cleanedText };
    }
    
    // その他のケースはプレーンテキストを返す
    return { text: cleanedText };
  } catch (e) {
    return { error: 'JSON抽出エラー', text: responseText };
  }
};

const AdminGeminiLogPage: React.FC = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

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

        // Geminiログを取得
        const logsData = await getGeminiLogs(paperId);
        
        // ログにパース済みJSONとその内容を追加
        const enhancedLogs = logsData.map(log => {
          // バックエンドから直接取得できる場合
          const processedJson = log.processed_json || null;
          const extractedContent = log.extracted_content || null;
          
          // バックエンドから取得できない場合はフロントエンドで処理
          const parsedJson = processedJson || (log.response ? extractJsonFromResponse(log.response, log.operation || 'unknown') : null);
          const content = extractedContent || (parsedJson ? extractContentFromJson(parsedJson, log.operation || 'unknown') : null);
          
          return {
            ...log,
            parsed_json: parsedJson,
            content: content
          };
        });
        
        setLogs(enhancedLogs);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('データの取得に失敗しました');
        setLoading(false);
      }
    };

    fetchData();
  }, [paperId, isAdmin, navigate]);

  // タブの切り替え
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // テキストをクリップボードにコピー
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbarMessage('テキストをコピーしました');
    setSnackbarOpen(true);
  };

  // 操作タイプを表示用テキストに変換
  const getOperationText = (operation: string) => {
    switch (operation) {
      case 'translate':
        return '翻訳';
      case 'summarize':
        return '要約';
      case 'extract_metadata_and_chapters':
        return 'メタデータ抽出';
      default:
        return operation;
    }
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
            <ScienceIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            論文詳細
          </Link>
          <Typography
            sx={{ display: 'flex', alignItems: 'center' }}
            color="text.primary"
          >
            Geminiログ
          </Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4" component="h1">
            Geminiログ詳細
          </Typography>
          
          <Box>
            <Button
              variant="outlined"
              startIcon={<TimerIcon />}
              onClick={() => navigate(`/admin/performance/${paperId}`)}
              sx={{ mr: 1 }}
            >
              処理時間分析
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => window.location.reload()}
              sx={{ mr: 1 }}
            >
              更新
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
          </Box>
        </Paper>

        {/* ログ一覧 */}
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="全てのログ" />
              <Tab label="翻訳" />
              <Tab label="要約" />
              <Tab label="メタデータ抽出" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            {logs.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  ログはありません
                </Typography>
              </Box>
            ) : (
              <LogsList logs={logs} onCopy={copyToClipboard} />
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {logs.filter(log => log.operation === 'translate').length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  翻訳ログはありません
                </Typography>
              </Box>
            ) : (
              <LogsList 
                logs={logs.filter(log => log.operation === 'translate')} 
                onCopy={copyToClipboard} 
              />
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {logs.filter(log => log.operation === 'summarize').length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  要約ログはありません
                </Typography>
              </Box>
            ) : (
              <LogsList 
                logs={logs.filter(log => log.operation === 'summarize')} 
                onCopy={copyToClipboard} 
              />
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            {logs.filter(log => log.operation === 'extract_metadata_and_chapters').length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  メタデータ抽出ログはありません
                </Typography>
              </Box>
            ) : (
              <LogsList 
                logs={logs.filter(log => log.operation === 'extract_metadata_and_chapters')} 
                onCopy={copyToClipboard} 
              />
            )}
          </TabPanel>
        </Paper>
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Container>
  );
};

// ログ一覧コンポーネント
interface LogsListProps {
  logs: any[];
  onCopy: (text: string) => void;
}

const LogsList: React.FC<LogsListProps> = ({ logs, onCopy }) => {
  const getOperationText = (operation: string) => {
    switch (operation) {
      case 'translate':
        return '翻訳';
      case 'summarize':
        return '要約';
      case 'extract_metadata_and_chapters':
        return 'メタデータ抽出';
      default:
        return operation;
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {logs.map((log, index) => (
        <Accordion key={log.id || index} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Typography variant="subtitle1">
                  {log.operation ? getOperationText(log.operation) : 'Gemini処理'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {log.timestamp ? formatDate(log.timestamp) : '日時不明'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {log.model && (
                  <Chip 
                    label={`モデル: ${log.model}`} 
                    size="small" 
                    variant="outlined" 
                    color="primary"
                  />
                )}
                {log.parameters?.temperature && (
                  <Chip 
                    label={`温度: ${log.parameters.temperature}`} 
                    size="small" 
                    variant="outlined" 
                  />
                )}
                {log.parameters?.max_output_tokens && (
                  <Chip 
                    label={`最大トークン: ${log.parameters.max_output_tokens}`} 
                    size="small" 
                    variant="outlined" 
                  />
                )}
                {log.parameters?.top_p && (
                  <Chip 
                    label={`Top-p: ${log.parameters.top_p}`} 
                    size="small" 
                    variant="outlined" 
                  />
                )}
                {log.parameters?.top_k && (
                  <Chip 
                    label={`Top-k: ${log.parameters.top_k}`} 
                    size="small" 
                    variant="outlined" 
                  />
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {/* パラメータ情報 */}
            {log.parameters && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>パラメータ</Typography>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: '200px', overflow: 'auto' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(log.parameters, null, 2)}
                  </pre>
                </Paper>
              </Box>
            )}
          
            {/* プロンプト */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">プロンプト</Typography>
                <Tooltip title="プロンプトをコピー">
                  <IconButton size="small" onClick={() => onCopy(log.prompt || '')}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <TextField
                fullWidth
                multiline
                variant="outlined"
                value={log.prompt || 'プロンプトなし'}
                InputProps={{
                  readOnly: true,
                }}
                minRows={3}
                maxRows={15}
              />
              {log.parameters?.prompt_length && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  プロンプト長: {log.parameters.prompt_length} 文字
                </Typography>
              )}
            </Box>
            
            {/* 元のレスポンス */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">レスポンス（元のテキスト）</Typography>
                <Tooltip title="レスポンスをコピー">
                  <IconButton size="small" onClick={() => onCopy(log.response || '')}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <TextField
                fullWidth
                multiline
                variant="outlined"
                value={log.response || 'レスポンスなし'}
                InputProps={{
                  readOnly: true,
                }}
                minRows={3}
                maxRows={15}
              />
              {log.parameters?.response_length && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  レスポンス長: {log.parameters.response_length} 文字
                </Typography>
              )}
            </Box>
            
            {/* JSONパース結果 */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <DataObjectIcon fontSize="small" sx={{ mr: 0.5 }} />
                    JSONパース結果
                  </Box>
                </Typography>
                <Tooltip title="JSON結果をコピー">
                  <IconButton 
                    size="small" 
                    onClick={() => onCopy(
                      log.parsed_json 
                        ? JSON.stringify(log.parsed_json, null, 2) 
                        : '結果なし'
                    )}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  backgroundColor: '#f5f7ff', 
                  minHeight: '100px',
                  maxHeight: '300px', 
                  overflow: 'auto' 
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {log.parsed_json 
                    ? JSON.stringify(log.parsed_json, null, 2) 
                    : '結果なし'}
                </pre>
              </Paper>
            </Box>
            
            {/* 抽出された内容 */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    抽出された内容
                  </Box>
                </Typography>
                <Tooltip title="内容をコピー">
                  <IconButton 
                    size="small" 
                    onClick={() => onCopy(log.content || '')}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  backgroundColor: '#f0fff0', 
                  minHeight: '100px',
                  maxHeight: '400px', 
                  overflow: 'auto' 
                }}
              >
                <div style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  fontFamily: log.operation === 'extract_metadata_and_chapters' ? 'monospace' : 'inherit'
                }}>
                  {log.content || '内容を抽出できません'}
                </div>
              </Paper>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {log.operation === 'translate' && '翻訳テキスト'}
                {log.operation === 'summarize' && '要約テキスト'}
                {log.operation === 'extract_metadata_and_chapters' && 'メタデータ構造'}
                {!log.operation && '抽出された内容'}
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default AdminGeminiLogPage;