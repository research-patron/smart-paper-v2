// ~/Desktop/smart-paper-v2/frontend/src/pages/LegalPages/TermsPage.tsx
import { Container, Typography, Box, Paper, Divider, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

const TermsPage = () => {
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
            利用規約
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom color="text.secondary">
            最終更新日: 2023年12月1日
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第1条（適用）
          </Typography>
          <Typography paragraph>
            1. 本規約は、Smart Paper v2（以下「本サービス」といいます）の利用条件を定めるものです。
          </Typography>
          <Typography paragraph>
            2. ユーザーは、本規約に同意の上、本サービスを利用するものとします。
          </Typography>
          <Typography paragraph>
            3. ユーザーが本サービスを利用した時点で、本規約に同意したものとみなします。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第2条（ユーザー登録）
          </Typography>
          <Typography paragraph>
            1. 本サービスの利用を希望する者は、本規約に同意の上、当社の定める方法によりユーザー登録を行うものとします。
          </Typography>
          <Typography paragraph>
            2. 当社は、当社の基準によりユーザー登録の可否を判断し、登録を認める場合にはその旨を通知します。
          </Typography>
          <Typography paragraph>
            3. 当社は、以下の場合にユーザー登録を拒否することがあります。
            <br/>（1）虚偽の情報を提供した場合
            <br/>（2）過去に本規約に違反したことがある場合
            <br/>（3）その他当社が不適切と判断した場合
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第3条（アカウント管理）
          </Typography>
          <Typography paragraph>
            1. ユーザーは、自己の責任においてアカウント情報を管理するものとします。
          </Typography>
          <Typography paragraph>
            2. ユーザーは、いかなる場合にも、アカウント情報を第三者に譲渡または貸与することはできません。
          </Typography>
          <Typography paragraph>
            3. 当社は、ログイン情報の一致をもってユーザー本人による利用とみなし、不正利用により生じた損害について一切の責任を負いません。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第4条（利用料金）
          </Typography>
          <Typography paragraph>
            1. 本サービスの利用料金は、当社が別途定めるとおりとします。
          </Typography>
          <Typography paragraph>
            2. ユーザーは、利用料金を当社が指定する方法で支払うものとします。
          </Typography>
          <Typography paragraph>
            3. 支払い済みの利用料金は、当社に帰責事由がある場合を除き、返金されません。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第5条（禁止事項）
          </Typography>
          <Typography paragraph>
            ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
          </Typography>
          <Typography paragraph>
            1. 法令または公序良俗に違反する行為
          </Typography>
          <Typography paragraph>
            2. 犯罪行為に関連する行為
          </Typography>
          <Typography paragraph>
            3. 当社または第三者の知的財産権、プライバシー、名誉、その他の権利または利益を侵害する行為
          </Typography>
          <Typography paragraph>
            4. 本サービスのサーバーやネットワークシステムに過度の負荷をかける行為
          </Typography>
          <Typography paragraph>
            5. 本サービスの運営を妨害する行為
          </Typography>
          <Typography paragraph>
            6. 不正アクセスをし、またはこれを試みる行為
          </Typography>
          <Typography paragraph>
            7. 他のユーザーに関する個人情報等を収集または蓄積する行為
          </Typography>
          <Typography paragraph>
            8. 他のユーザーに成りすます行為
          </Typography>
          <Typography paragraph>
            9. 当社が許諾しない本サービス上での宣伝、広告、勧誘、または営業行為
          </Typography>
          <Typography paragraph>
            10. その他、当社が不適切と判断する行為
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第6条（サービスの停止等）
          </Typography>
          <Typography paragraph>
            1. 当社は、以下の場合には、事前の通知なく、本サービスの全部または一部の提供を停止または中断することができます。
            <br/>（1）本サービスにかかるシステムの保守点検または更新を行う場合
            <br/>（2）地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合
            <br/>（3）その他、当社が本サービスの提供が困難と判断した場合
          </Typography>
          <Typography paragraph>
            2. 当社は、本サービスの提供の停止または中断により、ユーザーまたは第三者が被ったいかなる不利益または損害について、理由を問わず一切の責任を負わないものとします。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第7条（著作権）
          </Typography>
          <Typography paragraph>
            1. ユーザーは、自ら著作権等の必要な知的財産権を有するか、または必要な権利者の許諾を得た文章、画像等のコンテンツに関してのみ、本サービスを利用することができるものとします。
          </Typography>
          <Typography paragraph>
            2. ユーザーが本サービスを利用して投稿・表示した文章、画像等のコンテンツの著作権については、当該ユーザーその他既存の権利者に留保されるものとします。
          </Typography>
          <Typography paragraph>
            3. 当社は、ユーザーが本サービスを利用して投稿・表示した文章、画像等のコンテンツを、本サービスの提供目的の範囲内で利用できるものとします。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第8条（免責事項）
          </Typography>
          <Typography paragraph>
            1. 当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを明示的にも黙示的にも保証しておりません。
          </Typography>
          <Typography paragraph>
            2. 当社は、本サービスによってユーザーに生じたあらゆる損害について一切の責任を負いません。ただし、本サービスに関する当社とユーザーとの間の契約（本規約を含みます）が消費者契約法に定める消費者契約となる場合、この免責規定は適用されません。
          </Typography>
          <Typography paragraph>
            3. 前項ただし書に定める場合であっても、当社は、当社の過失（重過失を除きます）による債務不履行または不法行為によりユーザーに生じた損害のうち特別な事情から生じた損害（当社またはユーザーが損害発生につき予見し、または予見し得た場合を含みます）について一切の責任を負いません。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第9条（サービス内容の変更等）
          </Typography>
          <Typography paragraph>
            当社は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第10条（利用規約の変更）
          </Typography>
          <Typography paragraph>
            1. 当社は、必要と判断した場合には、ユーザーに通知することなく本規約を変更することができるものとします。
          </Typography>
          <Typography paragraph>
            2. 当社が別途定める場合を除いて、変更後の利用規約は、本ウェブサイトに掲載したときから効力を生じるものとします。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第11条（通知または連絡）
          </Typography>
          <Typography paragraph>
            ユーザーと当社との間の通知または連絡は、当社の定める方法によって行うものとします。当社は、ユーザーから、当社が別途定める方式に従った変更届け出がない限り、現在登録されている連絡先が有効なものとみなして当該連絡先へ通知または連絡を行い、これらは、発信時にユーザーへ到達したものとみなします。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第12条（権利義務の譲渡の禁止）
          </Typography>
          <Typography paragraph>
            ユーザーは、当社の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し、または担保に供することはできません。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            第13条（準拠法・裁判管轄）
          </Typography>
          <Typography paragraph>
            1. 本規約の解釈にあたっては、日本法を準拠法とします。
          </Typography>
          <Typography paragraph>
            2. 本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default TermsPage;