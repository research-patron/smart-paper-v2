import { useState, useEffect, useRef } from 'react';
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
  Switch,
  TextField
} from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuthStore } from '../../store/authStore';
import { selectObsidianVault, checkFolderExists, getVault } from '../../api/obsidian';

interface ObsidianSettingsProps {
  onSaved?: () => void;
}

const ObsidianSettings: React.FC<ObsidianSettingsProps> = ({ onSaved }) => {
  const { user } = useAuthStore();
  
  // 初期設定値の保持用のref
  const initialSettings = useRef<{
    vault_dir: string;
    vault_name: string;
    folder_path: string;
    file_name_format: string;
    file_type: 'md' | 'txt';
    open_after_export: boolean;
    include_pdf: boolean;
    create_embed_folder: boolean;
    auto_export: boolean;
  }>();
  
  // 設定値の状態管理
  const [vaultDir, setVaultDir] = useState('');
  const [vaultName, setVaultName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [fileNameFormat, setFileNameFormat] = useState('{authors}_{title}_{year}');
  const [fileType, setFileType] = useState<'md' | 'txt'>('md');
  const [openAfterExport, setOpenAfterExport] = useState(true);
  const [includePdf, setIncludePdf] = useState(true);
  const [createEmbedFolder, setCreateEmbedFolder] = useState(true);
  const [autoExport, setAutoExport] = useState(true);
  
  // UI状態の管理
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [settingsChanged, setSettingsChanged] = useState(false);
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
  const [customFormat, setCustomFormat] = useState('');
  
  // 設定値の変更を追跡
  useEffect(() => {
    if (!initialSettings.current) return;
    
    // 初期値と現在値を比較
    const isChanged = 
      vaultDir !== initialSettings.current.vault_dir ||
      vaultName !== initialSettings.current.vault_name ||
      folderPath !== initialSettings.current.folder_path ||
      fileNameFormat !== initialSettings.current.file_name_format ||
      fileType !== initialSettings.current.file_type ||
      openAfterExport !== initialSettings.current.open_after_export ||
      includePdf !== initialSettings.current.include_pdf ||
      createEmbedFolder !== initialSettings.current.create_embed_folder ||
      autoExport !== initialSettings.current.auto_export;
    
    setSettingsChanged(isChanged);
  }, [vaultDir, vaultName, folderPath, fileNameFormat, fileType, openAfterExport, includePdf, createEmbedFolder, autoExport]);
  
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
          
          // 初期値として保存
          initialSettings.current = {
            vault_dir: data.vault_dir || '',
            vault_name: data.vault_name || '',
            folder_path: data.folder_path || '',
            file_name_format: data.file_name_format || '{authors}_{title}_{year}',
            file_type: data.file_type || 'md',
            open_after_export: data.open_after_export !== false,
            include_pdf: data.include_pdf !== false,
            create_embed_folder: data.create_embed_folder !== false,
            auto_export: data.auto_export !== false
          };
          
          // 状態を更新
          setVaultDir(initialSettings.current.vault_dir);
          setVaultName(initialSettings.current.vault_name);
          setFolderPath(initialSettings.current.folder_path);
          setFileNameFormat(initialSettings.current.file_name_format);
          setFileType(initialSettings.current.file_type);
          setOpenAfterExport(initialSettings.current.open_after_export);
          setIncludePdf(initialSettings.current.include_pdf);
          setCreateEmbedFolder(initialSettings.current.create_embed_folder);
          setAutoExport(initialSettings.current.auto_export);
          
          // プリセットの選択を更新
          const matchingPreset = fileNameFormatPresets.find(p => p.value === data.file_name_format);
          if (matchingPreset) {
            setSelectedPreset(matchingPreset.value);
          } else {
            setSelectedPreset('custom');
            setCustomFormat(data.file_name_format);
          }
          
          // 設定値の読み込み後は変更フラグをリセット
          setSettingsChanged(false);
          
          // ローカルストレージにも保存
          localStorage.setItem('obsidian_settings', JSON.stringify({
            ...initialSettings.current,
            created_at: data.created_at?.toDate().toISOString(),
            updated_at: data.updated_at?.toDate().toISOString()
          }));
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
      
      // フォルダパスが指定されている場合の確認を厳密化
      if (folderPath.trim()) {
        const vaultHandle = await getVault();
        if (!vaultHandle) {
          throw new Error('Obsidian vaultが選択されていません');
        }
        
        // フォルダ存在確認
        const exists = await checkFolderExists(vaultHandle, folderPath);
        if (!exists) {
          throw new Error(`指定されたフォルダ「${folderPath}」がObsidian vault内に存在しません`);
        }
      }
      
      // カスタムフォーマットを使用する場合
      let finalFileNameFormat = fileNameFormat;
      if (selectedPreset === 'custom' && customFormat) {
        finalFileNameFormat = customFormat;
      }
      
      const settingsData = {
        vault_dir: vaultDir,
        vault_name: vaultName,
        folder_path: folderPath,
        file_name_format: finalFileNameFormat,
        file_type: fileType,
        open_after_export: openAfterExport,
        include_pdf: includePdf,
        create_embed_folder: createEmbedFolder,
        auto_export: autoExport,
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
      
      // 初期値を更新
      initialSettings.current = {
        vault_dir: vaultDir,
        vault_name: vaultName,
        folder_path: folderPath,
        file_name_format: finalFileNameFormat,
        file_type: fileType,
        open_after_export: openAfterExport,
        include_pdf: includePdf,
        create_embed_folder: createEmbedFolder,
        auto_export: autoExport
      };
      
      // 保存が成功したら変更フラグを更新
      setSettingsChanged(false);
      setIsSaved(true);
      
      // 保存成功メッセージは3秒後に非表示
      setTimeout(() => {
        setIsSaved(false);
      }, 3000);
      
      // 保存完了後のコールバックを呼び出す
      if (onSaved) onSaved();
      
    } catch (err) {
      console.error('Error saving Obsidian settings:', err);
      if (err instanceof Error) {
        setError(err.message || '設定の保存に失敗しました。');
      } else {
        setError('設定の保存に失敗しました。');
      }
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
  
  // カスタムフォーマット変更時の処理
  const handleCustomFormatChange = (format: string) => {
    setCustomFormat(format);
    if (selectedPreset === 'custom') {
      setFileNameFormat(format);
    }
  };
  
  // フォルダパス変更時の処理
  const handleFolderPathChange = (path: string) => {
    // 先頭のスラッシュを削除
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // 末尾のスラッシュを削除
    if (path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }
    
    setFolderPath(path);
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
      
      {settingsChanged && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>設定が変更されています</AlertTitle>
          <Typography variant="body2">
            設定を反映するには「設定を保存」ボタンを押してください。
          </Typography>
          {folderPath && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              注意: 指定したフォルダ名がObsidian vault内に存在することを確認してください。
            </Typography>
          )}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>自動保存機能について</AlertTitle>
        <Typography variant="body2">
          Obsidianと連携すると、論文の翻訳後に自動的にObsidianに保存されます。
          自動保存を有効にすることで、「Obsidianに保存」ボタンをクリックする必要がなくなります。
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>注意：</strong> ブラウザのセキュリティ制限により、ブラウザを再起動すると権限が失われます。
          その場合は、一度「Obsidianに保存」ボタンをクリックして権限を再付与する必要があります。
          その後の自動保存は同じブラウザセッション中であれば正常に機能します。
        </Typography>
      </Alert>
      
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
          <FormControl fullWidth margin="normal">
            <TextField
              label="保存先フォルダ名"
              value={folderPath}
              onChange={(e) => handleFolderPathChange(e.target.value)}
              placeholder="例: 研究ノート"
              helperText={
                <>
                  <Typography variant="caption" component="span">
                    論文を保存するVault内の既存フォルダを指定してください。フォルダ名を変更したら必ず「設定を保存」ボタンを押してください。
                  </Typography>
                  <br />
                  <Typography variant="caption" component="span" color="error">
                    注意: 指定したフォルダがObsidian vault内に存在しない場合、論文保存時にエラーになります。
                  </Typography>
                  <br />
                  <Typography variant="caption" component="span">
                    空の場合はVault直下に「smart-paper-v2」フォルダを自動作成します。
                  </Typography>
                </>
              }
              disabled={isLoading}
            />
          </FormControl>
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
        
        {selectedPreset === 'custom' && (
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <TextField
                label="カスタムフォーマット"
                value={customFormat}
                onChange={(e) => handleCustomFormatChange(e.target.value)}
                placeholder="{authors}_{title}_{year}"
                helperText="利用可能なプレースホルダー: {authors}, {title}, {year}, {journal}, {doi}, {date}"
                disabled={isLoading}
              />
            </FormControl>
          </Grid>
        )}
        
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            詳細設定
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={autoExport}
                onChange={(e) => setAutoExport(e.target.checked)}
                disabled={isLoading}
              />
            }
            label="翻訳完了後に自動的にObsidianに保存"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={openAfterExport}
                onChange={(e) => setOpenAfterExport(e.target.checked)}
                disabled={isLoading}
              />
            }
            label="保存後にObsidianで開く"
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
                オンにすると、PDFは「添付ファイル」フォルダに保存され、Markdownからリンクされます
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
              startIcon={<SaveIcon />}
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
