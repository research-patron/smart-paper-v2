import { useEffect, useState } from 'react';
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
  Snackbar
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import TranslateIcon from '@mui/icons-material/Translate';
import SummarizeIcon from '@mui/icons-material/Summarize';
import InfoIcon from '@mui/icons-material/Info';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import BookIcon from '@mui/icons-material/Book';
import TocIcon from '@mui/icons-material/Toc';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { usePaperStore } from '../store/paperStore';
import { useAuthStore } from '../store/authStore';
import ErrorMessage from '../components/common/ErrorMessage';
import SplitView from '../components/papers/SplitView';
import Summary from '../components/papers/Summary';
import { MarkdownExporter } from '../utils/MarkdownExporter';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '../api/firebase';
import { 
  exportToObsidian, 
  ObsidianSettings,
  ObsidianState,
  updateObsidianState
} from '../api/obsidian';
import { 
  getPaperPdfUrl, 
  getPaperTranslatedText, 
  Paper as PaperType
} from '../api/papers';

// FirestoreのデータをObsidianSettingsに変換する関数
const convertToObsidianSettings = (data: DocumentData): ObsidianSettings => {
  return {
    vault_dir: data.vault_dir || '',
    vault_name: data.vault_name || '',
    folder_path: data.folder_path || '',
    file_name_format: data.file_name_format || '{authors}_{title}_{year}',
    file_type: data.file_type || 'md',
    open_after_export: data.open_after_export !== false,
    include_pdf: data.include_pdf !== false,
    create_embed_folder: data.create_embed_folder !== false,
    auto_export: data.auto_export !== false,
    created_at: data.created_at?.toDate() || new Date(),
    updated_at: data.updated_at?.toDate() || new Date()
  };
};

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
      style={{ height: '100%' }}
    >
      {value === index && (
        <Box sx={{ p: { xs: 0, sm: '0 0 24px 0' }, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const PaperViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (id && user) {
      fetchPaper(id);
    }
    return () => {
      clearCurrentPaper();
      setLocalTranslatedText(null);
    };
  }, [id, user, fetchPaper, clearCurrentPaper]);
  
  // Obsidian設定の読み込み
  useEffect(() => {
    const loadObsidianSettings = async () => {
      if (!user) return;
      
      try {
        const settingsRef = doc(db, `users/${user.uid}/obsidian_settings/default`);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const settings = convertToObsidianSettings(settingsSnap.data());
          setObsidianSettings(settings);
        }
      } catch (error) {
        console.error('Error loading Obsidian settings:', error);
      }
    };
    
    loadObsidianSettings();
  }, [user]);
  
  // Obsidian連携状態を取得
  useEffect(() => {
    const getObsidianState = () => {
      if (!currentPaper || !currentPaper.obsidian) {
        setObsidianExportStatus('none');
        return;
      }
      
      const obsidian = currentPaper.obsidian;
      
      if (obsidian.exported) {
        setObsidianExportStatus('success');
      } else if (obsidian.error) {
        setObsidianExportStatus('error');
      } else {
        setObsidianExportStatus('none');
      }
    };
    
    getObsidianState();
  }, [currentPaper]);

  // 自動エクスポートの実行
  useEffect(() => {
    const autoExportToObsidian = async () => {
      if (!user || !currentPaper || !obsidianSettings || exportAttempted || 
          currentPaper.status !== 'completed' || !obsidianSettings.auto_export) return;
      
      try {
        setExportAttempted(true);
        setObsidianExportStatus('pending');
        
        // 既に成功している場合はスキップ
        if (currentPaper.obsidian?.exported) {
          setObsidianExportStatus('success');
          return;
        }
        
        // Obsidianエクスポート実行
        const result = await exportToObsidian(currentPaper, currentPaperChapters, obsidianSettings);
        
        if (result.exported) {
          setObsidianExportStatus('success');
          setSnackbarMessage('Obsidianに論文を保存しました');
          setSnackbarOpen(true);
        } else {
          setObsidianExportStatus('error');
          if (result.error) {
            setError(result.error);
          }
        }
      } catch (error) {
        console.error('Error auto-exporting to Obsidian:', error);
        setObsidianExportStatus('error');
        setError('Obsidianへの自動保存に失敗しました');
        
        // エラー状態を保存
        if (id) {
          await updateObsidianState(id, {
            exported: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    };

    autoExportToObsidian();
  }, [user, currentPaper, currentPaperChapters, obsidianSettings, exportAttempted, id]);
  
  useEffect(() => {
    const fetchPaperResources = async () => {
      if (currentPaper && currentPaper.file_path) {
        try {
          const url = await getPaperPdfUrl(currentPaper);
          setPdfUrl(url);
        } catch (error) {
          console.error('Error fetching PDF URL:', error);
          setError('PDFの読み込みに失敗しました');
        }
      }
    };
    fetchPaperResources();
  }, [currentPaper]);
  
  useEffect(() => {
    const fetchTranslatedText = async () => {
      if (currentPaper && currentPaper.status === 'completed' && 
          !currentPaper.translated_text && currentPaper.translated_text_path) {
        try {
          const text = await getPaperTranslatedText(currentPaper);
          setLocalTranslatedText(text);
        } catch (error) {
          console.error('Error fetching translated text:', error);
          setError('翻訳テキストの読み込みに失敗しました');
        }
      }
    };
    fetchTranslatedText();
  }, [currentPaper]);
  
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
    if (!currentPaper || !obsidianSettings) {
      setError('Obsidian設定が見つかりません。プロフィールページで設定してください。');
      return;
    }
    
    try {
      setIsExporting(true);
      setObsidianExportStatus('pending');
      
      const result = await exportToObsidian(currentPaper, currentPaperChapters, obsidianSettings);
      
      if (result.exported) {
        setObsidianExportStatus('success');
        setSnackbarMessage('Obsidianに論文を保存しました');
        setSnackbarOpen(true);
      }
      
    } catch (error) {
      console.error('Error exporting to Obsidian:', error);
      setObsidianExportStatus('error');
      setError('Obsidianへの保存に失敗しました');
    } finally {
      setIsExporting(false);
    }
  };
  
  const getSelectedChapterText = () => {
    if (!currentPaper) return null;
    if (localTranslatedText && !selectedChapter) return localTranslatedText;
    if (!selectedChapter) return currentPaper?.translated_text;
    
    const chapter = currentPaperChapters.find(c => c.chapter_number === selectedChapter);
    if (chapter && chapter.translated_text) return chapter.translated_text;
    
    if (currentPaper?.translated_text || localTranslatedText) {
      return currentPaper?.translated_text || localTranslatedText;
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
    <Paper 
      sx={{ 
        width: '100%',
        height: '100%',
        p: 1, 
        overflow: 'auto',
      }}
      variant="outlined"
    >
      <Typography variant="subtitle2" gutterBottom>
        章の選択
      </Typography>
      <List dense disablePadding>
        <ListItem
          button
          selected={selectedChapter === null}
          onClick={resetChapter}
        >
          <ListItemText primary="全文" />
        </ListItem>
        {currentPaper?.chapters?.map((chapter) => (
          <ListItem
            key={chapter.chapter_number}
            button
            selected={selectedChapter === chapter.chapter_number}
            onClick={() => handleChapterSelect(chapter.chapter_number)}
          >
            <ListItemText 
              primary={`${chapter.chapter_number}. ${chapter.title}`}
              secondary={`P${chapter.start_page}-${chapter.end_page}`}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Chip label="翻訳完了" color="success" />
          <ObsidianExportStatusChip />
        </Box>
      );
    } else if (currentPaper.status === 'error') {
      return <Chip label="エラー" color="error" />;
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
            マイ論文に戻る
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
    <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2 } }}>
      <Box sx={{ my: 1 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          マイ論文に戻る
        </Button>
        
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            {currentPaper.metadata?.title || '無題の論文'}
          </Typography>
          
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {currentPaper.metadata?.authors?.map(author => author.name).join(', ') || '著者不明'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {currentPaper.metadata?.journal} ({currentPaper.metadata?.year})
            {currentPaper.metadata?.doi && ` • DOI: ${currentPaper.metadata.doi}`}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          {renderProgress()}
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {currentPaper.status === 'completed' && (
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
            </>
          )}
          </Box>
        </Paper>
        
        {error && (
          <ErrorMessage message={error} onRetry={() => setError(null)} />
        )}
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1, 
          borderColor: 'divider' 
        }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="論文タブ"
            sx={{ flex: 1 }}
          >
            <Tab icon={<TranslateIcon />} label="翻訳" id="paper-tab-0" />
            <Tab icon={<SummarizeIcon />} label="要約" id="paper-tab-1" />
            <Tab icon={<InfoIcon />} label="メタデータ" id="paper-tab-2" />
          </Tabs>
          
          {tabValue === 0 && currentPaper.chapters && currentPaper.chapters.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TocIcon />}
                onClick={toggleDrawer}
                color={drawerOpen ? 'primary' : 'inherit'}
                sx={{ mr: 1 }}
              >
                目次
              </Button>
            </Box>
          )}
        </Box>
        
        <Box sx={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}>
          <TabPanel value={tabValue} index={0}>
            {currentPaper.status !== 'completed' ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography>翻訳が完了するまでお待ちください...</Typography>
              </Box>
            ) : !currentPaper.translated_text && !localTranslatedText && !currentPaper.translated_text_path ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography>翻訳テキストが見つかりません</Typography>
              </Box>
            ) : (
              <Box sx={{ height: '100%', display: 'flex' }}>
                <Drawer
                  anchor="left"
                  open={drawerOpen}
                  onClose={toggleDrawer}
                  sx={{ 
                    '& .MuiDrawer-paper': { width: '80%', maxWidth: '300px' }
                  }}
                >
                  <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      目次
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableOfContents />
                  </Box>
                </Drawer>
                
                <Box sx={{ flex: 1, height: '100%' }}>
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
            {currentPaper.status !== 'completed' ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography>要約が完了するまでお待ちください...</Typography>
              </Box>
            ) : !currentPaper.summary ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography>要約が見つかりません</Typography>
              </Box>
            ) : (
              <Paper elevation={0} sx={{ p: 3, height: '100%', overflow: 'auto' }}>
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
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography>メタデータが見つかりません</Typography>
              </Box>
            ) : (
              <Paper elevation={0} sx={{ p: 3, height: '100%', overflow: 'auto' }}>
                <Typography variant="h6" gutterBottom>
                  論文のメタデータ
                </Typography>
                
                <List>
                  <ListItem>
                    <ListItemText primary="タイトル" secondary={currentPaper.metadata.title} />
                  </ListItem>
                  <Divider component="li" />
                  
                  <ListItem>
                    <ListItemText 
                      primary="著者" 
                      secondary={
                        currentPaper.metadata.authors.map((author, index) => (
                          <Typography key={index} component="span" display="block">
                            {author.name}{author.affiliation ? ` (${author.affiliation})` : ''}
                          </Typography>
                        ))
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                  
                  <ListItem>
                    <ListItemText primary="ジャーナル" secondary={currentPaper.metadata.journal} />
                  </ListItem>
                  <Divider component="li" />
                  
                  <ListItem>
                    <ListItemText primary="出版年" secondary={currentPaper.metadata.year} />
                  </ListItem>
                  <Divider component="li" />
                  
                  <ListItem>
                    <ListItemText primary="DOI" secondary={currentPaper.metadata.doi || '不明'} />
                  </ListItem>
                  <Divider component="li" />
                  
                  <ListItem>
                    <ListItemText 
                      primary="キーワード" 
                      secondary={currentPaper.metadata.keywords.join(', ') || '不明'}
                    />
                  </ListItem>
                  <Divider component="li" />
                  
                  <ListItem>
                    <ListItemText primary="アブストラクト" secondary={currentPaper.metadata.abstract} />
                  </ListItem>
                </List>
                
                {currentPaper.chapters && currentPaper.chapters.length > 0 && (
                  <>
                    <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
                      章構成
                    </Typography>
                    
                    <List>
                      {currentPaper.chapters.map((chapter, index) => (
                        <ListItem key={index}>
                          <ListItemText 
                            primary={`${chapter.chapter_number}. ${chapter.title}`}
                            secondary={`ページ: ${chapter.start_page}-${chapter.end_page}`}
                          />
                        </ListItem>
                      ))}
                    </List>
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