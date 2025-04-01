// ~/Desktop/smart-paper-v2/frontend/src/components/papers/SplitView.tsx
import { useState, useRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Divider
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PdfViewer from './PdfViewer';
import TranslationViewer from './TranslationViewer';

interface SplitViewProps {
  pdfUrl: string;
  translatedText: string | null;
  loading?: boolean;
  error?: string | null;
  chapter?: {
    title: string;
    chapter_number: number;
  };
}

// コントロールバーコンポーネント
const ToolbarControl = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      position: 'absolute',
      top: 4,
      right: 4,
      zIndex: 100,
      padding: '4px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      // 調整されたスタイル
      bgcolor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: '2px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}
  >
    {children}
  </Box>
);

const SplitView: React.FC<SplitViewProps> = ({
  pdfUrl,
  translatedText,
  loading = false,
  error = null,
  chapter
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [tabValue, setTabValue] = useState(0);
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical'>('vertical');
  const [splitRatio, setSplitRatio] = useState(50);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startRatio = useRef(0);
  
  // タブの切り替え
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // 分割方向の切り替え
  const toggleSplitDirection = () => {
    setSplitDirection(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
  };
  
  // 分割比率をリセット
  const resetSplitRatio = () => {
    setSplitRatio(50);
  };
  
  // 分割比率の調整
  const adjustSplitRatio = (delta: number) => {
    setSplitRatio(prev => Math.min(Math.max(prev + delta, 20), 80));
  };
  
  // モバイル表示の場合はタブ切り替え式にする
  if (isMobile) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        width: '100%',
        flex: 1,
        overflow: 'hidden'
      }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="原文/翻訳切り替えタブ"
          sx={{ 
            minHeight: '40px',
            '& .MuiTab-root': { 
              minHeight: '40px',
              py: 0.5,
              fontSize: { xs: '0.8rem', sm: '0.875rem' }
            }
          }}
        >
          <Tab label="原文" />
          <Tab label="翻訳" />
        </Tabs>
        
        <Box sx={{ 
          flex: 1, 
          display: 'flex',
          height: '100%',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            width: '100%',
            height: '100%',
            display: tabValue === 0 ? 'flex' : 'none', 
            flex: 1,
            overflow: 'hidden'
          }}>
            <PdfViewer url={pdfUrl} />
          </Box>
          
          <Box sx={{ 
            width: '100%',
            height: '100%',
            display: tabValue === 1 ? 'flex' : 'none',
            flex: 1,
            overflow: 'hidden'
          }}>
            <TranslationViewer 
              translatedText={translatedText} 
              loading={loading} 
              error={error}
              chapter={chapter}
            />
          </Box>
        </Box>
      </Box>
    );
  }
  
  // 縦分割（左右）の場合
  if (splitDirection === 'vertical') {
    return (
      <Box
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          flex: 1,
          gap: '4px' // 分割線の幅
        }}
      >
        {/* コントロールバー */}
        <ToolbarControl>
          <Tooltip title="横/縦分割の切り替え">
            <IconButton size="small" onClick={toggleSplitDirection}>
              <CompareArrowsIcon 
                sx={{ 
                  transform: 'rotate(90deg)',
                  transition: 'transform 0.2s'
                }} 
              />
            </IconButton>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem />
          
          <Tooltip title="左側を広げる">
            <IconButton size="small" onClick={() => adjustSplitRatio(-5)} disabled={splitRatio <= 20}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="比率をリセット">
            <IconButton size="small" onClick={resetSplitRatio}>
              <DoubleArrowIcon sx={{ transform: 'rotate(90deg)' }} />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="右側を広げる">
            <IconButton size="small" onClick={() => adjustSplitRatio(5)} disabled={splitRatio >= 80}>
              <ArrowForwardIcon />
            </IconButton>
          </Tooltip>
        </ToolbarControl>
        
        {/* 左側スティッキーパネル (PDF) */}
        <Box
          sx={{
            width: `${splitRatio}%`,
            height: '100vh', // 画面の高さいっぱいに
            position: 'sticky',
            top: 0,
            left: 0,
            display: 'flex',
            overflow: 'auto', // PDFコンテンツのスクロールを可能に
            boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
            alignSelf: 'flex-start',
            backgroundColor: 'background.paper',
            flexDirection: 'column' // PdfViewerを縦方向いっぱいに表示
          }}
        >
          <PdfViewer url={pdfUrl} height="100%" />
        </Box>
        
        {/* 右側スクロール可能パネル (翻訳) */}
        <Box
          sx={{
            width: `calc(100% - ${splitRatio}% - 4px)`,
            height: '100%',
            overflow: 'auto',
            position: 'relative',
            display: 'flex',
            flex: 1
          }}
        >
          <TranslationViewer 
            translatedText={translatedText} 
            loading={loading} 
            error={error}
            chapter={chapter}
          />
        </Box>
      </Box>
    );
  }
  
  // 横分割（上下）の場合
  return (
    <Box
      id="split-container"
      ref={containerRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        flex: 1
      }}
    >
      {/* コントロールバー */}
      <ToolbarControl>
        <Tooltip title="横/縦分割の切り替え">
          <IconButton size="small" onClick={toggleSplitDirection}>
            <CompareArrowsIcon 
              sx={{ 
                transform: 'rotate(0deg)',
                transition: 'transform 0.2s'
              }} 
            />
          </IconButton>
        </Tooltip>
        
        <Divider orientation="vertical" flexItem />
        
        <Tooltip title="上側を広げる">
          <IconButton size="small" onClick={() => adjustSplitRatio(-5)} disabled={splitRatio <= 20}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="比率をリセット">
          <IconButton size="small" onClick={resetSplitRatio}>
            <DoubleArrowIcon sx={{ transform: 'rotate(90deg)' }} />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="下側を広げる">
          <IconButton size="small" onClick={() => adjustSplitRatio(5)} disabled={splitRatio >= 80}>
            <ArrowForwardIcon />
          </IconButton>
        </Tooltip>
      </ToolbarControl>
      
      {/* 上側パネル (PDF) */}
      <Box
        sx={{
          width: '100%',
          height: `${splitRatio}%`,
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          overflow: 'hidden',
          flex: `0 0 ${splitRatio}%`
        }}
      >
        <PdfViewer url={pdfUrl} />
      </Box>
      
      {/* 分割線 */}
      <Box
        id="split-divider"
        sx={{
          width: '100%',
          height: '4px',
          backgroundColor: theme.palette.divider,
          cursor: 'row-resize',
          userSelect: 'none',
          transition: 'background-color 0.2s',
          flexShrink: 0,
          '&:hover': {
            backgroundColor: theme.palette.primary.main,
          },
        }}
      />
      
      {/* 下側パネル (翻訳) - スクロール可能 */}
      <Box
        sx={{
          width: '100%',
          height: `calc(100% - ${splitRatio}% - 4px)`,
          overflow: 'auto',
          flexShrink: 0,
          flexGrow: 1,
          position: 'relative',
          display: 'flex'
        }}
      >
        <TranslationViewer 
          translatedText={translatedText} 
          loading={loading} 
          error={error}
          chapter={chapter}
        />
      </Box>
    </Box>
  );
};

export default SplitView;