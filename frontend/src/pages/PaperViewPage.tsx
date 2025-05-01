// ~/Desktop/smart-paper-v2/frontend/src/pages/PaperViewPage.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Menu,
  MenuItem,
  Drawer,
  Tooltip,
  Snackbar,
  Card,
  CardContent,
  Grid,
  useTheme,
  useMediaQuery
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import TranslateIcon from '@mui/icons-material/Translate';
import SummarizeIcon from '@mui/icons-material/Summarize';
import InfoIcon from '@mui/icons-material/Info';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import BookIcon from '@mui/icons-material/MenuBook';
import TocIcon from '@mui/icons-material/Toc';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PublicIcon from '@mui/icons-material/Public';
import LoginIcon from '@mui/icons-material/Login';
import { usePaperStore } from '../store/paperStore';
import { useAuthStore } from '../store/authStore';
import ErrorMessage from '../components/common/ErrorMessage';
import SplitView from '../components/papers/SplitView';
import Summary from '../components/papers/Summary';
import ZoteroExport from '../components/zotero/Export';
import { MarkdownExporter } from '../utils/MarkdownExporter';
import { 
  exportToObsidian, 
  ObsidianSettings,
  ObsidianState,
  cachePdfBlob,
  getCachedPdfBlob,
  DEFAULT_OBSIDIAN_SETTINGS,
  isVaultSelected,
  getVault
} from '../api/obsidian';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { 
  getPaperPdfUrl, 
  getPaperTranslatedText, 
  getPaper as getPaperOriginal,
  Paper as PaperType,
  formatDate
} from '../api/papers';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`paper-tabpanel-${index}`}
      aria-labelledby={`paper-tab-${index}`}
      {...other}
      style={{ height: '100%', width: '100%', display: value === index ? 'flex' : 'none' }}
    >
      {value === index && (
        <Box sx={{ 
          p: { xs: 0, sm: '0 0 12px 0' }, 
          height: '100%', 
          width: '100%',
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const PaperViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuthStore();
  const { 
    currentPaper, 
    currentPaperChapters, 
    currentPaperLoading, 
    currentPaperError,
    fetchPaper,
    clearCurrentPaper
  } = usePaperStore();
  
  const [tabValue, setTabValue] = useState(0);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [localTranslatedText, setLocalTranslatedText] = useState<string | null>(null);
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportAttempted, setExportAttempted] = useState(false);
  const [obsidianSettings, setObsidianSettings] = useState<ObsidianSettings | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [obsidianExportStatus, setObsidianExportStatus] = useState<'success' | 'error' | 'pending' | 'none'>('none');
  const [isLoadingText, setIsLoadingText] = useState<boolean>(false);
  const [isPublicPaper, setIsPublicPaper] = useState<boolean>(false);

  // 管理者かどうかをチェック
  const isAdmin = user?.email === 'smart-paper-v2@student-subscription.com' || 
                 user?.email === 's.kosei0626@gmail.com';

  // 論文の公開ステータスをチェック
  const checkPaperPublicStatus = async () => {
    if (!id) return;
    
    try {
      const paperRef = doc(db, 'papers', id);
      const paperSnap = await getDoc(paperRef);
      
      if (paperSnap.exists()) {
        const paperData = paperSnap.data();
        setIsPublicPaper(paperData.public === true);
      }
    } catch (error) {
      console.error('Error checking paper public status:', error);
    }
  };

  // カスタム関数: 論文データを取得して再読み込み
  const refreshPaper = async () => {
    if (!id) return;
    
    try {
      setError(null); // エラーをクリア
      await fetchPaper(id);
      
      // ローカルの翻訳テキストをクリア（再取得するため）
      setLocalTranslatedText(null);
    } catch (err) {
      console.error("Error refreshing paper:", err);
      setError("論文データの再読み込みに失敗しました");
    }
  };
  
  // ローカルストレージからObsidian連携状態を読み込む
  useEffect(() => {
    if (!currentPaper?.id) return;
    
    try {
      const savedExportStatus = localStorage.getItem('obsidian_export_status');
      if (savedExportStatus) {
        const statusData = JSON.parse(savedExportStatus);
        if (statusData[currentPaper.id]) {
          const paperStatus = statusData[currentPaper.id];
          if (paperStatus.exported) {
            setObsidianExportStatus('success');
          } else if (paperStatus.error) {
            setObsidianExportStatus('error');
          }
        }
      }
    } catch (error) {
      console.error('Error loading Obsidian export status:', error);
    }
  }, [currentPaper]);

  useEffect(() => {
    // 論文の公開ステータスをチェック
    checkPaperPublicStatus();
    
    if (id) {
      // 未ログインの場合で、公開論文でない場合は早期リターン
      if (!user && !isPublicPaper) {
        // 未ログインチェックはこの時点ではまだできない
        // フェッチ処理の中で対応する
      } else {
        fetchPaper(id);
      }
    }
    
    return () => {
      clearCurrentPaper();
      setLocalTranslatedText(null);
    };
  }, [id, user, fetchPaper, clearCurrentPaper, isPublicPaper]);
  
  // Obsidian設定の読み込み（Firestoreから）
  useEffect(() => {
    const loadObsidianSettings = async () => {
      if (!user) return;
      
      try {
        // まずFirestoreからユーザーの設定を取得
        const settingsRef = doc(db, `users/${user.uid}/obsidian_settings/default`);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          // Timestampを日付に変換し、ObsidianSettings型に合わせる
          const settings: ObsidianSettings = {
            vault_dir: data.vault_dir || '',
            vault_name: data.vault_name || '',
            folder_path: data.folder_path || 'smart-paper-v2/' + new Date().toISOString().split('T')[0],
            file_name_format: data.file_name_format || '{authors}_{title}_{year}',
            file_type: data.file_type || 'md',
            open_after_export: data.open_after_export !== false,
            include_pdf: data.include_pdf !== false,
            create_embed_folder: data.create_embed_folder !== false,
            auto_export: data.auto_export !== false,
            created_at: data.created_at?.toDate() || new Date(),
            updated_at: data.updated_at?.toDate() || new Date()
          };
          
          setObsidianSettings(settings);
          // 既存の動作との互換性のためにローカルストレージにも保存
          const localStorageSettings = {
            ...settings,
            created_at: settings.created_at.toISOString(),
            updated_at: settings.updated_at.toISOString()
          };
          localStorage.setItem('obsidian_settings', JSON.stringify(localStorageSettings));
        } else {
          // Firestoreに設定がない場合はローカルストレージをチェック
          const savedSettings = localStorage.getItem('obsidian_settings');
          
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            // 日付文字列をDateオブジェクトに変換
            if (parsedSettings.created_at) {
              parsedSettings.created_at = new Date(parsedSettings.created_at);
            }
            if (parsedSettings.updated_at) {
              parsedSettings.updated_at = new Date(parsedSettings.updated_at);
            }
            
            setObsidianSettings(parsedSettings);
          } else {
            // デフォルト設定を使用
            setObsidianSettings(DEFAULT_OBSIDIAN_SETTINGS);
          }
        }
      } catch (error) {
        console.error('Error loading Obsidian settings:', error);
        // エラー時はデフォルト設定を使用
        setObsidianSettings(DEFAULT_OBSIDIAN_SETTINGS);
      }
    };
    
    loadObsidianSettings();
  }, [user]);
  
  // PDFのキャッシュ状態を追跡するためのref
  const [pdfCached, setPdfCached] = useState<boolean>(false);
  
  // PDFのキャッシュ状態を確認
  useEffect(() => {
    if (currentPaper?.id) {
      const cachedPdf = getCachedPdfBlob(currentPaper.id);
      setPdfCached(!!cachedPdf);
    }
  }, [currentPaper]);

  // 自動エクスポートの実行
  useEffect(() => {
    const autoExportToObsidian = async () => {
      // PDFがキャッシュされたらすぐに自動エクスポートを試みる
      if (!currentPaper || currentPaper.status !== 'completed' || exportAttempted || !pdfCached) return;
      
      // 設定がある場合のみ自動エクスポートを試みる
      if (!obsidianSettings) return;
      
      // 自動保存が有効になっているかチェック
      if (!obsidianSettings.auto_export) {
        return;
      }
      
      // Vault設定が保存されているかチェック
      if (!obsidianSettings.vault_name || !obsidianSettings.vault_dir) {
        return;
      }
      
      try {
        setExportAttempted(true);
        setObsidianExportStatus('pending');
        
        // PDFデータを取得
        const pdfBlob = currentPaper.id ? getCachedPdfBlob(currentPaper.id) : null;
        
        // 権限プロンプトをスキップしてVaultを取得（自動実行の場合はプロンプトを表示しない）
        const vaultHandle = await getVault(true);
        
        if (!vaultHandle) {
          // 権限がない場合はユーザーに通知
          setSnackbarMessage('Obsidian Vaultへのアクセス権限がありません。「Obsidianに保存」ボタンをクリックして権限を付与してください。');
          setSnackbarOpen(true);
          setObsidianExportStatus('error');
          return;
        }
        
        // Obsidianエクスポート実行（userInitiated=falseで自動実行を示す）
        const result = await exportToObsidian(
          currentPaper, 
          currentPaperChapters, 
          obsidianSettings,
          pdfBlob || undefined,
          false // 自動実行
        );
        
        if (result.exported) {
          setObsidianExportStatus('success');
          setSnackbarMessage('Obsidianに論文を自動保存しました');
          setSnackbarOpen(true);
        } else {
          if (result.error) {
            // エラーメッセージを表示しない（ユーザーに通知せず、手動エクスポートを促す）
          }
        }
      } catch (error) {
        console.error('Error auto-exporting to Obsidian:', error);
        // 自動エクスポートのエラーは静かに失敗させる（ユーザーエクスペリエンスを妨げないため）
      }
    };

    autoExportToObsidian();
  }, [currentPaper, currentPaperChapters, pdfCached, exportAttempted, obsidianSettings]);
  
  useEffect(() => {
    const fetchPaperResources = async () => {
      if (currentPaper && currentPaper.file_path) {
        try {
          // まずキャッシュをチェック
          let cachedPdf = currentPaper.id ? getCachedPdfBlob(currentPaper.id) : null;
          
          if (cachedPdf) {
            // キャッシュがある場合はそれを使用
            const objectUrl = URL.createObjectURL(cachedPdf);
            setPdfUrl(objectUrl);
            setPdfCached(true);
          } else {
            // キャッシュがない場合はAPIから取得
            try {
              const url = await getPaperPdfUrl(currentPaper);
              setPdfUrl(url);
              
              // PDFをフェッチしてキャッシュに保存
              const response = await fetch(url);
              if (response.ok) {
                const blob = await response.blob();
                if (currentPaper.id) {
                  cachePdfBlob(currentPaper.id, blob);
                  setPdfCached(true);
                }
              }
            } catch (apiError) {
              console.error('Error fetching PDF from API:', apiError);
              setError('PDFの読み込みに失敗しました');
            }
          }
        } catch (error) {
          console.error('Error handling PDF resources:', error);
          setError('PDFの読み込みに失敗しました');
        }
      }
    };
    fetchPaperResources();
  }, [currentPaper]);
  
  // 修正: 翻訳テキスト取得ロジックの改善
  useEffect(() => {
    const fetchTranslatedText = async () => {
      // 既に翻訳テキストがある場合はスキップ
      if (localTranslatedText || (currentPaper && currentPaper.translated_text)) {
        return;
      }
      
      // 論文がない、または完了していない場合はスキップ
      if (!currentPaper || currentPaper.status !== 'completed') {
        return;
      }
      
      try {
        setIsLoadingText(true);
        
        let text = null;
        
        // Case 1: 論文に翻訳テキストが直接含まれている場合
        if (currentPaper.translated_text) {
          text = currentPaper.translated_text;
        }
        // Case 2: 翻訳テキストへのパスがある場合
        else if (currentPaper.translated_text_path) {
          text = await getPaperTranslatedText(currentPaper);
        }
        // Case 3: どちらもない場合、論文データを再取得して確認
        else {
          if (currentPaper.id) {
            try {
              // 論文データを再取得
              const refreshedPaper = await getPaperOriginal(currentPaper.id);
              
              if (refreshedPaper.translated_text) {
                text = refreshedPaper.translated_text;
              } else if (refreshedPaper.translated_text_path) {
                text = await getPaperTranslatedText(refreshedPaper);
              }
            } catch (refreshError) {
              console.error("Error refreshing paper:", refreshError);
            }
          }
        }
        
        if (text) {
          setLocalTranslatedText(text);
          setError(null); // エラーをクリア
        } else {
          console.warn("Unable to retrieve translated text after all attempts");
        }
      } catch (error) {
        console.error('Error fetching translated text:', error);
        setError('翻訳テキストの読み込みに失敗しました。再読み込みボタンをクリックしてください。');
      } finally {
        setIsLoadingText(false);
      }
    };
    
    fetchTranslatedText();
  }, [currentPaper, localTranslatedText]);
  
  useEffect(() => {
    if (tabValue !== 0) {
      setDrawerOpen(false);
    }
  }, [tabValue]);
  
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleChapterSelect = (chapterNumber: number) => {
    setSelectedChapter(chapterNumber);
    setDrawerOpen(false);
  };
  
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  const resetChapter = () => {
    setSelectedChapter(null);
    setDrawerOpen(false);
  };
  
  const handleOpenDownloadMenu = (event: React.MouseEvent<HTMLElement>) => {
    setDownloadMenuAnchor(event.currentTarget);
  };
  
  const handleCloseDownloadMenu = () => {
    setDownloadMenuAnchor(null);
  };
  
  const handleDownloadPlainText = () => {
    if (!currentPaper) return;
    let text = currentPaper.translated_text || localTranslatedText;
    if (!text) {
      setError('翻訳テキストがありません');
      return;
    }
    const fileName = `${currentPaper.metadata?.title || 'translation'}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    handleCloseDownloadMenu();
  };
  
  const handleDownloadMarkdown = () => {
    if (!currentPaper) return;
    const markdown = MarkdownExporter.generateFullMarkdown(currentPaper, currentPaperChapters);
    const fileName = currentPaper.metadata?.title || 'translation';
    MarkdownExporter.downloadMarkdown(markdown, fileName);
    handleCloseDownloadMenu();
  };
  
  // Obsidianへの手動エクスポート
  const handleExportToObsidian = async () => {
    if (!currentPaper) {
      setError('論文データがありません');
      return;
    }
    
    // 設定がない場合はデフォルト設定を使用
    const settings = obsidianSettings || DEFAULT_OBSIDIAN_SETTINGS;
    
    try {
      setIsExporting(true);
      setObsidianExportStatus('pending');
      
      // PDFデータを取得
      let pdfBlob = currentPaper.id ? getCachedPdfBlob(currentPaper.id) : null;
      
      // PDF未キャッシュの場合、キャッシュを試みる
      if (!pdfBlob && currentPaper.file_path && pdfUrl) {
        try {
          const response = await fetch(pdfUrl);
          if (response.ok) {
            pdfBlob = await response.blob();
            if (currentPaper.id) {
              cachePdfBlob(currentPaper.id, pdfBlob);
              setPdfCached(true);
            }
          }
        } catch (pdfError) {
          console.error('Error caching PDF:', pdfError);
        }
      }
      
      // Obsidianエクスポート実行（userInitiated=trueでユーザーアクションによる実行を示す）
      const result = await exportToObsidian(
        currentPaper, 
        currentPaperChapters, 
        settings,
        pdfBlob || undefined,
        true // ユーザーが明示的に実行したことを示すフラグ
      );
      
      if (result.exported) {
        setObsidianExportStatus('success');
        setSnackbarMessage('Obsidianに論文を保存しました');
        setSnackbarOpen(true);
        setExportAttempted(true);
      } else if (result.error) {
        setError(result.error);
      }
      
    } catch (error) {
      console.error('Error exporting to Obsidian:', error);
      setObsidianExportStatus('error');
      setError('Obsidianへの保存に失敗しました：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
    }
  };
  
  // 修正: getSelectedChapterText関数の改良
  const getSelectedChapterText = () => {
    if (!currentPaper) return null;

    
    // 選択された章がない場合は全文を返す
    if (!selectedChapter) {
      // 優先順位: ローカルテキスト > 論文オブジェクトのテキスト
      if (localTranslatedText && localTranslatedText.length > 0) {
        return localTranslatedText;
      }
      if (currentPaper.translated_text && currentPaper.translated_text.length > 0) {
        return currentPaper.translated_text;
      }
      // 両方ともない場合はnullを返す
      return null;
    }
    
    // 選択された章がある場合は該当する章のテキストを返す
    const chapter = currentPaperChapters.find(c => c.chapter_number === selectedChapter);
    if (chapter && chapter.translated_text) {
      return chapter.translated_text;
    }
    
    // 章が選択されているが章のデータがない場合は全文を返す
    if (localTranslatedText && localTranslatedText.length > 0) {
      return localTranslatedText;
    }
    if (currentPaper.translated_text && currentPaper.translated_text.length > 0) {
      return currentPaper.translated_text;
    }
    
    return null;
  };
  
  const getSelectedChapterInfo = () => {
    if (!selectedChapter) return undefined;
    const chapter = currentPaperChapters.find(c => c.chapter_number === selectedChapter);
    if (!chapter) return undefined;
    return {
      title: chapter.title,
      chapter_number: chapter.chapter_number
    };
  };
  
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  const TableOfContents = () => (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        bgcolor: 'transparent'
      }}
    >
      <Box
        onClick={resetChapter}
        sx={{
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          bgcolor: 'transparent',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.15)'
          }
        }}
      >
        <Typography>全文</Typography>
      </Box>
      
      {currentPaper?.chapters?.map((chapter) => (
        <Box
          key={chapter.chapter_number}
          onClick={() => handleChapterSelect(chapter.chapter_number)}
          sx={{
            px: 1.5,
            py: 0.75,
            cursor: 'pointer',
            bgcolor: 'transparent',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.15)'
            }
          }}
        >
          <Typography>{`${chapter.chapter_number}. ${chapter.title}`}</Typography>
          <Typography variant="body2" color="text.secondary">
            {`P${chapter.start_page}-${chapter.end_page}`}
          </Typography>
        </Box>
      ))}
    </Box>
  );
  
  // Obsidianの連携ステータスを表示するコンポーネント
  const ObsidianExportStatusChip = () => {
    switch (obsidianExportStatus) {
      case 'success':
        return (
          <Tooltip title="Obsidianに保存済み">
            <Chip 
              icon={<CloudDoneIcon />} 
              label="Obsidian保存済" 
              color="success" 
              size="small"
              sx={{ ml: 1 }}
            />
          </Tooltip>
        );
      case 'error':
        return (
          <Tooltip title="Obsidianへの保存に失敗しました">
            <Chip 
              icon={<CloudOffIcon />} 
              label="Obsidian保存失敗" 
              color="error" 
              size="small"
              sx={{ ml: 1 }}
            />
          </Tooltip>
        );
      case 'pending':
        return (
          <Tooltip title="Obsidianに保存中...">
            <Chip 
              icon={<AccessTimeIcon />} 
              label="Obsidian保存中" 
              color="warning" 
              size="small"
              sx={{ ml: 1 }}
            />
          </Tooltip>
        );
      default:
        return null;
    }
  };
  
  const renderProgress = () => {
    if (!currentPaper) return null;
    
    if (currentPaper.status === 'completed') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip label="翻訳完了" color="success" />
          {isPublicPaper && (
            <Chip 
              icon={<PublicIcon />} 
              label="公開論文" 
              color="success" 
              variant="outlined"
            />
          )}
          {user && <ObsidianExportStatusChip />}
          {user && (
            <Tooltip title="問題を報告する">
              <Chip 
                label="問題報告" 
                color="default"
                variant="outlined"  
                icon={<ReportProblemIcon />} 
                onClick={() => navigate(`/contact?tab=1&paper_id=${currentPaper.id}`)}
                clickable
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
          )}
        </Box>
      );
    } else if (currentPaper.status === 'error') {
      return <Chip label="エラー" color="error" />;
    } else if (currentPaper.status === 'reported') {
      return <Chip label="問題報告あり" color="warning" icon={<ReportProblemIcon />} />;
    } else {
      let progress = currentPaper.progress || 0;
      let statusText = '';
      switch (currentPaper.status) {
        case 'pending':
          statusText = '処理を準備中...';
          break;
        case 'metadata_extracted':
          statusText = 'メタデータを抽出中...';
          break;
        case 'processing':
          statusText = `翻訳中... (${progress}%)`;
          break;
      }
      return (
        <Box sx={{ width: '100%', mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">{statusText}</Typography>
            <Typography variant="body2">{Math.round(progress)}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      );
    }
  };

  // 未ログインかつ非公開論文の場合はログイン促進画面を表示
  if (!user && !isPublicPaper && !currentPaperLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/')}
            sx={{ mb: 2 }}
          >
            ホームに戻る
          </Button>
          
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3, 
              px: 4, 
              py: 3
            }}
          >
            <Box>
              <Typography variant="h5" gutterBottom>
                ログインが必要です
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                この論文を閲覧するにはログインが必要です。アカウントをお持ちでない場合は、新規登録を行ってください。
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<LoginIcon />}
                  onClick={() => navigate('/login')}
                >
                  ログイン
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate('/register')}
                >
                  新規登録
                </Button>
              </Box>
            </Box>
          </Alert>
        </Box>
      </Container>
    );
  }
  
  if (currentPaperLoading) {
    return (
      <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2 } }}>
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>論文情報を読み込み中...</Typography>
        </Box>
      </Container>
    );
  }
  
  if (currentPaperError || !currentPaper) {
    return (
      <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2 } }}>
        <Box sx={{ my: 4 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/')}
            sx={{ mb: 2 }}
          >
            ホームに戻る
          </Button>
          <ErrorMessage 
            title="論文の読み込みに失敗しました"
            message={currentPaperError || "論文が見つかりません"}
            onRetry={id ? () => fetchPaper(id) : undefined}
          />
        </Box>
      </Container>
    );
  }
  
  return (
    <Container 
      maxWidth={false} 
      disableGutters 
      sx={{ 
        px: { xs: 0.5, sm: 1, md: 2 }, 
        overflow: 'visible',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100%', 
        width: '100%',
        flex: 1,
        overflow: 'visible',
        pb: 1
      }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ alignSelf: 'flex-start', mb: 1, mt: 1, ml: 1 }}
        >
          ホームに戻る
        </Button>
        
        {/* 論文情報カードの改善されたデザイン */}
        <Card sx={{ mb: 6, mx: 1 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <Typography variant="h5" component="h1" fontWeight="medium" gutterBottom>
                  {currentPaper.metadata?.title || '無題の論文'}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                  {currentPaper.metadata?.authors?.map(author => author.name).join(', ') || '著者不明'}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {currentPaper.metadata?.journal && (
                    <Chip 
                      label={currentPaper.metadata.journal} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  )}
                  {currentPaper.metadata?.year && (
                    <Chip 
                      label={currentPaper.metadata.year} 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                  {currentPaper.metadata?.doi && (
                    <Chip 
                      label={`DOI: ${currentPaper.metadata.doi}`}
                      size="small"
                      variant="outlined"
                      component="a"
                      href={`https://doi.org/${currentPaper.metadata.doi}`}
                      target="_blank"
                      clickable
                    />
                  )}
                </Box>
              </Grid>
            </Grid>
            
            {/* 問題報告アラート */}
            {currentPaper.status === 'reported' && (
              <Alert 
                severity="warning" 
                icon={<ReportProblemIcon />}
                sx={{ mb: 2 }}
                action={
                  isAdmin && currentPaper.report_id ? (
                    <Button 
                      color="warning" 
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/admin/report/${currentPaper.report_id}`)}
                    >
                      報告詳細
                    </Button>
                  ) : null
                }
              >
                <AlertTitle>問題報告あり</AlertTitle>
                この論文には問題報告が提出されています。{isAdmin ? '詳細を確認してください。' : '管理者が確認中です。'}
                {currentPaper.reported_at && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    報告日時: {formatDate(currentPaper.reported_at)}
                  </Typography>
                )}
              </Alert>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                {renderProgress()}
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(currentPaper.status === 'completed' || currentPaper.status === 'reported' || currentPaper.status === 'problem') && (
                <>
                  {user && (
                    <>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        startIcon={<DownloadIcon />}
                        onClick={handleOpenDownloadMenu}
                        disabled={!currentPaper.translated_text && !localTranslatedText}
                      >
                        ダウンロード
                      </Button>
                      
                      <Menu
                        anchorEl={downloadMenuAnchor}
                        open={Boolean(downloadMenuAnchor)}
                        onClose={handleCloseDownloadMenu}
                      >
                        <MenuItem onClick={handleDownloadPlainText}>
                          <SaveAltIcon fontSize="small" sx={{ mr: 1 }} />
                          プレーンテキスト (.txt)
                        </MenuItem>
                        <MenuItem onClick={handleDownloadMarkdown}>
                          <BookIcon fontSize="small" sx={{ mr: 1 }} />
                          Markdown (.md)
                        </MenuItem>
                      </Menu>
                      
                      {obsidianSettings && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<BookIcon />}
                          onClick={handleExportToObsidian}
                          disabled={isExporting || !currentPaper.translated_text && !localTranslatedText}
                        >
                          {isExporting ? (
                            <>
                              <CircularProgress size={16} sx={{ mr: 1 }} />
                              Obsidianに保存中...
                            </>
                          ) : obsidianExportStatus === 'success' ? (
                            'Obsidianに再保存'
                          ) : (
                            'Obsidianに保存'
                          )}
                        </Button>
                      )}
                      
                      {/* Zoteroエクスポートボタン */}
                      {currentPaper.metadata?.doi && (
                        <ZoteroExport paper={currentPaper} />
                      )}
                    </>
                  )}
                  
                  {!user && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<LoginIcon />}
                      onClick={() => navigate('/login')}
                    >
                      ログインで全機能利用可能
                    </Button>
                  )}
                </>
              )}
              </Box>
            </Box>
          </CardContent>
        </Card>
        
        {error && (
          <Box sx={{ mx: 1, mb: 2 }}>
            <ErrorMessage 
              message={error} 
              onRetry={() => {
                setError(null);
                refreshPaper(); // エラー時は論文データを再読み込み
              }} 
            />
          </Box>
        )}
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          mx: 1
        }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="論文タブ"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ 
              flex: '1 0 auto', 
              minHeight: '40px',
              '& .MuiTab-root': {
                minHeight: '40px',
                py: 1,
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }
            }}
          >
            <Tab 
              icon={<TranslateIcon fontSize="small" />} 
              label="翻訳" 
              id="paper-tab-0"
              sx={{ minWidth: { xs: '80px', sm: '120px' } }}
            />
            <Tab 
              icon={<SummarizeIcon fontSize="small" />} 
              label="要約" 
              id="paper-tab-1"
              sx={{ minWidth: { xs: '80px', sm: '120px' } }}
            />
            <Tab 
              icon={<InfoIcon fontSize="small" />} 
              label="メタデータ" 
              id="paper-tab-2"
              sx={{ minWidth: { xs: '80px', sm: '120px' } }}
            />
          </Tabs>
          
          {tabValue === 0 && currentPaper.chapters && currentPaper.chapters.length > 0 && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mt: { xs: 1, sm: 0 },
              mb: { xs: 1, sm: 0 },
              width: { xs: '100%', sm: 'auto' }
            }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TocIcon />}
                onClick={toggleDrawer}
                color={drawerOpen ? 'primary' : 'inherit'}
                sx={{ mr: 1, width: { xs: '100%', sm: 'auto' } }}
              >
                目次
              </Button>
            </Box>
          )}
        </Box>
        
        <Box sx={{ 
          flex: 1,
          width: '100%',
          display: 'flex',
          overflow: 'visible', 
          position: 'relative',
          mx: 1
        }}>
          <TabPanel value={tabValue} index={0}>
            {!['completed', 'reported', 'problem'].includes(currentPaper.status) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                <Typography>翻訳が完了するまでお待ちください...</Typography>
              </Box>
            ) : isLoadingText ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', flexDirection: 'column' }}>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography>翻訳テキストを読み込み中...</Typography>
              </Box>
            ) : !getSelectedChapterText() ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', flexDirection: 'column' }}>
                <Typography gutterBottom>翻訳テキストが見つかりません</Typography>
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={refreshPaper}
                  sx={{ mt: 2 }}
                >
                  データを再読み込み
                </Button>
              </Box>
            ) : (
              <Box sx={{ 
                height: '100%', 
                width: '100%',
                display: 'flex', 
                overflow: 'visible',
                flex: 1,
                position: 'relative' 
              }}>
                <Drawer
                  anchor="left"
                  open={drawerOpen}
                  onClose={toggleDrawer}
                  sx={{ 
                    zIndex: 1200,
                    '& .MuiDrawer-paper': { 
                      width: '80%', 
                      maxWidth: '300px',
                      pt: 2,
                      bgcolor: 'rgba(255, 255, 255, 0.85)',
                      boxShadow: 'none',
                      borderRadius: 0,
                      margin: 0
                    }
                  }}
                >
                  <Box sx={{ p: 2 }}>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        textAlign: 'center',
                        fontWeight: 'medium',
                        borderBottom: '2px solid rgba(137, 135, 135, 0.57)',
                        pb: 1,
                        mb: 2
                      }}
                    >
                      - 目次 -
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableOfContents />
                  </Box>
                </Drawer>
                
                <Box sx={{ 
                  flex: 1, 
                  height: '100%', 
                  width: '100%',
                  position: 'static',
                  overflow: 'visible'
                }}>
                  {pdfUrl && (
                    <SplitView
                      pdfUrl={pdfUrl}
                      translatedText={getSelectedChapterText()}
                      chapter={getSelectedChapterInfo()}
                    />
                  )}
                </Box>
              </Box>
            )}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {!['completed', 'reported', 'problem'].includes(currentPaper.status) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                <Typography>要約が完了するまでお待ちください...</Typography>
              </Box>
            ) : !currentPaper.summary ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', flexDirection: 'column' }}>
                <Typography gutterBottom>要約が見つかりません</Typography>
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={refreshPaper}
                  sx={{ mt: 2 }}
                >
                  データを再読み込み
                </Button>
              </Box>
            ) : (
              <Paper elevation={0} sx={{ p: 3, height: '100%', width: '100%', overflow: 'auto', flex: 1 }}>
                <Summary 
                  summaryText={currentPaper.summary} 
                  requiredKnowledgeText={currentPaper.required_knowledge} 
                  chapters={currentPaper.chapters || []} 
                />
              </Paper>
            )}
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            {!currentPaper.metadata ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', flexDirection: 'column' }}>
                <Typography gutterBottom>メタデータが見つかりません</Typography>
                <Button 
                  variant="contained" 
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={refreshPaper}
                  sx={{ mt: 2 }}
                >
                  データを再読み込み
                </Button>
              </Box>
            ) : (
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, height: '100%', width: '100%', overflow: 'auto', flex: 1 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                  <strong><u style={{ paddingTop: '5px', display: 'inline-block', textUnderlineOffset: '3px' }}>論文のメタデータ</u></strong>
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">論文タイトル</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{currentPaper.metadata.title}</Typography>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">著者</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        {currentPaper.metadata.authors.map((author, index) => (
                          <Typography key={index} variant="body1">
                            {author.name}{author.affiliation ? ` (${author.affiliation})` : ''}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">ジャーナル</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{currentPaper.metadata.journal}</Typography>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">出版年</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{currentPaper.metadata.year}</Typography>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">DOI</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Typography variant="body1" sx={{ mr: 2 }}>
                          {currentPaper.metadata.doi || '不明'}
                        </Typography>
                        {currentPaper.metadata.doi && user && (
                          <ZoteroExport paper={currentPaper} />
                        )}
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">キーワード</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>
                        {currentPaper.metadata.keywords.join(', ') || '不明'}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">アブストラクト</Typography>
                      <Typography variant="body1" sx={{ mt: 0.5 }}>{currentPaper.metadata.abstract}</Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                {currentPaper.chapters && currentPaper.chapters.length > 0 && (
                  <>
                    <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                      <strong>章構成</strong>
                    </Typography>
                    
                    <Grid container spacing={1.5}>
                      {currentPaper.chapters.map((chapter, index) => (
                        <Grid item xs={12} key={index}>
                          <Paper variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                            <Typography variant="subtitle1">{`${chapter.chapter_number}. ${chapter.title}`}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {`ページ: ${chapter.start_page}-${chapter.end_page}`}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </>
                )}
              </Paper>
            )}
          </TabPanel>
        </Box>
      </Box>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Container>
  );
};

export default PaperViewPage;