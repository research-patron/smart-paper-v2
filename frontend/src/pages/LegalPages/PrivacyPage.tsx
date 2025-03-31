// ~/Desktop/smart-paper-v2/frontend/src/pages/LegalPages/PrivacyPage.tsx
import { Container, Typography, Box, Paper, Divider, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

const PrivacyPage = () => {
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
            プライバシーポリシー
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom color="text.secondary">
            最終更新日: 2023年12月1日
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography paragraph>
            Smart Paper v2（以下「当社」といいます）は、本サービスにおける個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            1. 個人情報の定義
          </Typography>
          <Typography paragraph>
            本ポリシーにおいて、個人情報とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報及び容貌、指紋、声紋にかかるデータ、及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            2. 個人情報の収集方法
          </Typography>
          <Typography paragraph>
            当社は、ユーザーが利用登録をする際に氏名、メールアドレスなどの個人情報をお尋ねすることがあります。また、ユーザーと提携先などとの間でなされた取引に関する情報を当社の提携先などから収集することがあります。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            3. 個人情報を収集・利用する目的
          </Typography>
          <Typography paragraph>
            当社が個人情報を収集・利用する目的は、以下のとおりです。
          </Typography>
          <Typography component="div" paragraph>
            <ol>
              <li>当社サービスの提供・運営のため</li>
              <li>ユーザーからのお問い合わせに回答するため</li>
              <li>ユーザーに有益と思われる情報を提供するため</li>
              <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
              <li>利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため</li>
              <li>ユーザーにご自身の登録情報の閲覧や変更、削除、ご利用状況の閲覧を行っていただくため</li>
              <li>上記の利用目的に付随する目的</li>
            </ol>
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            4. 個人情報の第三者提供
          </Typography>
          <Typography paragraph>
            当社は、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。ただし、個人情報保護法その他の法令で認められる場合を除きます。
          </Typography>
          <Typography component="div" paragraph>
            <ol>
              <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
              <li>予め次の事項を告知あるいは公表し、かつ当社が個人情報保護委員会に届出をしたとき
                <ol>
                  <li>利用目的に第三者への提供を含むこと</li>
                  <li>第三者に提供されるデータの項目</li>
                  <li>第三者への提供の手段または方法</li>
                  <li>本人の求めに応じて個人情報の第三者への提供を停止すること</li>
                  <li>本人の求めを受け付ける方法</li>
                </ol>
              </li>
            </ol>
          </Typography>
          <Typography paragraph>
            前項の定めにかかわらず、次に掲げる場合には、当該情報の提供先は第三者に該当しないものとします。
          </Typography>
          <Typography component="div" paragraph>
            <ol>
              <li>当社が利用目的の達成に必要な範囲内において個人情報の取扱いの全部または一部を委託する場合</li>
              <li>合併その他の事由による事業の承継に伴って個人情報が提供される場合</li>
              <li>個人情報を特定の者との間で共同して利用する場合であって、その旨並びに共同して利用される個人情報の項目、共同して利用する者の範囲、利用する者の利用目的および当該個人情報の管理について責任を有する者の氏名または名称について、あらかじめ本人に通知し、または本人が容易に知り得る状態に置いた場合</li>
            </ol>
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            5. 個人情報の開示
          </Typography>
          <Typography paragraph>
            当社は、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、開示しない決定をした場合には、その旨を遅滞なく通知します。
          </Typography>
          <Typography component="div" paragraph>
            <ol>
              <li>本人または第三者の生命、身体、財産その他の権利利益を害するおそれがある場合</li>
              <li>当社の業務の適正な実施に著しい支障を及ぼすおそれがある場合</li>
              <li>その他法令に違反することとなる場合</li>
            </ol>
          </Typography>
          <Typography paragraph>
            前項の定めにかかわらず、履歴情報および特性情報などの個人情報以外の情報については、原則として開示いたしません。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            6. 個人情報の訂正および削除
          </Typography>
          <Typography paragraph>
            ユーザーは、当社の保有する自己の個人情報が誤った情報である場合には、当社が定める手続きにより、当社に対して個人情報の訂正、追加または削除（以下、「訂正等」といいます。）を請求することができます。
          </Typography>
          <Typography paragraph>
            当社は、ユーザーから前項の請求を受けてその請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の訂正等を行うものとします。
          </Typography>
          <Typography paragraph>
            当社は、前項の規定に基づき訂正等を行った場合、または訂正等を行わない旨の決定をしたときは、遅滞なく、これをユーザーに通知します。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            7. 個人情報の利用停止等
          </Typography>
          <Typography paragraph>
            当社は、本人から、個人情報が、利用目的の範囲を超えて取り扱われているという理由、または不正の手段により取得されたものであるという理由により、その利用の停止または消去（以下、「利用停止等」といいます。）を求められた場合には、遅滞なく必要な調査を行います。
          </Typography>
          <Typography paragraph>
            前項の調査結果に基づき、その請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の利用停止等を行います。
          </Typography>
          <Typography paragraph>
            当社は、前項の規定に基づき利用停止等を行った場合、または利用停止等を行わない旨の決定をしたときは、遅滞なく、これをユーザーに通知します。
          </Typography>
          <Typography paragraph>
            前2項にかかわらず、利用停止等に多額の費用を有する場合その他利用停止等を行うことが困難な場合であって、ユーザーの権利利益を保護するために必要なこれに代わるべき措置をとれる場合は、この代替策を講じるものとします。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            8. プライバシーポリシーの変更
          </Typography>
          <Typography paragraph>
            本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。
          </Typography>
          <Typography paragraph>
            当社が別途定める場合を除いて、変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
          </Typography>
          
          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            9. お問い合わせ窓口
          </Typography>
          <Typography paragraph>
            本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。
          </Typography>
          <Typography paragraph>
            担当部署：Smart Paper v2運営事務局<br />
            Eメールアドレス：	smart-paper-v2@student-subscription.com
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default PrivacyPage;