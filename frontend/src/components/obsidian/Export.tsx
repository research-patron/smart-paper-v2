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
  Link,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListItemText
} from '@mui/material';
import BookIcon from '@mui/icons-material/Book';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuthStore } from '../../store/authStore';
import { Paper, TranslatedChapter, getPaperPdfUrl } from '../../api/papers';
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
  const [folderPath, setFolderPath] = useState('');
  const [fileType, setFileType] = useState<'md' | 'txt'>('md');
  const [openAfterExport, setOpenAfterExport] = useState(true);
  const [includePdf, setIncludePdf] = useState(true);
  const [createEmbedFolder, setCreateEmbedFolder] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>("");
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
          setFolderPath(data.folder_path || '');
          setFileType(data.file_type || 'md');
          setOpenAfterExport(data.open_after_export !== false);
          setIncludePdf(data.include_pdf !== false);
          setCreateEmbedFolder(data.create_embed_folder !== false);
          
          // 設定があることを記録
          setSettingsExist(true);
          
          // ファイル名をフォーマット
          if (data.file_name_format) {
            const formattedName = formatFileName(data.file_name_format, paper);
            setFileName(formattedName);
          } else {
            // デフォルトのファイル名
            setFileName(MarkdownExporter.generateSafeFileName(paper));
          }
        } else {
          // 設定がない場合はデフォルト値を使用
          setFileName(MarkdownExporter.generateSafeFileName(paper));
          setSettingsExist(false);
        }
      } catch (err) {
        console.error('Error loading Obsidian settings:', err);
        setError('設定の読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    
    // PDFのURLを取得
    const fetchPdfUrl = async () => {
      if (paper && paper.file_path) {
        try {
          const url = await getPaperPdfUrl(paper);
          setPdfUrl(url);
        } catch (err) {
          console.error('Error fetching PDF URL:', err);
        }
      }
    };
    
    if (dialogOpen) {
      loadSettings();
      fetchPdfUrl();
    }
  }, [user, dialogOpen, paper]);
  
  // Obsidianへのエクスポート処理
  const handleExport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 1. PDFファイルのダウンロード（オプション）
      let pdfFileName = '';
      if (includePdf && pdfUrl) {
        // PDFの名前を設定
        pdfFileName = `${fileName}.pdf`;
        
        try {
          // PDFのダウンロード
          const response = await fetch(pdfUrl);
          const blob = await response.blob();
          const pdfDownloadUrl = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = pdfDownloadUrl;
          a.download = pdfFileName;
          document.body.appendChild(a);
          a.click();
          URL.revokeObjectURL(pdfDownloadUrl);
          document.body.removeChild(a);
        } catch (err) {
          console.error('Error downloading PDF:', err);
          setError('PDFのダウンロードに失敗しました');
          setIsLoading(false);
          return;
        }
      }
      
      // 2. Markdown生成
      const markdown = MarkdownExporter.generateObsidianMarkdown(
        paper, 
        translatedChapters,
        includePdf ? pdfFileName : undefined
      );
      
      // 3. マークダウンファイルのダウンロード
      const extension = fileType === 'md' ? '.md' : '.txt';
      const fullFileName = fileName.endsWith(extension) ? fileName : fileName + extension;
      
      const blob = new Blob([markdown], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fullFileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // 4. Obsidianで開く（設定されている場合）
      if (openAfterExport && vaultName) {
        // フォルダパスがある場合は結合
        let filePath = fullFileName;
        if (folderPath) {
          filePath = `${folderPath}/${fullFileName}`;
        }
        
        setTimeout(() => {
          openInObsidian(vaultName, filePath);
        }, 500);
      }
      
      // 成功メッセージを表示
      setSuccess(true);
      
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
              label="保存先フォルダパス（省略可）"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              fullWidth
              margin="normal"
              disabled={isLoading}
              helperText="例: Papers/AI 省略した場合はvaultのルートに保存されます"
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
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={includePdf}
                  onChange={(e) => setIncludePdf(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label="原文PDFも埋め込む"
            />
            
            {includePdf && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createEmbedFolder}
                    onChange={(e) => setCreateEmbedFolder(e.target.checked)}
                    disabled={isLoading}
                  />
                }
                label="埋め込み書類フォルダを作成"
              />
            )}
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={openAfterExport}
                  onChange={(e) => setOpenAfterExport(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label="エクスポート後にObsidianで開く"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel id="file-type-label">ファイル形式</InputLabel>
              <Select
                labelId="file-type-label"
                value={fileType}
                onChange={(e) => setFileType(e.target.value as 'md' | 'txt')}
                disabled={isLoading}
                label="ファイル形式"
              >
                <MenuItem value="md">
                  <ListItemText 
                    primary="Markdown (.md)" 
                    secondary="Obsidianの全機能が使えます"
                  />
                </MenuItem>
                <MenuItem value="txt">
                  <ListItemText 
                    primary="プレーンテキスト (.txt)" 
                    secondary="Obsidianの検索機能を使うときに便利です"
                  />
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            エクスポートすると、翻訳されたテキストとメタデータがダウンロードされ、ローカルのObsidianに保存することができます。
            PDFの埋め込みを選択した場合は、PDFもダウンロードされ、設定に応じて埋め込み書類フォルダに保存するよう案内されます。
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