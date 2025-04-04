// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/Payment.tsx
import { useState, memo, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  AlertTitle,
  CircularProgress,
  Paper,
  Divider,
  Modal,
  IconButton
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LockIcon from '@mui/icons-material/Lock';
import CloseIcon from '@mui/icons-material/Close';
import { redirectToCheckout } from '../../api/stripe';

interface PaymentProps {
  planId: string;
  onPaymentComplete?: () => void;
  onCancel?: () => void;
}

type ModalContent = 'terms' | 'privacy' | null;

const Payment: React.FC<PaymentProps> = ({ planId, onPaymentComplete, onCancel }) => {
  const [modalOpen, setModalOpen] = useState<ModalContent>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isAnnualPlan = planId === 'annual';
  const planAmount = useMemo(() => 
    isAnnualPlan ? '5,000' : '500',
    [isAnnualPlan]
  );
  
  // 支払いボタンのテキストをより明確な表現に変更
  const buttonText = useMemo(() => {
    if (loading) return '処理中...';
    return isAnnualPlan 
      ? `年額プランに登録する (¥${planAmount})` 
      : `月額プランに登録する (¥${planAmount})`;
  }, [loading, isAnnualPlan, planAmount]);
  
  const handleCheckout = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Stripeチェックアウトページにリダイレクト
      await redirectToCheckout(planId);
      
      // ここにはリダイレクト後は到達しない
      
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : '決済処理の開始に失敗しました。しばらくしてから再度お試しください。');
      setLoading(false);
    }
  };
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        お支払い情報
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {isAnnualPlan ? '年額プラン' : '月額プラン'}
          </Typography>
          <Typography variant="h6">
            ¥{planAmount}{isAnnualPlan ? '/年' : '/月'}
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">
            お支払い金額
          </Typography>
          <Typography variant="h6">
            ¥{planAmount}
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>エラー</AlertTitle>
          {error}
        </Alert>
      )}
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>安全なお支払い</AlertTitle>
        <Typography variant="body2">
          お支払いはStripeの安全な決済ページで行われます。クレジットカード情報は当サイトでは保存されません。
        </Typography>
      </Alert>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 2 }}>
        <LockIcon color="action" fontSize="small" />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          お支払い情報は安全に暗号化されます
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          type="button"
          variant="outlined"
          onClick={onCancel}
          sx={{ flex: 1 }}
          disabled={loading}
        >
          キャンセル
        </Button>
        
        <Button
          type="button"
          variant="contained"
          color="primary"
          disabled={loading}
          onClick={handleCheckout}
          startIcon={loading ? <CircularProgress size={16} /> : <CreditCardIcon />}
          sx={{ flex: 1 }}
        >
          {buttonText}
        </Button>
      </Box>
      
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          「{buttonText}」ボタンをクリックすることで、私たちの
          <Button 
            variant="text" 
            size="small" 
            onClick={() => setModalOpen('terms')}
            sx={{ 
              p: '0 4px', 
              minWidth: 'auto', 
              textTransform: 'none',
              textDecoration: 'underline',
              color: 'primary.main'
            }}
          >
            利用規約
          </Button>
          および
          <Button 
            variant="text" 
            size="small" 
            onClick={() => setModalOpen('privacy')}
            sx={{ 
              p: '0 4px', 
              minWidth: 'auto', 
              textTransform: 'none',
              textDecoration: 'underline',
              color: 'primary.main'
            }}
          >
            プライバシーポリシー
          </Button>
          に同意したものとみなされます。
        </Typography>
      </Box>

      <Modal
        open={modalOpen !== null}
        onClose={() => setModalOpen(null)}
        aria-labelledby="legal-modal-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper 
          sx={{ 
            position: 'relative',
            width: '90%',
            maxWidth: 800,
            maxHeight: '90vh',
            overflow: 'auto',
            p: 4
          }}
        >
          <IconButton
            aria-label="close"
            onClick={() => setModalOpen(null)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>

          {modalOpen === 'terms' && (
            <>
              <Typography variant="h4" component="h2" gutterBottom id="legal-modal-title">
                利用規約
              </Typography>
              <Typography variant="subtitle1" gutterBottom color="text.secondary">
                最終更新日: 2025年3月31日
              </Typography>
              <Divider sx={{ my: 3 }} />
              <Box sx={{ mt: 2 }}>
                <Typography variant="h5" gutterBottom>
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
              </Box>
            </>
          )}

          {modalOpen === 'privacy' && (
            <>
              <Typography variant="h4" component="h2" gutterBottom id="legal-modal-title">
                プライバシーポリシー
              </Typography>
              <Typography variant="subtitle1" gutterBottom color="text.secondary">
                最終更新日: 2023年12月1日
              </Typography>
              <Divider sx={{ my: 3 }} />
              <Box sx={{ mt: 2 }}>
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
                  Eメールアドレス：smart-paper-v2@student-subscription.com
                </Typography>
              </Box>
            </>
          )}
        </Paper>
      </Modal>
    </Paper>
  );
};

// React.memoでコンポーネントをメモ化して不要な再レンダリングを防止
export default memo(Payment);
