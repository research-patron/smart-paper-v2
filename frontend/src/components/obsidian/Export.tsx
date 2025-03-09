import { useState, useEffect } from 'react';
import {
  Button,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  AlertTitle,
  CircularProgress,
  Tooltip,
  Link
} from '@mui/material';
import BookIcon from '@mui/icons-material/Book';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuthStore } from '../../store/authStore';
import { Paper, TranslatedChapter } from '../../api/papers';
import { formatFileName, openInObsidian } from '../../api/obsidian';
import { MarkdownExporter } from '../../utils/MarkdownExporter';

interface ObsidianExportProps {
  paper: Paper;
  translatedChapters?: TranslatedChapter[];
  disabled?: boolean;
}

const ObsidianExport: React.FC<ObsidianExportProps> = ({ 
  paper, 
  translatedChapters = [],
  disabled = false
}) => {
  const { user } = useAuthStore();
  
  // 状態管理
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [vaultName, setVaultName] = useState('');
  const [fileType, setFileType] = useState<'md' | 'txt'>('md');
  const [openAfterExport, setOpenAfterExport] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settingsExist, setSettingsExist] = useState(false);
  
  // 設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Firestoreからユーザーの設定を取得
        const settingsRef = doc(db, `users/${user.uid}/obsidian_settings/default`);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setVaultName(data.vault_path || '');
          setFileType(data.file_type || 'md');
          setOpenAfterExport(data.open_after_export !== false);
          
          // 設定があることを記録
          setSettingsExist(true);
          
          // ファイル名をフォーマット
          if (data.file_name_format) {
            const formattedName = formatFileName(data.file_name_format, paper);
            setFileName(formattedName);
          } else {
            // デフォルトのファイル名
            setFileName(`paper_${Date.now()}`);
          }
        } else {
          // 設定がない場合はデフォルト値を使用
          setFileName(`paper_${Date.now()}`);
          setSettingsExist(false);
        }
      } catch (err) {
        console.error('Error loading Obsidian settings:', err);
        setError('設定の読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (dialogOpen) {
      loadSettings();
    }
  }, [user, dialogOpen, paper]);
  
  // Obsidianへのエクスポート処理
  const handleExport = () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ファイル名に拡張子を追加
      const extension = fileType === 'md' ? '.md' : '.txt';
      const fullFileName = fileName.endsWith(extension) ? fileName : fileName + extension;
      
      // Markdown生成
      let content = '';
      if (fileType === 'md') {
        content = MarkdownExporter.generateObsidianMarkdown(paper, translatedChapters);
      } else {
        content = MarkdownExporter.generateFullMarkdown(paper, translatedChapters);
      }
      
      // ダウンロード
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fullFileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // 成功メッセージを表示
      setSuccess(true);
      
      // Obsidianで開く
      if (openAfterExport && vaultName) {
        setTimeout(() => {
          openInObsidian(vaultName, fullFileName);
        }, 500);
      }
      
      // ダイアログを閉じる（少し遅延）
      setTimeout(() => {
        setDialogOpen(false);
        setSuccess(false);
      }, 1500);
      
    } catch (err) {
      console.error('Error exporting to Obsidian:', err);
      setError('エクスポートに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <Button
        variant="outlined"
        color="secondary"
        startIcon={<BookIcon />}
        onClick={() => setDialogOpen(true)}
        disabled={disabled || !paper.translated_text && !paper.translated_text_path}
        size="small"
      >
        Obsidianにエクスポート
      </Button>
      
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Obsidianにエクスポート</DialogTitle>
        
        <DialogContent>
          {!settingsExist && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <AlertTitle>Obsidian設定が未設定です</AlertTitle>
              <Typography variant="body2">
                Obsidian連携を使用するには、プロフィールページでObsidian設定を行ってください。
              </Typography>
              <Link href="/profile" color="inherit" underline="always">
                プロフィール設定へ移動
              </Link>
            </Alert>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              エクスポートに成功しました！
              {openAfterExport && vaultName && (
                <Typography variant="body2">
                  Obsidianが開かれます...
                </Typography>
              )}
            </Alert>
          )}
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              エクスポート設定
            </Typography>
            
            <TextField
              label="Vault名"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              fullWidth
              margin="normal"
              disabled={isLoading}
              required
              error={!vaultName}
              helperText={!vaultName ? "Vault名は必須です" : ""}
            />
            
            <TextField
              label="ファイル名"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              fullWidth
              margin="normal"
              disabled={isLoading}
              required
              error={!fileName}
              helperText={!fileName ? "ファイル名は必須です" : `拡張子 ${fileType === 'md' ? '.md' : '.txt'} が自動的に追加されます`}
            />
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              ファイル形式: {fileType === 'md' ? 'Markdown' : 'プレーンテキスト'}
              {openAfterExport && (
                <> • エクスポート後にObsidianで開く</>
              )}
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            エクスポートすると、翻訳されたテキストがダウンロードされ、設定に応じてObsidianで開かれます。
            ファイル形式や自動で開く設定を変更するには、プロフィールページのObsidian設定を編集してください。
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setDialogOpen(false)} 
            disabled={isLoading}
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleExport} 
            variant="contained" 
            color="primary"
            disabled={isLoading || !vaultName || !fileName}
          >
            {isLoading ? <CircularProgress size={24} /> : "エクスポート"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ObsidianExport;