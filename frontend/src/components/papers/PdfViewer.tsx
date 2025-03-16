// ~/Desktop/smart-paper-v2/frontend/src/components/papers/PdfViewer.tsx
import { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  IconButton,
  Slider,
  Tooltip,
  Paper,
  Alert,
  Button
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

const PdfViewer: React.FC<PdfViewerProps> = ({ 
  url, 
  width = '100%', 
  height = '100%',
  onPageChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.4);
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
          width,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column'
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
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        position: fullscreen ? 'fixed' : 'relative',
        top: fullscreen ? 0 : 'auto',
        left: fullscreen ? 0 : 'auto',
        right: fullscreen ? 0 : 'auto',
        bottom: fullscreen ? 0 : 'auto',
        zIndex: fullscreen ? 9999 : 'auto',
        bgcolor: 'background.paper',
      }}
    >
      {/* コントロールバー */}
      <Paper
        elevation={1}
        square
        sx={{
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={goToPrevPage} disabled={pageNumber <= 1}>
            <NavigateBeforeIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', width: 100, mx: 1 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {pageNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              / {numPages || '--'}
            </Typography>
          </Box>
          
          <IconButton onClick={goToNextPage} disabled={!numPages || pageNumber >= numPages}>
            <NavigateNextIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ width: 200, mx: 2, display: { xs: 'none', sm: 'block' } }}>
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
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="縮小">
            <IconButton onClick={zoomOut} disabled={scale <= 0.5}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          
          <Typography variant="body2" sx={{ mx: 1, minWidth: 40, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </Typography>
          
          <Tooltip title="拡大">
            <IconButton onClick={zoomIn} disabled={scale >= 3.0}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={fullscreen ? "フルスクリーン解除" : "フルスクリーン"}>
            <IconButton onClick={toggleFullscreen}>
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      
      {/* PDFビューア */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          overflowX: 'hidden',
          backgroundColor: 'background.paper',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 0.5,
        }}
      >
        {loading && (
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
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
          />
        </Document>
      </Box>
    </Box>
  );
};

export default PdfViewer;
