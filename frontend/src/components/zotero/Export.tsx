import { useState, useEffect } from 'react';
import {
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  AlertTitle,
  CircularProgress,
  Link,
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import HelpIcon from '@mui/icons-material/Help';
import DownloadIcon from '@mui/icons-material/Download';
import { Paper } from '../../api/papers';
import { 
  addToZoteroByDOI, 
  isValidDOI, 
  checkZoteroConnector,
  getZoteroConnectorDownloadLink,
  isZoteroRunning,
  ZOTERO_ITEM_TYPES
} from '../../api/zotero';

interface ZoteroExportProps {
  paper: Paper;
  disabled?: boolean;
}

const ZoteroExport: React.FC<ZoteroExportProps> = ({ paper, disabled = false }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isConnectorAvailable, setIsConnectorAvailable] = useState<boolean | null>(null);
  const [isZoteroAppRunning, setIsZoteroAppRunning] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState('journalArticle');
  
  // DOIの有無を確認
  const hasDOI = paper.metadata?.doi && isValidDOI(paper.metadata.doi);
  
  // ダイアログが開かれたときにZotero Connectorの存在を確認
  useEffect(() => {
    if (dialogOpen) {
      checkConnector();
    }
  }, [dialogOpen]);
  
  // Zotero Connectorの存在とZoteroアプリケーションの起動状態を確認
  const checkConnector = async () => {
    setIsChecking(true);
    try {
      // Zotero Connectorの存在を確認
      const connectorResult = await checkZoteroConnector();
      setIsConnectorAvailable(connectorResult);
      
      // Zoteroアプリケーションの起動状態を確認
      const zoteroRunningResult = await isZoteroRunning();
      setIsZoteroAppRunning(zoteroRunningResult);
      
      console.log('Zotero Connector available:', connectorResult);
      console.log('Zotero application running:', zoteroRunningResult);
    } catch (error) {
      console.error('Error checking Zotero status:', error);
      setIsConnectorAvailable(false);
      setIsZoteroAppRunning(false);
    } finally {
      setIsChecking(false);
    }
  };
  
  // Zoteroにエクスポート
  const handleExport = async () => {
    if (!paper.metadata?.doi || !isValidDOI(paper.metadata.doi)) {
      setError('有効なDOIがありません。手動でZoteroに追加してください。');
      return;
    }
    
    setIsExporting(true);
    setError(null);
    
    try {
      // DOIを使用してZoteroに追加
      const result = await addToZoteroByDOI(paper.metadata.doi);
      
      if (result) {
        // 成功した場合はダイアログを閉じる
        setTimeout(() => {
          setDialogOpen(false);
        }, 1000);
      } else {
        setError('Zoteroへの追加に失敗しました。Zotero Connectorが利用可能か確認してください。');
      }
    } catch (error) {
      console.error('Error exporting to Zotero:', error);
      setError('エクスポート中にエラーが発生しました。');
    } finally {
      setIsExporting(false);
    }
  };
  
  // 手動コピー用のCitationTextを生成
  const generateCitationText = (): string => {
    if (!paper.metadata) return '';
    
    const { metadata } = paper;
    const authors = metadata.authors?.map(a => a.name).join(', ') || 'Unknown';
    const title = metadata.title || 'Untitled';
    const journal = metadata.journal || '';
    const year = metadata.year || '';
    const doi = metadata.doi || '';
    
    return `${authors} (${year}). ${title}. ${journal}. DOI: ${doi}`;
  };
  
  return (
    <>
      <Button
        variant="outlined"
        color="secondary"
        startIcon={<LibraryBooksIcon />}
        onClick={() => setDialogOpen(true)}
        disabled={disabled || !paper.metadata}
        size="small"
      >
        Zoteroに追加
      </Button>
      
      <Dialog 
        open={dialogOpen} 
        onClose={() => !isExporting && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Zoteroに論文を追加</DialogTitle>
        
        <DialogContent>
          {isChecking ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress />
            </Box>
          ) : !isConnectorAvailable ? (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <AlertTitle>Zotero Connectorが見つかりません</AlertTitle>
              <Typography variant="body2" paragraph>
                Zotero ConnectorはブラウザからZoteroに論文を簡単に追加するためのブラウザ拡張機能です。
                {isZoteroAppRunning === false && 
                  "Zoteroアプリケーションが起動していないようです。まずZoteroアプリケーションを起動してください。"}
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  トラブルシューティング手順:
                </Typography>
                <ol>
                  <li>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Zoteroアプリケーションが<strong>インストール済み</strong>で<strong>起動している</strong>ことを確認してください。
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Zotero Connectorがブラウザに<strong>インストール済み</strong>であることを確認してください。
                      {isZoteroAppRunning === true && 
                        "Zoteroアプリケーションは起動していますが、Connectorが検出されません。ブラウザの拡張機能を確認してください。"}
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      ブラウザを<strong>再起動</strong>してから再試行してください。
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2">
                      それでも問題が解決しない場合は、Zoteroアプリケーションを<strong>再起動</strong>してください。
                    </Typography>
                  </li>
                </ol>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  href={getZoteroConnectorDownloadLink()}
                  target="_blank"
                  onClick={(e) => {
                    // 既にインストール済みの場合は拡張機能ページに移動するように提案
                    if (navigator.userAgent.indexOf('Chrome') > -1 || navigator.userAgent.indexOf('Edg') > -1) {
                      if (window.confirm('Zotero Connectorがインストール済みの場合は、拡張機能を有効化する必要があるかもしれません。\n\nChromeの拡張機能ページを開きますか？')) {
                        window.open('chrome://extensions/?id=ekhagklcjbdpajgpjgmbionohlpdbjgc', '_blank');
                        e.preventDefault();
                      }
                    }
                  }}
                >
                  Zotero Connectorを確認・ダウンロード
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setIsChecking(true);
                    // 再検査を行い、1秒後に結果を更新
                    checkConnector();
                  }}
                  disabled={isChecking}
                >
                  {isChecking ? "確認中..." : "再検査"}
                </Button>
              </Box>
            </Alert>
          ) : !hasDOI ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>DOIが見つかりません</AlertTitle>
              <Typography variant="body2" paragraph>
                この論文にはDOI（Digital Object Identifier）が見つかりませんでした。
                DOIがない場合、Zoteroに自動で追加することができません。
                以下の情報をコピーして手動でZoteroに追加してください。
              </Typography>
            </Alert>
          ) : null}
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ my: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              論文情報
            </Typography>
            
            <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>タイトル:</strong> {paper.metadata?.title || '不明'}
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>著者:</strong> {paper.metadata?.authors?.map(a => a.name).join(', ') || '不明'}
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>ジャーナル:</strong> {paper.metadata?.journal || '不明'}
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>出版年:</strong> {paper.metadata?.year || '不明'}
              </Typography>
              <Typography variant="body2">
                <strong>DOI:</strong> {paper.metadata?.doi || '不明'}
                {paper.metadata?.doi && isValidDOI(paper.metadata.doi) && (
                  <Tooltip title="DOIリンクを開く">
                    <Link
                      href={`https://doi.org/${paper.metadata.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ ml: 1, verticalAlign: 'middle' }}
                    >
                      <HelpIcon fontSize="small" />
                    </Link>
                  </Tooltip>
                )}
              </Typography>
            </Box>
            
            {isConnectorAvailable && hasDOI && (
              <FormControl fullWidth margin="normal">
                <InputLabel id="item-type-label">アイテムタイプ</InputLabel>
                <Select
                  labelId="item-type-label"
                  value={selectedItemType}
                  onChange={(e) => setSelectedItemType(e.target.value)}
                  label="アイテムタイプ"
                  disabled={isExporting}
                >
                  {ZOTERO_ITEM_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {/* 常に手動コピーオプションを表示（DOIの有無に関わらず） */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                手動コピー用テキスト
              </Typography>
              <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {generateCitationText()}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {!hasDOI ? 
                  "このテキストをコピーして、Zoteroに手動で追加してください。" : 
                  "Connectorが動作しない場合は、このテキストをコピーして手動で追加できます。"
                }
              </Typography>
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="text.secondary">
            {!isConnectorAvailable 
              ? isZoteroAppRunning === false
                ? 'Zotero Connectorが見つからず、Zoteroアプリケーションも起動していないようです。まずZoteroアプリケーションを起動し、必要に応じてConnectorをインストールしてください。'
                : isZoteroAppRunning === true
                  ? 'Zoteroアプリケーションは起動していますが、Zotero Connectorが見つかりません。ブラウザの拡張機能を確認してください。'
                  : 'Zotero Connectorが見つかりません。Zoteroをインストールして起動した後、上記の情報をコピーして手動で追加できます。'
              : hasDOI
                ? 'DOIを使用して論文をZoteroに追加します。「Zoteroに追加」ボタンをクリックすると、Zotero Connectorが起動します。Connectorが動作しない場合は、上記の情報をコピーして手動で追加できます。'
                : 'DOIがない場合、手動でZoteroに追加してください。上記の情報をコピーして、Zoteroの「新規アイテム」から追加できます。'}
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setDialogOpen(false)} 
            disabled={isExporting}
          >
            キャンセル
          </Button>
          {hasDOI && isConnectorAvailable && (
            <Button 
              onClick={handleExport} 
              variant="contained" 
              color="primary"
              disabled={isExporting || !hasDOI || !isConnectorAvailable}
            >
              {isExporting ? <CircularProgress size={24} /> : "Zoteroに追加"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ZoteroExport;
