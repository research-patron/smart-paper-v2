// ~/Desktop/smart-paper-v2/frontend/src/components/papers/PdfUpload.tsx
import { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  LinearProgress, 
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { uploadPDF } from '../../api/papers';
import { useAuthStore } from '../../store/authStore';
import ErrorMessage from '../common/ErrorMessage';

interface PdfUploadProps {
  onUploadSuccess?: (paperId: string) => void;
}

const PdfUpload: React.FC<PdfUploadProps> = ({ onUploadSuccess }) => {
  const { user } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // ファイルのバリデーション
  const validateFile = (file: File): boolean => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('PDFファイルのみアップロード可能です');
      return false;
    }
    
    if (file.size > 20 * 1024 * 1024) { // 20MB
      setError('ファイルサイズは20MB以下にしてください');
      return false;
    }
    
    return true;
  };
  
  // ファイル選択時の処理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setError(null);
      }
    }
  };
  
  // ドラッグ&ドロップ関連のイベントハンドラ
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setError(null);
      }
    }
  };
  
  // ファイル選択ダイアログを開く
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // アップロード処理
  const handleUpload = async () => {
    if (!selectedFile || !user) {
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setErrorDetails(null);
    
    try {
      // アップロード進捗シミュレーション
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 500);
      
      // 実際のアップロード処理
      const paperId = await uploadPDF(selectedFile, user.uid);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // アップロード成功時のコールバック
      if (onUploadSuccess) {
        onUploadSuccess(paperId);
      }
      
      // リセット
      setTimeout(() => {
        setSelectedFile(null);
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
      
    } catch (error: any) {
      console.error('Upload failed:', error);
      setError(error.message || 'アップロードに失敗しました');
      setErrorDetails(JSON.stringify(error, null, 2));
      setIsUploading(false);
    }
  };
  
  // キャンセル処理
  const handleCancel = () => {
    setSelectedFile(null);
    setError(null);
    setErrorDetails(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // ファイルサイズのフォーマット
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  return (
    <Box sx={{ mt: 2 }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf"
        style={{ display: 'none' }}
        multiple={false}
      />
      
      <Box
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{ width: '100%' }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            border: isDragging ? `2px dashed ${theme.palette.primary.main}` : '2px dashed #ccc',
            backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.05)' : 'white',
            textAlign: 'center',
            cursor: isUploading ? 'default' : 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={isUploading ? undefined : openFileDialog}
        >
          {isUploading ? (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                アップロード中...
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress} 
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                {`${uploadProgress}%`} 完了
              </Typography>
            </Box>
          ) : selectedFile ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <PictureAsPdfIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="subtitle1" component="div">
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleUpload}
                  startIcon={<CloudUploadIcon />}
                >
                  アップロード
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleCancel}
                >
                  キャンセル
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <CloudUploadIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                PDFファイルをドラッグ＆ドロップ
              </Typography>
              <Typography variant="body1" gutterBottom>
                または
              </Typography>
              <Button
                variant="contained"
                component="span"
                startIcon={<CloudUploadIcon />}
              >
                ファイルを選択
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                最大ファイルサイズ: 20MB
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
      
      {error && (
        <ErrorMessage 
          message={error}
          details={errorDetails || undefined}
          onRetry={selectedFile ? handleUpload : undefined}
        />
      )}
    </Box>
  );
};

export default PdfUpload;