import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  AlertTitle,
  Link,
  Button,
  CircularProgress,
  Chip,
  Divider,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import { 
  checkZoteroConnector, 
  isZoteroConnectorInstalled,
  getZoteroConnectorDownloadLink,
  ZOTERO_ITEM_TYPES
} from '../../api/zotero';

const ZoteroSettings: React.FC = () => {
  const [isZoteroInstalled, setIsZoteroInstalled] = useState<boolean | null>(null);
  const [isConnectorAvailable, setIsConnectorAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [preferredItemType, setPreferredItemType] = useState('journalArticle');
  
  // Zoteroの存在を確認
  useEffect(() => {
    const checkZotero = async () => {
      setIsChecking(true);
      try {
        // Zotero ConnectorとZotero Desktopの存在を確認
        const connectorResult = await checkZoteroConnector();
        setIsConnectorAvailable(connectorResult);
        
        const installedResult = await isZoteroConnectorInstalled();
        setIsZoteroInstalled(installedResult);
      } catch (error) {
        console.error('Error checking Zotero:', error);
        setIsConnectorAvailable(false);
        setIsZoteroInstalled(false);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkZotero();
  }, []);
  
  // Zoteroの再チェック
  const handleRecheck = async () => {
    setIsChecking(true);
    try {
      const connectorResult = await checkZoteroConnector();
      setIsConnectorAvailable(connectorResult);
      
      const installedResult = await isZoteroConnectorInstalled();
      setIsZoteroInstalled(installedResult);
    } catch (error) {
      console.error('Error rechecking Zotero:', error);
      setIsConnectorAvailable(false);
      setIsZoteroInstalled(false);
    } finally {
      setIsChecking(false);
    }
  };
  
  // Zotero Connectorをダウンロード
  const handleDownloadConnector = () => {
    window.open(getZoteroConnectorDownloadLink(), '_blank');
  };
  
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" component="h2">
          Zotero 連携設定
        </Typography>
        
        {isChecking ? (
          <CircularProgress size={24} />
        ) : isConnectorAvailable ? (
          <Chip
            icon={<CheckCircleIcon />}
            label="Zotero Connectorが利用可能です"
            color="success"
            variant="outlined"
          />
        ) : (
          <Tooltip title="Zotero Connectorが見つかりません">
            <Chip
              icon={<ErrorIcon />}
              label="Zotero Connectorが見つかりません"
              color="warning"
              variant="outlined"
            />
          </Tooltip>
        )}
      </Box>
      
      {!isConnectorAvailable && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Zotero Connectorが見つかりません</AlertTitle>
          <Typography variant="body2" paragraph>
            Zotero ConnectorはブラウザからZoteroに論文を簡単に追加するためのブラウザ拡張機能です。
            Smart Paper v2では、Zotero Connectorを使用してDOI情報から論文をZoteroに追加します。
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadConnector}
          >
            Zotero Connectorをダウンロード
          </Button>
        </Alert>
      )}
      
      {!isZoteroInstalled && isConnectorAvailable && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Zotero Desktopのインストールを推奨します</AlertTitle>
          <Typography variant="body2" paragraph>
            Zotero ConnectorはZotero Desktopアプリケーションと連携して動作します。
            Zotero Desktopをインストールしていない場合、一部の機能が制限される場合があります。
          </Typography>
          <Link href="https://www.zotero.org/download/" target="_blank" rel="noopener noreferrer">
            Zotero Desktopをダウンロード
          </Link>
        </Alert>
      )}
      
      <Box sx={{ my: 3 }}>
        <FormControl component="fieldset">
          <FormLabel component="legend">デフォルトのアイテムタイプ</FormLabel>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            DOIから論文を追加する際のデフォルトのアイテムタイプを選択します。
          </Typography>
          <RadioGroup
            value={preferredItemType}
            onChange={(e) => setPreferredItemType(e.target.value)}
            sx={{ ml: 2 }}
          >
            {ZOTERO_ITEM_TYPES.slice(0, 5).map((type) => (
              <FormControlLabel 
                key={type.value} 
                value={type.value} 
                control={<Radio />} 
                label={type.label} 
              />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>
      
      <Divider sx={{ my: 3 }} />
      
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
          Zoteroについて
        </Typography>
        <Typography variant="body2" paragraph>
          Zoteroは、研究資料を収集、整理、引用、共有するための無料のオープンソースツールです。
          論文のメタデータを自動抽出し、引用スタイルに合わせて参考文献リストを生成できます。
        </Typography>
        
        <List dense>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="DOIから論文情報を自動取得" 
              secondary="Digital Object Identifier (DOI) を使って論文情報を自動的に取得します" 
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Smart Paper v2と連携" 
              secondary="翻訳した論文を簡単にZoteroライブラリに追加できます" 
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="CSL引用スタイル対応" 
              secondary="数千種類の引用スタイルをサポートし、論文執筆を効率化します" 
            />
          </ListItem>
        </List>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleRecheck}
            disabled={isChecking}
          >
            {isChecking ? <CircularProgress size={24} /> : "Zoteroを再チェック"}
          </Button>
          
          <Button
            variant="outlined"
            size="small"
            endIcon={<OpenInNewIcon />}
            href="https://www.zotero.org/"
            target="_blank"
          >
            Zotero公式サイト
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default ZoteroSettings;