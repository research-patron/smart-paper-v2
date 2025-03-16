// ~/Desktop/smart-paper-v2/frontend/src/components/papers/SplitView.tsx
import { useState, useRef, useEffect } from 'react';
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
import SyncIcon from '@mui/icons-material/Sync';
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [tabValue, setTabValue] = useState(0);
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical'>('vertical');
  const [splitRatio, setSplitRatio] = useState(50);
  const [syncScroll, setSyncScroll] = useState(true);
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
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
  
  // 同期スクロールの切り替え
  const toggleSyncScroll = () => {
    setSyncScroll(prev => !prev);
  };
  
  // 分割比率をリセット
  const resetSplitRatio = () => {
    setSplitRatio(50);
  };
  
  // 分割比率の調整
  const adjustSplitRatio = (delta: number) => {
    setSplitRatio(prev => Math.min(Math.max(prev + delta, 20), 80));
  };
  
  // 同期スクロール処理
  useEffect(() => {
    if (!syncScroll || isMobile) return;
    
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    
    if (!leftPanel || !rightPanel) return;
    
    const handleLeftScroll = () => {
      if (!syncScroll || isDragging.current) return;
      
      const leftRatio = leftPanel.scrollTop / (leftPanel.scrollHeight - leftPanel.clientHeight);
      rightPanel.scrollTop = leftRatio * (rightPanel.scrollHeight - rightPanel.clientHeight);
    };
    
    const handleRightScroll = () => {
      if (!syncScroll || isDragging.current) return;
      
      const rightRatio = rightPanel.scrollTop / (rightPanel.scrollHeight - rightPanel.clientHeight);
      leftPanel.scrollTop = rightRatio * (leftPanel.scrollHeight - leftPanel.clientHeight);
    };
    
    leftPanel.addEventListener('scroll', handleLeftScroll);
    rightPanel.addEventListener('scroll', handleRightScroll);
    
    return () => {
      leftPanel.removeEventListener('scroll', handleLeftScroll);
      rightPanel.removeEventListener('scroll', handleRightScroll);
    };
  }, [syncScroll, isMobile]);
  
  // ドラッグによる分割比率の調整
  useEffect(() => {
    const container = document.getElementById('split-container');
    const divider = document.getElementById('split-divider');
    
    if (!container || !divider) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      startX.current = e.clientX;
      startY.current = e.clientY;
      startRatio.current = splitRatio;
      
      document.body.style.cursor = splitDirection === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      
      const containerRect = container.getBoundingClientRect();
      
      if (splitDirection === 'vertical') {
        const deltaX = e.clientX - startX.current;
        const containerWidth = containerRect.width;
        const deltaRatio = (deltaX / containerWidth) * 100;
        setSplitRatio(Math.min(Math.max(startRatio.current + deltaRatio, 20), 80));
      } else {
        const deltaY = e.clientY - startY.current;
        const containerHeight = containerRect.height;
        const deltaRatio = (deltaY / containerHeight) * 100;
        setSplitRatio(Math.min(Math.max(startRatio.current + deltaRatio, 20), 80));
      }
    };
    
    const handleMouseUp = () => {
      if (!isDragging.current) return;
      
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    divider.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      divider.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [splitDirection, splitRatio]);
  
  // モバイル表示の場合はタブ切り替え式にする
  if (isMobile) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Paper sx={{ mb: 1 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            aria-label="原文/翻訳切り替えタブ"
          >
            <Tab label="原文" />
            <Tab label="翻訳" />
          </Tabs>
        </Paper>
        
        <Box sx={{ flex: 1, display: tabValue === 0 ? 'block' : 'none', height: 'calc(100% - 48px)' }}>
          <PdfViewer url={pdfUrl} />
        </Box>
        
        <Box sx={{ flex: 1, display: tabValue === 1 ? 'block' : 'none', height: 'calc(100% - 48px)' }}>
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
  
  return (
    <Box
      id="split-container"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: splitDirection === 'vertical' ? 'row' : 'column',
        position: 'relative',
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
        
        <Divider orientation="vertical" flexItem />
        
        <Tooltip title={syncScroll ? "同期スクロールを無効化" : "同期スクロールを有効化"}>
          <IconButton size="small" onClick={toggleSyncScroll}>
            {syncScroll ? <SyncIcon color="primary" /> : <SyncDisabledIcon />}
          </IconButton>
        </Tooltip>
      </Paper>
      
      {/* 左側/上側パネル (PDF) */}
      <Box
        ref={leftPanelRef}
        sx={{
          width: splitDirection === 'vertical' ? `${splitRatio}%` : '100%',
          height: splitDirection === 'vertical' ? '100%' : `${splitRatio}%`,
          overflow: 'auto'
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
          '&:hover': {
            backgroundColor: theme.palette.primary.main,
          },
        }}
      />
      
      {/* 右側/下側パネル (翻訳) */}
      <Box
        ref={rightPanelRef}
        sx={{
          width: splitDirection === 'vertical' ? `calc(100% - ${splitRatio}% - 4px)` : '100%',
          height: splitDirection === 'vertical' ? '100%' : `calc(100% - ${splitRatio}% - 4px)`,
          overflow: 'auto'
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
