// ~/Desktop/smart-paper-v2/frontend/src/components/papers/TranslationViewer.tsx
import { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import ErrorMessage from '../common/ErrorMessage';

interface TranslationViewerProps {
  translatedText: string | null;
  loading?: boolean;
  error?: string | null;
  chapter?: {
    title: string;
    chapter_number: number;
  };
  width?: number | string;
  height?: number | string;
}

const TranslationViewer: React.FC<TranslationViewerProps> = ({
  translatedText,
  loading = false,
  error = null,
  chapter,
  width = '100%',
  height = '100%'
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [copied, setCopied] = useState(false);
  
  // フォントサイズを変更
  const changeFontSize = (delta: number) => {
    setFontSize(prev => Math.min(Math.max(prev + delta, 12), 24));
  };
  
  // テキストをコピー
  const copyText = () => {
    if (!translatedText) return;
    
    navigator.clipboard.writeText(translatedText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text:', err);
      });
  };
  
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
      </Box>
    );
  }
  
  if (!translatedText) {
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
        <Typography>翻訳テキストがありません</Typography>
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
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
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {chapter && (
            <>
              <Chip 
                label={`Chapter ${chapter.chapter_number}`} 
                size="small" 
                color="primary" 
                variant="outlined" 
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                {chapter.title}
              </Typography>
            </>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="フォントサイズを小さく">
            <IconButton onClick={() => changeFontSize(-1)} disabled={fontSize <= 12}>
              <FormatSizeIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
          
          <Typography variant="body2" sx={{ mx: 1, minWidth: 20, textAlign: 'center' }}>
            {fontSize}
          </Typography>
          
          <Tooltip title="フォントサイズを大きく">
            <IconButton onClick={() => changeFontSize(1)} disabled={fontSize >= 24}>
              <FormatSizeIcon sx={{ fontSize: '1.4rem' }} />
            </IconButton>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Tooltip title={copied ? "コピーしました" : "テキストをコピー"}>
            <IconButton onClick={copyText}>
              {copied ? <DoneIcon color="success" /> : <ContentCopyIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      
      {/* 翻訳テキスト */}
      <Box
        ref={contentRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          bgcolor: 'background.paper',
          fontSize: `${fontSize}px`,
          lineHeight: 1.6,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: translatedText }} />
      </Box>
    </Box>
  );
};

export default TranslationViewer;