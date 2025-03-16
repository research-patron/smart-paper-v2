import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  AlertTitle,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  IconButton,
  Link,
  Divider,
  Grid,
  Chip,
  Switch
} from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuthStore } from '../../store/authStore';
import { selectObsidianVault } from '../../api/obsidian';

interface ObsidianSettingsProps {
  onSaved?: () => void;
}

const ObsidianSettings: React.FC<ObsidianSettingsProps> = ({ onSaved }) => {
  const { user } = useAuthStore();
  
  // 設定値の状態管理
  const [vaultDir, setVaultDir] = useState('');
  const [vaultName, setVaultName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [fileNameFormat, setFileNameFormat] = useState('{authors}_{title}_{year}');
  const [fileType, setFileType] = useState<'md' | 'txt'>('md');
  const [openAfterExport, setOpenAfterExport] = useState(true);
  const [includePdf, setIncludePdf] = useState(true);
  const [createEmbedFolder, setCreateEmbedFolder] = useState(true);
  
  // UI状態の管理
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isObsidianInstalled = true; // デフォルトで連携可能とする
  
  // プリセットのファイル名フォーマット
  const fileNameFormatPresets = [
    { label: "著者_タイトル_年", value: "{authors}_{title}_{year}" },
    { label: "著者_ジャーナル_年", value: "{authors}_{journal}_{year}" },
    { label: "タイトル (著者, 年)", value: "{title} ({authors}, {year})" },
    { label: "日付_タイトル", value: "{date}_{title}" },
    { label: "カスタム", value: "custom" }
  ];
  
  const [selectedPreset, setSelectedPreset] = useState(fileNameFormatPresets[0].value);
  
  // Obsidianのインストール確認
  
  // ユーザーの既存設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Firestoreからユーザーの設定を取得
        const settingsRef = doc(db, `users/${user.uid}/obsidian_settings/default`);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setVaultDir(data.vault_dir || '');
          setVaultName(data.vault_name || '');
          setFolderPath(data.folder_path || '');
          setFileNameFormat(data.file_name_format || '{authors}_{title}_{year}');
          setFileType(data.file_type || 'md');
          setOpenAfterExport(data.open_after_export !== false);
          setIncludePdf(data.include_pdf !== false);
          setCreateEmbedFolder(data.create_embed_folder !== false);
          
          // プリセットの選択を更新
          const matchingPreset = fileNameFormatPresets.find(p => p.value === data.file_name_format);
          setSelectedPreset(matchingPreset ? matchingPreset.value : 'custom');
        }
      } catch (err) {
        console.error('Error loading Obsidian settings:', err);
        setError('設定の読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, [user]);
  
  // フォルダ選択ハンドラー
  const handleSelectVault = async () => {
    try {
      const result = await selectObsidianVault();
      if (result) {
        setVaultDir(result.dirPath);
        setVaultName(result.vaultName);
      }
    } catch (err) {
      console.error('Error selecting Obsidian vault:', err);
      setError('Obsidian vaultの選択に失敗しました。');
    }
  };
  
  // 設定を保存
  const handleSave = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const settingsData = {
        vault_dir: vaultDir,
        vault_name: vaultName,
        folder_path: folderPath,
        file_name_format: fileNameFormat,
        file_type: fileType,
        open_after_export: openAfterExport,
        include_pdf: includePdf,
        create_embed_folder: createEmbedFolder,
        updated_at: Timestamp.now()
      };
      
      // Firestoreに設定を保存
      const settingsRef = doc(db, `users/${user.uid}/obsidian_settings/default`);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        // 既存の設定を更新
        await updateDoc(settingsRef, settingsData);
      } else {
        // 新規設定を作成
        await setDoc(settingsRef, {
          ...settingsData,
          created_at: Timestamp.now()
        });
      }
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      
      // 保存完了後のコールバックを呼び出す
      if (onSaved) onSaved();
      
    } catch (err) {
      console.error('Error saving Obsidian settings:', err);
      setError('設定の保存に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };
  
  // プリセット選択時の処理
  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      setFileNameFormat(preset);
    }
  };
  
  // Obsidianの連携状態を判定
  const isVaultLinked = vaultDir !== '' && vaultName !== '';
  
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" component="h2">
          Obsidian 連携設定
        </Typography>
        
        {isVaultLinked ? (
          <Chip
            icon={<CheckCircleIcon />}
            label="Obsidianが連携済み"
            color="success"
            variant="outlined"
          />
        ) : isObsidianInstalled ? (
          <Chip
            icon={<ErrorIcon />}
            label="Obsidianが連携されていません"
            color="warning"
            variant="outlined"
          />
        ) : null}
      </Box>
      
      {!isObsidianInstalled && !isVaultLinked && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Obsidianがインストールされていないようです</AlertTitle>
          <Typography variant="body2">
            Obsidianはノートを管理するためのアプリケーションです。インストールすると、論文の翻訳結果をワンクリックでObsidianに保存できます。
          </Typography>
          <Link href="https://obsidian.md/" target="_blank" rel="noopener noreferrer">
            Obsidianをダウンロード
          </Link>
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {isSaved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          設定を保存しました
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={handleSelectVault}
              disabled={isLoading}
              sx={{ minWidth: 200 }}
            >
              Vault フォルダを選択
            </Button>
            {vaultName && (
              <Typography variant="body2" color="text.secondary">
                選択中: {vaultName}
              </Typography>
            )}
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel id="file-name-format-preset-label">ファイル名フォーマットのプリセット</InputLabel>
            <Select
              labelId="file-name-format-preset-label"
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              label="ファイル名フォーマットのプリセット"
              disabled={isLoading}
            >
              {fileNameFormatPresets.map((preset) => (
                <MenuItem key={preset.value} value={preset.value}>
                  {preset.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <FormControl component="fieldset">
            <FormLabel component="legend">ファイル形式</FormLabel>
            <RadioGroup
              row
              value={fileType}
              onChange={(e) => setFileType(e.target.value as 'md' | 'txt')}
            >
              <FormControlLabel 
                value="md" 
                control={<Radio />} 
                label="Markdown (.md)" 
                disabled={isLoading} 
              />
              <FormControlLabel 
                value="txt" 
                control={<Radio />} 
                label="プレーンテキスト (.txt)" 
                disabled={isLoading} 
              />
            </RadioGroup>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            詳細設定
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={openAfterExport}
                onChange={(e) => setOpenAfterExport(e.target.checked)}
                disabled={isLoading}
              />
            }
            label="エクスポート後にObsidianで開く"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={includePdf}
                onChange={(e) => setIncludePdf(e.target.checked)}
                disabled={isLoading}
              />
            }
            label="原文PDFも埋め込む"
          />
          
          {includePdf && (
            <Box sx={{ ml: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={createEmbedFolder}
                    onChange={(e) => setCreateEmbedFolder(e.target.checked)}
                    disabled={isLoading || !includePdf}
                  />
                }
                label="埋め込み書類フォルダを作成"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                オンにすると、PDFは「埋め込み書類」フォルダに保存され、Markdownからリンクされます
              </Typography>
            </Box>
          )}
        </Grid>
        
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={isLoading || !vaultName}
            >
              設定を保存
            </Button>
          </Box>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
          Obsidianについて
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Obsidianは、エレガントで強力なナレッジベースアプリです。ローカルにMarkdownファイルを保存し、ノート間のリンクを作成できます。
          翻訳された論文をObsidianに保存することで、他のノートからリンクしたり、タグ付けしたり、検索したりすることができます。
        </Typography>
      </Box>
    </Paper>
  );
};

export default ObsidianSettings;
