// ~/Desktop/smart-paper-v2/frontend/src/pages/LegalPages/CommercePage.tsx
import { Container, Typography, Box, Paper, Divider, Button, Table, TableBody, TableCell, TableContainer, TableRow } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

const CommercePage = () => {
  const navigate = useNavigate();
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          戻る
        </Button>
        
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            特定商取引法に基づく表記
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom color="text.secondary">
            最終更新日: 2023年12月1日
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography paragraph>
            「特定商取引に関する法律」第11条に基づき、以下のとおり表示いたします。
          </Typography>
          
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 3 }}>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ width: '30%', bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">事業者の名称</Typography>
                  </TableCell>
                  <TableCell>
                    Smart Paper v2運営事務局
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">代表者名</Typography>
                  </TableCell>
                  <TableCell>
                    山田 太郎
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">所在地</Typography>
                  </TableCell>
                  <TableCell>
                    〒XXX-XXXX<br />
                    東京都○○区△△X-X-X
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">電話番号</Typography>
                  </TableCell>
                  <TableCell>
                    03-XXXX-XXXX<br />
                    （受付時間: 平日10:00〜18:00）
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">メールアドレス</Typography>
                  </TableCell>
                  <TableCell>
                    support@smartpaper-v2.example.com
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">URL</Typography>
                  </TableCell>
                  <TableCell>
                    https://smartpaper-v2.example.com/
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">サービス名</Typography>
                  </TableCell>
                  <TableCell>
                    Smart Paper v2
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">料金</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      月額プラン: 300円（税込）/月<br />
                      年額プラン: 3,000円（税込）/年
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">商品代金以外の必要料金</Typography>
                  </TableCell>
                  <TableCell>
                    なし
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">支払方法</Typography>
                  </TableCell>
                  <TableCell>
                    クレジットカード決済（VISA、Mastercard、JCB、American Express、Diners Club）
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">支払時期</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      月額プラン: 申込時および契約更新時に課金<br />
                      年額プラン: 申込時および契約更新時に課金
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">サービス提供時期</Typography>
                  </TableCell>
                  <TableCell>
                    お支払い完了後、ただちにご利用いただけます。
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">返品・キャンセルについて</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      本サービスは、デジタルコンテンツの性質上、申込み完了後の返品・キャンセルはできません。<br />
                      なお、サブスクリプションは各マイページから更新の停止（解約）が可能です。解約後も期間満了までサービスをご利用いただけます。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" scope="row" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">動作環境</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      ・対応ブラウザ: Google Chrome、Firefox、Safari、Microsoft Edge（最新版）<br />
                      ・対応OS: Windows 10以上、macOS 10.13以上、iOS 13以上、Android 9以上<br />
                      ・インターネット接続環境が必要です
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Container>
  );
};

export default CommercePage;