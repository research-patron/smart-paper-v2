// ~/Desktop/smart-paper-v2/frontend/src/pages/PaperViewPage.tsx
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
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import ArticleIcon from '@mui/icons-material/Article';
import TranslateIcon from '@mui/icons-material/Translate';
import SummarizeIcon from '@mui/icons-material/Summarize';
import InfoIcon from '@mui/icons-material/Info';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import BookIcon from '@mui/icons-material/Book';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { usePaperStore } from '../store/paperStore';
import { useAuthStore } from '../store/authStore';
import ErrorMessage from '../components/common/ErrorMessage';
import SplitView from '../components/papers/SplitView';
import Summary from '../components/papers/Summary';
import { MarkdownExporter } from '../utils/MarkdownExporter';
import { 
  getPaperPdfUrl, 
  getPaperTranslatedText, 
  Paper as PaperType
} from '../api/papers';

// タブパネルコンポーネント
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
        <Box sx={{ p: 3, height: '100%' }}>
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
  // 選択された章番号
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  // PDFの署名付きURL
  const [pdfUrl, setPdfUrl] = useState<string>("");
  // ローカルに保存された翻訳テキスト（Storageから取得した場合）
  const [localTranslatedText, setLocalTranslatedText] = useState<string | null>(null);
  // ダウンロードメニュー
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);
  // Obsidianエクスポートダイアログ
  const [obsidianDialogOpen, setObsidianDialogOpen] = useState(false);
  const [obsidianFilename, setObsidianFilename] = useState('');
  // エラー状態
  const [error, setError] = useState<string | null>(null);
  
  // 論文データを取得
  useEffect(() => {
    if (id && user) {
      fetchPaper(id);
    }
    
    // クリーンアップ
    return () => {
      clearCurrentPaper();
      setLocalTranslatedText(null); // ローカルステートもクリア
    };
  }, [id, user, fetchPaper, clearCurrentPaper]);
  
  // PDFのURLを設定
  useEffect(() => {
    const fetchPaperResources = async () => {
      if (currentPaper && currentPaper.file_path) {
        try {
          // getPaperPdfUrl 関数を使用してPDFの署名付きURLを取得
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
  
  // 翻訳テキストの取得（大きなファイルの場合はStorageから取得する）
  useEffect(() => {
    const fetchTranslatedText = async () => {
      if (currentPaper && currentPaper.status === 'completed' && 
          !currentPaper.translated_text && currentPaper.translated_text_path) {
        try {
          // Storageから翻訳テキストを取得
          const text = await getPaperTranslatedText(currentPaper);
          // ローカルステートを更新
          setLocalTranslatedText(text);
        } catch (error) {
          console.error('Error fetching translated text:', error);
          setError('翻訳テキストの読み込みに失敗しました');
        }
      }
    };

    fetchTranslatedText();
  }, [currentPaper]);
  
  // デフォルトのObsidianファイル名を設定
  useEffect(() => {
    if (currentPaper?.metadata) {
      const { title, authors, year } = currentPaper.metadata;
      const authorName = authors && authors.length > 0 ? authors[0].name.split(' ')[0] : '';
      
      let filename = '';
      if (authorName) filename += `${authorName}_`;
      if (title) filename += `${title}`;
      if (year) filename += `_${year}`;
      
      // ファイル名に使えない文字を除去
      filename = filename.replace(/[<>:"/\\|?*]/g, '');
      // 長すぎる場合は切り詰め
      if (filename.length > 50) {
        filename = filename.substring(0, 47) + '...';
      }
      
      setObsidianFilename(filename);
    }
  }, [currentPaper]);
  
  // タブ切り替え処理
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // 章の選択処理
  const handleChapterSelect = (chapterNumber: number) => {
    setSelectedChapter(chapterNumber);
  };
  
  // ダウンロードメニューを開く
  const handleOpenDownloadMenu = (event: React.MouseEvent<HTMLElement>) => {
    setDownloadMenuAnchor(event.currentTarget);
  };
  
  // ダウンロードメニューを閉じる
  const handleCloseDownloadMenu = () => {
    setDownloadMenuAnchor(null);
  };
  
  // プレーンテキストをダウンロード
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
  
  // 標準Markdownをダウンロード
  const handleDownloadMarkdown = () => {
    if (!currentPaper) return;
    
    const markdown = MarkdownExporter.generateFullMarkdown(currentPaper, currentPaperChapters);
    const fileName = currentPaper.metadata?.title || 'translation';
    
    MarkdownExporter.downloadMarkdown(markdown, fileName);
    handleCloseDownloadMenu();
  };
  
  // Obsidianダイアログを開く
  const handleOpenObsidianDialog = () => {
    setObsidianDialogOpen(true);
    handleCloseDownloadMenu();
  };
  
  // Obsidianダイアログを閉じる
  const handleCloseObsidianDialog = () => {
    setObsidianDialogOpen(false);
  };
  
  // Obsidian形式でダウンロード
  const handleExportToObsidian = () => {
    if (!currentPaper || !obsidianFilename) return;
    
    const markdown = MarkdownExporter.generateObsidianMarkdown(currentPaper, currentPaperChapters);
    MarkdownExporter.downloadMarkdown(markdown, obsidianFilename);
    
    handleCloseObsidianDialog();
  };
  
  // 選択された章の翻訳テキストを取得
  const getSelectedChapterText = () => {
    if (!currentPaper) {
      return null;
    }

    // ローカルに保存された翻訳テキストがあればそれを優先
    if (localTranslatedText && !selectedChapter) {
      return localTranslatedText;
    }
    
    if (!selectedChapter) {
      return currentPaper?.translated_text; // 全文を表示
    }
    
    // 特定の章を表示する場合は、その章のデータを探す
    const chapter = currentPaperChapters.find(c => c.chapter_number === selectedChapter);
    
    // 章が見つかった場合、その翻訳を表示
    if (chapter && chapter.translated_text) {
      return chapter.translated_text;
    }
    
    // 章が見つからないか翻訳がない場合は、全体の翻訳から推定
    if (currentPaper?.translated_text || localTranslatedText) {
      const fullText = currentPaper?.translated_text || localTranslatedText;
      
      // 強引だが章タイトルなどをもとに該当箇所を探す方法も検討できる
      // 今回は単純に全体を返す
      return fullText;
    }
    
    return null;
  };
  
  // 選択された章の情報を取得
  const getSelectedChapterInfo = () => {
    if (!selectedChapter) return undefined;
    
    const chapter = currentPaperChapters.find(c => c.chapter_number === selectedChapter);
    if (!chapter) return undefined;
    
    return {
      title: chapter.title,
      chapter_number: chapter.chapter_number
    };
  };
  
  // ローディング表示
  if (currentPaperLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>論文情報を読み込み中...</Typography>
        </Box>
      </Container>
    );
  }
  
  // エラー表示
  if (currentPaperError || !currentPaper) {
    return (
      <Container maxWidth="lg">
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
  
  // 進捗表示
  const renderProgress = () => {
    if (currentPaper.status === 'completed') {
      return <Chip label="翻訳完了" color="success" />;
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
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 2 }}>
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
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
                    標準Markdown (.md)
                  </MenuItem>
                  <MenuItem onClick={handleOpenObsidianDialog}>
                    <LibraryBooksIcon fontSize="small" sx={{ mr: 1 }} />
                    Obsidian形式 (.md)
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        </Paper>
        
        {error && (
          <ErrorMessage message={error} onRetry={() => setError(null)} />
        )}
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="論文タブ">
            <Tab icon={<TranslateIcon />} label="翻訳" id="paper-tab-0" />
            <Tab icon={<SummarizeIcon />} label="要約" id="paper-tab-1" />
            <Tab icon={<InfoIcon />} label="メタデータ" id="paper-tab-2" />
          </Tabs>
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
                {/* 章選択サイドバー */}
                {currentPaper.chapters && currentPaper.chapters.length > 0 && (
                  <Paper 
                    sx={{ 
                      width: '200px', 
                      mr: 2, 
                      p: 1, 
                      overflow: 'auto', 
                      display: { xs: 'none', md: 'block' } 
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
                        onClick={() => setSelectedChapter(null)}
                      >
                        <ListItemText primary="全文" />
                      </ListItem>
                      {currentPaper.chapters.map((chapter) => (
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
                )}
                
                {/* メインコンテンツ */}
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
      
      {/* Obsidianエクスポートダイアログ */}
      <Dialog open={obsidianDialogOpen} onClose={handleCloseObsidianDialog}>
        <DialogTitle>Obsidian形式でエクスポート</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ファイル名を入力してください。Obsidianフロントマター形式でMarkdownファイルを生成します。
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="ファイル名"
            fullWidth
            variant="outlined"
            value={obsidianFilename}
            onChange={(e) => setObsidianFilename(e.target.value)}
            helperText="拡張子(.md)は自動的に追加されます"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseObsidianDialog}>キャンセル</Button>
          <Button 
            onClick={handleExportToObsidian} 
            variant="contained" 
            disabled={!obsidianFilename}
          >
            エクスポート
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PaperViewPage;
