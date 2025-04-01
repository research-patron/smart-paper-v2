// ~/Desktop/smart-paper-v2/frontend/src/components/papers/PdfViewer.tsx
import { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  IconButton,
  Slider,
  Tooltip,
  Alert,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ErrorMessage from '../common/ErrorMessage';

// react-pdfコンポーネントをインポート
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// PDFワーカーの設定
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  width?: number | string;
  height?: number | string;
  onPageChange?: (pageNum: number, totalPages: number) => void;
}

// コントロールバーコンポーネント
const ToolbarControl = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      backgroundColor: 'background.paper',
      borderBottom: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 8px',
      flexWrap: 'wrap',
      minHeight: '40px',
      // 角の丸みと影を削除・調整
      borderRadius: 0,
      boxShadow: 'none',
    }}
  >
    {children}
  </Box>
);

const PdfViewer: React.FC<PdfViewerProps> = ({ 
  url, 
  width = '100%', 
  height = '100%',
  onPageChange
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  
  // PDFのロード完了時
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    
    if (onPageChange) {
      onPageChange(pageNumber, numPages);
    }
  };
  
  // PDFのロードエラー時
  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setError('PDFの読み込みに失敗しました。');
    setLoading(false);
  };
  
  // 前のページへ
  const goToPrevPage = () => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1;
      setPageNumber(newPage);
      
      if (onPageChange && numPages) {
        onPageChange(newPage, numPages);
      }
    }
  };
  
  // 次のページへ
  const goToNextPage = () => {
    if (numPages && pageNumber < numPages) {
      const newPage = pageNumber + 1;
      setPageNumber(newPage);
      
      if (onPageChange && numPages) {
        onPageChange(newPage, numPages);
      }
    }
  };
  
  // 特定のページへ移動
  const goToPage = (_event: Event, value: number | number[]) => {
    const newPage = typeof value === 'number' ? value : value[0];
    setPageNumber(newPage);
    
    if (onPageChange && numPages) {
      onPageChange(newPage, numPages);
    }
  };
  
  // 拡大
  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  };
  
  // 縮小
  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  };
  
  // フルスクリーン切り替え
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };
  
  // モバイルデバイスでのスケール自動調整
  useEffect(() => {
    if (isMobile && !fullscreen) {
      // モバイルではデフォルトのスケールを小さくする
      setScale(0.8);
    } else if (!isMobile && !fullscreen) {
      // デスクトップではデフォルトのスケールを1.0に
      setScale(1.0);
    }
  }, [isMobile, fullscreen]);
  
  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevPage();
      } else if (e.key === 'ArrowRight') {
        goToNextPage();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pageNumber, numPages]);
  
  if (error) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          flex: 1
        }}
      >
        <ErrorMessage message={error} />
        <Button 
          variant="contained" 
          onClick={() => window.open(url, '_blank')}
          sx={{ mt: 2 }}
        >
          ブラウザで開く
        </Button>
      </Box>
    );
  }
  
  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: fullscreen ? 'fixed' : 'relative',
        top: fullscreen ? 0 : 'auto',
        left: fullscreen ? 0 : 'auto',
        right: fullscreen ? 0 : 'auto',
        bottom: fullscreen ? 0 : 'auto',
        zIndex: fullscreen ? 9999 : 'auto',
        bgcolor: 'background.paper',
        flex: 1,
        minHeight: 0 // Flexboxでスクロールを正しく動作させるために必要
      }}
    >
      {/* コントロールバー */}
      <ToolbarControl>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
          <IconButton onClick={goToPrevPage} disabled={pageNumber <= 1} size={isMobile ? "small" : "medium"} sx={{ p: 0.5 }}>
            <NavigateBeforeIcon />
          </IconButton>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: { xs: 'auto', sm: 80 },
            mx: 0.5
          }}>
            <Typography variant="body2" sx={{ mr: 0.5, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              {pageNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              / {numPages || '--'}
            </Typography>
          </Box>
          
          <IconButton onClick={goToNextPage} disabled={!numPages || pageNumber >= numPages} size={isMobile ? "small" : "medium"} sx={{ p: 0.5 }}>
            <NavigateNextIcon />
          </IconButton>
        </Box>
        
        {/* モバイル以外の場合のみスライダーを表示 */}
        <Box sx={{ 
          width: { xs: 0, sm: 100, md: 150 }, 
          mx: { xs: 0, sm: 1 }, 
          display: { xs: 'none', sm: 'block' } 
        }}>
          <Slider
            value={pageNumber}
            min={1}
            max={numPages || 1}
            step={1}
            onChange={goToPage}
            size="small"
            aria-label="ページスライダー"
            disabled={!numPages || numPages <= 1}
          />
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          flexWrap: 'nowrap', 
          ml: { xs: 'auto', sm: 0 } 
        }}>
          <Tooltip title="縮小">
            <IconButton onClick={zoomOut} disabled={scale <= 0.5} size={isMobile ? "small" : "medium"} sx={{ p: 0.5 }}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          
          <Typography variant="body2" sx={{ 
            mx: 0.5, 
            minWidth: { xs: 25, sm: 30 }, 
            textAlign: 'center',
            fontSize: { xs: '0.75rem', sm: '0.875rem' }
          }}>
            {Math.round(scale * 100)}%
          </Typography>
          
          <Tooltip title="拡大">
            <IconButton onClick={zoomIn} disabled={scale >= 3.0} size={isMobile ? "small" : "medium"} sx={{ p: 0.5 }}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={fullscreen ? "フルスクリーン解除" : "フルスクリーン"}>
            <IconButton onClick={toggleFullscreen} size={isMobile ? "small" : "medium"} sx={{ p: 0.5 }}>
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </ToolbarControl>
      
      {/* PDFビューア */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          overflowX: 'auto',
          backgroundColor: 'background.paper',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 0.5,
          position: 'relative',
          minHeight: 0 // スクロールを正しく動作させるために必要
        }}
      >
        {loading && (
          <Box sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}>
            <CircularProgress />
          </Box>
        )}
        
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<CircularProgress />}
          error={
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <Alert severity="error">PDFの読み込みに失敗しました</Alert>
              <Button 
                variant="contained" 
                onClick={() => window.open(url, '_blank')}
                sx={{ mt: 2 }}
              >
                ブラウザで開く
              </Button>
            </Box>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderAnnotationLayer={true}
            renderTextLayer={true}
            loading={<CircularProgress />}
            width={containerRef.current ? 
              Math.min(
                // コンテナ幅の95%を最大幅として設定
                containerRef.current.clientWidth * 0.95, 
                // 最大幅のキャップ
                isMobile ? 1000 : 2000
              ) : undefined
            }
          />
        </Document>
      </Box>
    </Box>
  );
};

export default PdfViewer;