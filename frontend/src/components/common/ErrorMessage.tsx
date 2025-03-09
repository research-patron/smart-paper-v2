// ~/Desktop/smart-paper-v2/frontend/src/components/common/ErrorMessage.tsx
import { useState } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Box, 
  Button, 
  Collapse, 
  Paper, 
  Typography,
  IconButton
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import DownloadIcon from '@mui/icons-material/Download';

interface ErrorMessageProps {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  title = 'エラーが発生しました', 
  message, 
  details,
  onRetry
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const handleDownloadLog = () => {
    // エラーログをダウンロード
    if (!details) return;
    
    const blob = new Blob([details], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error_log_${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
  
  // ユーモアのあるエラーメッセージを生成
  const getHumorousMessage = () => {
    const humorousMessages = [
      'おっと！論文が迷子になったようです。',
      'AIがちょっと休憩中です。すぐに戻ります！',
      '翻訳中に辞書が爆発しました。再試行してください。',
      'ビックリ！サーバーが突然昼寝を始めました。',
      '論文の量に圧倒されて、AIが一時的にフリーズしました。'
    ];
    
    const randomIndex = Math.floor(Math.random() * humorousMessages.length);
    return humorousMessages[randomIndex];
  };
  
  return (
    <Paper elevation={3} sx={{ p: 2, mt: 2, mb: 2 }}>
      <Alert 
        severity="error"
        action={
          details ? (
            <IconButton
              aria-label="toggle error details"
              color="inherit"
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          ) : undefined
        }
      >
        <AlertTitle>{title}</AlertTitle>
        <Typography variant="body1">
          {getHumorousMessage()}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {message}
        </Typography>
      </Alert>
      
      {details && (
        <Collapse in={expanded}>
          <Box 
            sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: 'grey.100', 
              borderRadius: 1,
              maxHeight: '200px',
              overflow: 'auto'
            }}
          >
            <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
              {details}
            </Typography>
            <Button
              startIcon={<DownloadIcon />}
              size="small"
              onClick={handleDownloadLog}
              sx={{ mt: 1 }}
            >
              エラーログをダウンロード
            </Button>
          </Box>
        </Collapse>
      )}
      
      {onRetry && (
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={onRetry}
          >
            再試行
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default ErrorMessage;