// ~/Desktop/smart-paper-v2/frontend/src/components/papers/TranslationViewer.tsx
import { useState, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  CircularProgress
} from '@mui/material';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import ErrorMessage from '../common/ErrorMessage';

interface TranslationViewerProps {
  translatedText: string | null;
  processedContent?: string | null; // バックエンドで処理済みのコンテンツ
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
  processedContent, // バックエンドで処理済みのコンテンツ
  loading = false,
  error = null,
  chapter,
  width = '100%',
  height = '100%'
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [copied, setCopied] = useState(false);
  
  // Cloud Functionsからの処理済みテキストを使用
  // フロントエンドでのJSONパース処理を避ける
  const processedText = useMemo(() => {
    // 1. バックエンドから直接処理済みコンテンツが提供されている場合はそれを使用
    if (processedContent) {
      console.log("Using pre-processed content from backend");
      return processedContent;
    }
    
    // 2. 翻訳テキストが直接HTMLとして提供されている場合（Cloud Functionsで処理済み）
    if (translatedText) {
      console.log("Using translated text directly (already processed by Cloud Functions)");
      
      // 特別なケース：番号付きリストが ##で始まっている可能性がある問題の修正
      let processedText = translatedText;
      
      // 「数字. 」で始まる行の前に ## が含まれる場合、それを削除
      processedText = processedText.replace(/##\s+(\d+\.\s+)/g, '$1');
      
      return processedText;
    }
    
    // 3. どちらも提供されていない場合
    return null;
  }, [translatedText, processedContent]);
  
  // フォントサイズを変更
  const changeFontSize = (delta: number) => {
    setFontSize(prev => Math.min(Math.max(prev + delta, 12), 24));
  };
  
  // テキストをコピー
  const copyText = () => {
    if (!processedText) return;
    
    // HTML形式から平文に変換してコピー
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedText;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    navigator.clipboard.writeText(plainText)
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
  
  if (!processedText) {
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
          p: 4,
          bgcolor: 'background.paper',
          fontSize: `${fontSize}px`,
          lineHeight: 1.6,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: processedText }} />
      </Box>
    </Box>
  );
};

export default TranslationViewer;