// ~/Desktop/smart-paper-v2/frontend/src/components/papers/SplitView.tsx
import { useState, useRef } from 'react';
import {
  Box,
  Paper,
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
        <Paper sx={{ mb: 1 }}>
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
        </Paper>
        
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
  
  return (
    <Box
      id="split-container"
      ref={containerRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: splitDirection === 'vertical' ? 'row' : 'column',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        flex: 1
      }}
    >
      {/* コントロールバー */}
      <Paper
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 10,
          py: 0.25,
          px: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <Tooltip title="横/縦分割の切り替え">
          <IconButton size="small" onClick={toggleSplitDirection}>
            <CompareArrowsIcon 
              sx={{ 
                transform: splitDirection === 'vertical' ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }} 
            />
          </IconButton>
        </Tooltip>
        
        <Divider orientation="vertical" flexItem />
        
        <Tooltip title="左側/上側を広げる">
          <IconButton size="small" onClick={() => adjustSplitRatio(-5)} disabled={splitRatio <= 20}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="比率をリセット">
          <IconButton size="small" onClick={resetSplitRatio}>
            <DoubleArrowIcon sx={{ transform: 'rotate(90deg)' }} />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="右側/下側を広げる">
          <IconButton size="small" onClick={() => adjustSplitRatio(5)} disabled={splitRatio >= 80}>
            <ArrowForwardIcon />
          </IconButton>
        </Tooltip>
      </Paper>
      
      {/* 左側/上側パネル (PDF) - 固定表示 */}
      <Box
        sx={{
          width: splitDirection === 'vertical' ? `${splitRatio}%` : '100%',
          height: splitDirection === 'vertical' ? '100%' : `${splitRatio}%`,
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          overflow: 'hidden',
          flex: splitDirection === 'vertical' ? `0 0 ${splitRatio}%` : '0 0 auto'
        }}
      >
        <PdfViewer url={pdfUrl} />
      </Box>
      
      {/* 分割線 */}
      <Box
        id="split-divider"
        sx={{
          width: splitDirection === 'vertical' ? '4px' : '100%',
          height: splitDirection === 'vertical' ? '100%' : '4px',
          backgroundColor: theme.palette.divider,
          cursor: splitDirection === 'vertical' ? 'col-resize' : 'row-resize',
          userSelect: 'none',
          transition: 'background-color 0.2s',
          flexShrink: 0,
          '&:hover': {
            backgroundColor: theme.palette.primary.main,
          },
        }}
      />
      
      {/* 右側/下側パネル (翻訳) - スクロール可能 */}
      <Box
        sx={{
          width: splitDirection === 'vertical' ? `calc(100% - ${splitRatio}% - 4px)` : '100%',
          height: splitDirection === 'vertical' ? '100%' : `calc(100% - ${splitRatio}% - 4px)`,
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