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
  LinearProgress,
  alpha,
  Grow,
  CircularProgress
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
  const [uploadProgress, setUploadProgress] = useState(0); // アニメーション用の進捗状態
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const theme = useTheme();

  // アップロード進捗のアニメーション
  useEffect(() => {
    if (!isUploading) return;
    
    // 0%から60%までアニメーション
    const timer = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 60) {
          clearInterval(timer);
          return 60;
        }
        return prev + 1;
      });
    }, 100);
    
    return () => clearInterval(timer);
  }, [isUploading]);

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
    
    // アップロード成功時に60%から100%へ進捗を進める
    setUploadProgress(60);
    const timer = setTimeout(() => {
      setUploadProgress(100);
    }, 500);
    
    // バリデーション通過時に10秒カウントダウン開始
    setReloadCountdown(10);
    
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
    setUploadProgress(0); // 進捗をリセット
    
    try {
      // 実際のアップロード処理
      console.log("Uploading PDF with user ID:", userId);
      const paperId = await uploadPDF(file, userId);
      
      // アップロード成功時の進捗を100%に
      setUploadProgress(100);
      
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
      setUploadProgress(0); // 進捗をリセット
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
    setUploadProgress(0); // 進捗をリセット
    
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
    <Box sx={{ my: 2, width: '100%' }}>
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
            position: 'relative',
            borderRadius: 3,
            boxShadow: isDragging 
              ? `0 0 0 3px ${theme.palette.primary.main}, 0 15px 40px rgba(0,0,0,0.15)` 
              : '0 10px 30px rgba(0,0,0,0.1)',
            cursor: isUploading ? 'default' : 'pointer',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            overflow: 'visible',
            height: 'auto',
            minHeight: 200,
            '&:hover': isUploading ? {} : {
              transform: 'translateY(-5px)',
              boxShadow: '0 15px 30px rgba(0,0,0,0.15)',
            },
            backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
          }}
        >
          {/* 装飾的な要素 */}
          <Box 
            sx={{ 
              position: 'absolute',
              top: -50,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: '50%',
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              zIndex: 0,
            }}
          />
          <Box 
            sx={{ 
              position: 'absolute',
              bottom: -30,
              left: -30,
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
              zIndex: 0,
            }}
          />
          
          {/* パターン装飾 - SANGOテーマ風 */}
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              opacity: 0.5,
              background: `radial-gradient(${alpha(theme.palette.primary.main, 0.2)} 3px, transparent 3px)`,
              backgroundSize: '30px 30px',
              zIndex: 0,
            }} 
          />
          
          <CardContent sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
            px: { xs: 2, sm: 3, md: 4 },
            py: 3,
          }}>
            {selectedFile ? (
              <Box sx={{ textAlign: 'center', width: '100%' }}>
                <Grow in={true} timeout={500}>
                  <Box sx={{ mb: 2, position: 'relative', display: 'inline-block' }}>
                    <Box 
                      sx={{ 
                        bgcolor: uploadProgress === 100 ? theme.palette.success.main : theme.palette.primary.main, 
                        color: 'white', 
                        width: 70, 
                        height: 70, 
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                      }}
                    >
                      {uploadProgress === 100 ? (
                        <CheckCircleIcon sx={{ fontSize: 40 }} />
                      ) : (
                        <PictureAsPdfIcon sx={{ fontSize: 40 }} />
                      )}
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
                          boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.error.light, 0.9),
                            color: 'white'
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Grow>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontWeight: 600,
                    mb: 0.5,
                  }}
                >
                  {selectedFile.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {formatFileSize(selectedFile.size)}
                </Typography>
                
                {isUploading && (
                  <Box sx={{ mt: 1, mx: 'auto', width: '90%', maxWidth: 400 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {reloadCountdown !== null 
                          ? '検証完了！' 
                          : 'アップロード中...'}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color={uploadProgress === 100 ? 'success.main' : 'text.secondary'}
                        sx={{ fontWeight: 600 }}
                      >
                        {uploadProgress}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={uploadProgress}
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          backgroundImage: uploadProgress === 100
                            ? `linear-gradient(to right, ${theme.palette.success.light}, ${theme.palette.success.main})`
                            : `linear-gradient(to right, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                        }
                      }}
                    />
                    {reloadCountdown !== null && (
                      <Typography 
                        variant="caption" 
                        color="success.main" 
                        align="center" 
                        sx={{ 
                          mt: 1, 
                          display: 'block',
                          fontWeight: 500,
                        }}
                      >
                        {reloadCountdown}秒後にページがリロードされます...
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            ) : (
              <Grow in={true} timeout={800}>
                <Box 
                  sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                  }}
                >
                  <Box 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 80,
                      height: 80,
                      borderRadius: 3,
                      backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      color: 'white',
                      mb: 3,
                      transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                      transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                      boxShadow: isDragging 
                        ? '0 8px 20px rgba(248, 198, 119, 0.4)' 
                        : '0 10px 25px rgba(248, 198, 119, 0.25)',
                    }}
                  >
                    <CloudUploadIcon sx={{ fontSize: 45 }} />
                  </Box>

                  <Typography 
                    variant="h6" 
                    align="center" 
                    sx={{ 
                      fontWeight: 700,
                      mb: 1,
                    }}
                  >
                    論文PDFをアップロード
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    align="center" 
                    sx={{ 
                      maxWidth: 400,
                      mb: 2,
                    }}
                  >
                    PDFファイルをドラッグ＆ドロップするか、クリックして選択してください
                  </Typography>
                  
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<UploadFileIcon />}
                    sx={{ 
                      mt: 1, 
                      borderRadius: 3,
                      px: 3,
                      py: 0.75,
                      borderWidth: 1,
                      '&:hover': {
                        borderWidth: 1,
                      }
                    }}
                  >
                    ファイルを選択
                  </Button>
                  
                  {isDragging && (
                    <Typography 
                      variant="subtitle1" 
                      color="primary" 
                      sx={{ 
                        position: 'absolute',
                        bottom: '10%',
                        fontWeight: 600, 
                        animation: 'pulse 1.5s infinite',
                        '@keyframes pulse': {
                          '0%': { opacity: 0.6 },
                          '50%': { opacity: 1 },
                          '100%': { opacity: 0.6 }
                        }
                      }}
                    >
                      ファイルをここにドロップ！
                    </Typography>
                  )}
                </Box>
              </Grow>
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