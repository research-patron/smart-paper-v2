// ~/Desktop/smart-paper-v2/frontend/src/pages/LegalPages/CommercePage.tsx
import React from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  Divider, 
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Link
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

const CommercePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          ホームに戻る
        </Button>
        
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            特定商取引法に基づく表記
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="body1" paragraph>
            このページは、特定商取引法（特定商取引に関する法律）に基づき、Smart Paper サービスの提供者に関する情報を開示するものです。
          </Typography>
          
          <TableContainer component={Paper} variant="outlined" sx={{ my: 4 }}>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell component="th" sx={{ width: '30%', bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">事業者の名称</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      Smart Paper サービス運営事務局
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">運営責任者</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      プライバシー保護のため、お問い合わせ時に開示いたします。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">所在地</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      プライバシー保護のため、お問い合わせ時に開示いたします。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">お問い合わせ先</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      メールアドレス: support@smart-paper.example.com<br />
                      サービス利用時の不具合報告フォーム: <Link href="https://github.com/your-repository/issues/new" target="_blank" rel="noopener noreferrer">GitHub Issues</Link>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ※お問い合わせには平日3営業日以内に対応いたします。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">販売価格</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      無料プラン: 0円<br />
                      月額プラン: 300円（税込）/月<br />
                      年額プラン: 3,000円（税込）/年
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ※表示価格はすべて消費税込みです。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">サービス内容</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      研究歴の浅い大学生や大学院生（特に工学、自然科学系）が、英語論文を読む際の障壁を下げ、論文整理の時間を短縮し、研究活動を効率化することを支援するサービス
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">お支払い方法</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      クレジットカード決済（Stripe決済）
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ※対応カードブランド: Visa, MasterCard, American Express, JCB, Diners Club, Discover
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">お支払い時期</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      月額プラン: 申込時に初月分をお支払いいただき、その後は毎月の契約更新日に自動決済されます。<br />
                      年額プラン: 申込時に1年分をお支払いいただき、その後は毎年の契約更新日に自動決済されます。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">サービス提供時期</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      お支払い完了後、即時にサービスをご利用いただけます。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">キャンセル・解約</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography paragraph>
                      アカウントページから、いつでもサブスクリプションを解約できます。解約後は現在の請求期間の終了まで引き続きサービスをご利用いただけます。
                    </Typography>
                    <Typography paragraph>
                      解約後、自動的に無料プランに切り替わります。解約手続き完了後の返金はいたしかねますのでご了承ください。
                    </Typography>
                    <Typography>
                      サービス初回利用から7日以内であれば、全額返金いたします。返金をご希望の場合は、上記メールアドレスまでご連絡ください。
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">動作環境</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      Google Chrome, Mozilla Firefox, Safari, Microsoft Edge（最新版およびメジャーバージョン1つ前まで）
                    </Typography>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">プライバシーポリシー</Typography>
                  </TableCell>
                  <TableCell>
                    <Link href="/privacy" onClick={(e) => {
                      e.preventDefault();
                      navigate('/privacy');
                    }}>
                      プライバシーポリシーはこちら
                    </Link>
                  </TableCell>
                </TableRow>
                
                <TableRow>
                  <TableCell component="th" sx={{ bgcolor: 'grey.100' }}>
                    <Typography variant="subtitle2">利用規約</Typography>
                  </TableCell>
                  <TableCell>
                    <Link href="/terms" onClick={(e) => {
                      e.preventDefault();
                      navigate('/terms');
                    }}>
                      利用規約はこちら
                    </Link>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              本ページの内容は、特定商取引法に基づき、オンライン上での取引における重要事項を表示しています。
              当サービスをご利用いただくことで、上記の内容に同意いただいたものとみなします。
            </Typography>
          </Box>
          
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/')}
            >
              ホームに戻る
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default CommercePage;