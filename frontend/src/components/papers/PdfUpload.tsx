// ~/Desktop/smart-paper-v2/frontend/src/components/papers/PdfUpload.tsx
import { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Card,
  CardContent,
  IconButton,
  useTheme,
  LinearProgress
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CancelIcon from '@mui/icons-material/Cancel';
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
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [reloadCountdown, setReloadCountdown] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const theme = useTheme();

  // 10秒カウントダウン後にリロードする
  useEffect(() => {
    if (reloadCountdown === null) return;
    
    if (reloadCountdown <= 0) {
      // カウントダウン終了時にリロード
      window.location.reload();
      return;
    }
    
    // 1秒ごとにカウントダウン
    const timer = setTimeout(() => {
      setReloadCountdown(prev => prev !== null ? prev - 1 : null);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [reloadCountdown]);
  
  // ファイルのバリデーション
  const validateFile = (file: File): boolean => {
    // PDFファイルであるかチェック
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    // ファイルサイズが20MB以下であるかチェック
    const isValidSize = file.size <= 20 * 1024 * 1024; // 20MB
    
    if (!isPdf) {
      setError('PDFファイルのみアップロード可能です');
      return false;
    }
    
    if (!isValidSize) {
      setError('ファイルサイズは20MB以下にしてください');
      return false;
    }
    
    // バリデーション通過時に10秒カウントダウン開始
    setReloadCountdown(30);
    
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
        // ファイル選択時に自動的にアップロードを開始
        handleUpload(file);
      }
    }
  };
  
  // ドラッグ&ドロップ関連のイベントハンドラ
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
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
    
    // アップロード中は新しいファイルのドロップを無視
    if (isUploading) return;
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setError(null);
        // ドロップされたファイルを自動的にアップロード
        handleUpload(file);
      }
    }
  };
  
  // ファイル選択ダイアログを開く
  const openFileDialog = () => {
    // アップロード中は選択ダイアログを開かない
    if (isUploading) return;
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // アップロード処理
  const handleUpload = async (file: File = selectedFile!) => {
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }
    
    // デモ用：userが未設定でも動作するように修正
    const userId = user?.uid || 'demo-user-id';
    
    setIsUploading(true);
    setError(null);
    setErrorDetails(null);
    
    try {
      // 実際のアップロード処理
      console.log("Uploading PDF with user ID:", userId);
      const paperId = await uploadPDF(file, userId);
      
      // アップロード成功時のコールバック
      if (onUploadSuccess) {
        onUploadSuccess(paperId);
      }
      
      // リセット - カウントダウン中はリセットしない
      if (reloadCountdown === null) {
        setTimeout(() => {
          setSelectedFile(null);
          setIsUploading(false);
        }, 500);
      }
      
    } catch (error: any) {
      console.error('Upload failed:', error);
      setError(error.message || 'アップロードに失敗しました');
      setErrorDetails(JSON.stringify(error, null, 2));
      setIsUploading(false);
      // エラー時はカウントダウンをキャンセル
      setReloadCountdown(null);
    }
  };
  
  // キャンセル処理
  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation(); // クリックイベントの伝播を停止
    setSelectedFile(null);
    setError(null);
    setErrorDetails(null);
    setReloadCountdown(null); // カウントダウンもキャンセル
    
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
    <Box sx={{ my: 3 }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf"
        style={{ display: 'none' }}
        multiple={false}
        disabled={isUploading}
      />
      
      <Box
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{ width: '100%' }}
      >
        <Card
          onClick={!isUploading ? openFileDialog : undefined}
          sx={{
            borderRadius: 3,
            boxShadow: isDragging 
              ? '0 0 0 2px #f8c677, 0 8px 24px rgba(0,0,0,0.12)' 
              : '0 8px 24px rgba(0,0,0,0.08)',
            cursor: isUploading ? 'default' : 'pointer',
            transition: 'all 0.3s ease',
            overflow: 'hidden',
            height: 200,
            '&:hover': isUploading ? {} : {
              transform: 'translateY(-4px)',
              boxShadow: '0 16px 32px rgba(0,0,0,0.12)',
            },
            position: 'relative',
            background: theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, #2c3e50 0%, #4a6572 100%)' 
              : 'linear-gradient(135deg, #f8f9fa 0%, #f1f5f8 100%)',
          }}
        >
          {/* 装飾的なドット模様 */}
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '100%',
              opacity: 0.4,
              background: `radial-gradient(#f8c677 8%, transparent 8%)`,
              backgroundPosition: '0 0',
              backgroundSize: '24px 24px',
              zIndex: 0
            }} 
          />
          
          <CardContent sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            {selectedFile ? (
              <Box sx={{ textAlign: 'center', width: '100%' }}>
                <Box sx={{ mb: 2, position: 'relative', display: 'inline-block' }}>
                  <Box 
                    sx={{ 
                      bgcolor: 'primary.main', 
                      color: 'white', 
                      width: 64, 
                      height: 64, 
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 40 }} />
                  </Box>
                  {!isUploading && (
                    <IconButton 
                      size="small" 
                      onClick={handleCancel} 
                      sx={{ 
                        position: 'absolute', 
                        top: -8, 
                        right: -8,
                        bgcolor: 'background.paper',
                        boxShadow: 1,
                        '&:hover': {
                          bgcolor: 'error.light',
                          color: 'white'
                        }
                      }}
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {selectedFile.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {formatFileSize(selectedFile.size)}
                </Typography>
                
                {isUploading && (
                  <Box sx={{ mt: 1, mx: 'auto', width: '80%', maxWidth: 400 }}>
                    <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 1 }}>
                      {reloadCountdown !== null 
                        ? `検証完了！ ${reloadCountdown}秒後にリロードします...` 
                        : 'ファイルをアップロード中...'}
                    </Typography>
                    <LinearProgress />
                  </Box>
                )}
              </Box>
            ) : (
              <>
                <Box 
                  sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2
                  }}
                >
                  <Box 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 72,
                      height: 72,
                      borderRadius: 2,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      mb: 2,
                      transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                      transition: 'transform 0.2s ease-in-out'
                    }}
                  >
                    <UploadFileIcon sx={{ fontSize: 40 }} />
                  </Box>

                  <Typography variant="h6" align="center" sx={{ fontWeight: 'medium' }}>
                    PDFファイルをドラッグ＆ドロップ
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                    またはクリックしてアップロード {isDragging && '- ファイルをドロップ！'}
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
      
      {error && (
        <ErrorMessage 
          message={error}
          details={errorDetails || undefined}
          onRetry={selectedFile && !isUploading ? () => handleUpload() : undefined}
        />
      )}
    </Box>
  );
};

export default PdfUpload;