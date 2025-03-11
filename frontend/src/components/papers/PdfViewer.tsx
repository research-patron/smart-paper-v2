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

// PDFJSをインポート
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// PDF.jsのワーカーのパスを設定
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [fullscreen, setFullscreen] = useState(false);
  
  // PDFをロード
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // PDFを読み込む
        const loadingTask = pdfjsLib.getDocument(url);
        const doc = await loadingTask.promise;
        
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        
        if (onPageChange) {
          onPageChange(1, doc.numPages);
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('PDFの読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    
    loadPDF();
    
    // クリーンアップ
    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [url, onPageChange]);
  
  // ページを描画
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      
      try {
        // ページを取得
        const page = await pdfDoc.getPage(currentPage);
        
        // ビューポートを計算
        const viewport = page.getViewport({ scale });
        
        // canvasの寸法とコンテキストを設定
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('Canvas context not available');
        }
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // ページをレンダリング
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering PDF page:', err);
        setError('PDFページの表示に失敗しました。');
      }
    };
    
    renderPage();
  }, [pdfDoc, currentPage, scale]);
  
  // 前のページへ
  const goToPrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      
      if (onPageChange) {
        onPageChange(newPage, totalPages);
      }
    }
  };
  
  // 次のページへ
  const goToNextPage = () => {
    if (pdfDoc && currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      
      if (onPageChange) {
        onPageChange(newPage, totalPages);
      }
    }
  };
  
  // 特定のページへ
  const goToPage = (_event: Event, value: number | number[]) => {
    const newPage = typeof value === 'number' ? value : value[0];
    setCurrentPage(newPage);
    
    if (onPageChange) {
      onPageChange(newPage, totalPages);
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
  }, [currentPage, totalPages]);
  
  if (loading) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  
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
        sx={{
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: fullscreen ? 0 : undefined,
          borderTopRightRadius: fullscreen ? 0 : undefined,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={goToPrevPage} disabled={currentPage <= 1}>
            <NavigateBeforeIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', width: 100, mx: 1 }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {currentPage}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              / {totalPages}
            </Typography>
          </Box>
          
          <IconButton onClick={goToNextPage} disabled={currentPage >= totalPages}>
            <NavigateNextIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ width: 200, mx: 2, display: { xs: 'none', sm: 'block' } }}>
          <Slider
            value={currentPage}
            min={1}
            max={totalPages}
            step={1}
            onChange={goToPage}
            size="small"
            aria-label="ページスライダー"
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
          backgroundColor: '#f5f5f5',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 2,
        }}
      >
        <canvas ref={canvasRef} />
      </Box>
    </Box>
  );
};

export default PdfViewer;
