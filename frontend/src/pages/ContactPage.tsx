// ~/Desktop/smart-paper-v2/frontend/src/pages/ContactPage.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  AlertTitle,
  Paper,
  Grid,
  CircularProgress,
  Divider,
  FormControlLabel,
  Checkbox,
  Link,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import BugReportIcon from '@mui/icons-material/BugReport';
import SendIcon from '@mui/icons-material/Send';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import { submitInquiry, submitProblemReport } from '../api/contact';

// タブパネルのプロパティ型定義
interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

// タブパネルコンポーネント
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`contact-tabpanel-${index}`}
      aria-labelledby={`contact-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// タブプロパティの設定
const a11yProps = (index: number) => {
  return {
    id: `contact-tab-${index}`,
    'aria-controls': `contact-tabpanel-${index}`,
  };
};

// お問い合わせカテゴリの選択肢
const inquiryCategories = [
  { value: 'service', label: 'サービス全般に関する質問' },
  { value: 'account', label: 'アカウントについて' },
  { value: 'subscription', label: 'サブスクリプション/料金について' },
  { value: 'feature', label: '機能リクエスト' },
  { value: 'other', label: 'その他' },
];

// 問題報告のカテゴリの選択肢
const problemCategories = [
  { value: 'translation', label: '翻訳の問題' },
  { value: 'summary', label: '要約の問題' },
  { value: 'upload', label: 'アップロードの問題' },
  { value: 'display', label: '表示の問題' },
  { value: 'export', label: 'エクスポートの問題' },
  { value: 'other', label: 'その他' },
];

const ContactPage = () => {
  // タブの状態
  const [tabValue, setTabValue] = useState(0);
  
  // フォームの状態
  const [inquiryForm, setInquiryForm] = useState({
    category: '',
    subject: '',
    message: '',
    email: '',
  });

  const [problemForm, setProblemForm] = useState({
    category: '',
    paper_id: '',
    description: '',
    steps_to_reproduce: '',
    share_with_admin: false,
  });

  // 送信状態
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ストアからデータを取得
  const { user, userData } = useAuthStore();
  const { papers, fetchUserPapers } = usePaperStore();

  // ユーザーの論文データを取得
  useEffect(() => {
    if (user) {
      fetchUserPapers(user.uid);
      
      // メールアドレスをフォームに設定
      if (user.email) {
        setInquiryForm(prev => ({
          ...prev,
          email: user.email || '',
        }));
      }
    }
  }, [user, fetchUserPapers]);

  // タブ切り替え処理
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // タブ切り替え時に状態をリセット
    setSuccess(false);
    setError(null);
  };

  // 問い合わせフォームの変更処理
  const handleInquiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInquiryForm(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // 問題報告フォームの変更処理
  const handleProblemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProblemForm(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // 選択変更の処理 (セレクトボックス用)
  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    if (tabValue === 0) {
      setInquiryForm(prev => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setProblemForm(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // チェックボックスの変更処理
  const handleShareChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProblemForm(prev => ({
      ...prev,
      share_with_admin: e.target.checked,
    }));
  };

  // 問い合わせフォーム送信
  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);
      
      // バリデーション
      if (!inquiryForm.category || !inquiryForm.subject || !inquiryForm.message || !inquiryForm.email) {
        throw new Error('すべての必須項目を入力してください');
      }
      
      // APIを呼び出して問い合わせを送信
      await submitInquiry({
        ...inquiryForm,
        user_id: user?.uid || null,
      });
      
      // 成功時の処理
      setSuccess(true);
      // フォームをリセット
      setInquiryForm({
        category: '',
        subject: '',
        message: '',
        email: user?.email || '',
      });
      
    } catch (err) {
      console.error('Failed to submit inquiry:', err);
      setError(err instanceof Error ? err.message : '問い合わせの送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // 問題報告フォーム送信
  const handleProblemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);
      
      // バリデーション
      if (!problemForm.category || !problemForm.description) {
        throw new Error('すべての必須項目を入力してください');
      }
      
      // 論文を共有する場合はpaper_idが必要
      if (problemForm.share_with_admin && !problemForm.paper_id) {
        throw new Error('論文を共有する場合は、関連する論文を選択してください');
      }
      
      // APIを呼び出して問題報告を送信
      await submitProblemReport({
        ...problemForm,
        user_id: user?.uid || null,
      });
      
      // 成功時の処理
      setSuccess(true);
      // フォームをリセット
      setProblemForm({
        category: '',
        paper_id: '',
        description: '',
        steps_to_reproduce: '',
        share_with_admin: false,
      });
      
    } catch (err) {
      console.error('Failed to submit problem report:', err);
      setError(err instanceof Error ? err.message : '問題報告の送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          お問い合わせ・問題報告
        </Typography>
        
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="contact tabs"
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab 
              icon={<EmailIcon />} 
              iconPosition="start" 
              label="サービスに関する問い合わせ" 
              {...a11yProps(0)} 
            />
            <Tab 
              icon={<BugReportIcon />} 
              iconPosition="start" 
              label="問題報告" 
              {...a11yProps(1)} 
            />
          </Tabs>
        </Box>
        
        {/* お問い合わせタブ */}
        <TabPanel value={tabValue} index={0}>
          {success ? (
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>送信完了</AlertTitle>
              お問い合わせありがとうございます。メッセージが送信されました。担当者が確認次第、ご返信いたします。
            </Alert>
          ) : (
            <form onSubmit={handleInquirySubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    サービスに関するお問い合わせ
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    サービスに関するご質問、ご意見などをお聞かせください。お問い合わせ内容に応じて、担当者より返信いたします。
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel id="inquiry-category-label">カテゴリ</InputLabel>
                    <Select
                      labelId="inquiry-category-label"
                      id="inquiry-category"
                      name="category"
                      value={inquiryForm.category}
                      label="カテゴリ"
                      onChange={handleSelectChange}
                    >
                      {inquiryCategories.map((category) => (
                        <MenuItem key={category.value} value={category.value}>
                          {category.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="email"
                    name="email"
                    label="メールアドレス"
                    type="email"
                    value={inquiryForm.email}
                    onChange={handleInquiryChange}
                    placeholder="返信用のメールアドレス"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    id="subject"
                    name="subject"
                    label="件名"
                    value={inquiryForm.subject}
                    onChange={handleInquiryChange}
                    placeholder="お問い合わせの件名"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    id="message"
                    name="message"
                    label="お問い合わせ内容"
                    multiline
                    rows={6}
                    value={inquiryForm.message}
                    onChange={handleInquiryChange}
                    placeholder="お問い合わせの詳細をご記入ください"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  )}
                  
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
                  >
                    {submitting ? '送信中...' : 'お問い合わせを送信'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          )}
        </TabPanel>
        
        {/* 問題報告タブ */}
        <TabPanel value={tabValue} index={1}>
          {success ? (
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>送信完了</AlertTitle>
              問題報告ありがとうございます。報告内容を確認し、問題解決に取り組みます。必要に応じてご連絡させていただきます。
            </Alert>
          ) : (
            <form onSubmit={handleProblemSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    問題報告
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    サービス利用中に発生した問題をお知らせください。できるだけ詳細な情報をご提供いただくと、迅速な問題解決につながります。
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel id="problem-category-label">問題カテゴリ</InputLabel>
                    <Select
                      labelId="problem-category-label"
                      id="problem-category"
                      name="category"
                      value={problemForm.category}
                      label="問題カテゴリ"
                      onChange={handleSelectChange}
                    >
                      {problemCategories.map((category) => (
                        <MenuItem key={category.value} value={category.value}>
                          {category.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="paper-select-label">関連する論文（任意）</InputLabel>
                    <Select
                      labelId="paper-select-label"
                      id="paper-id"
                      name="paper_id"
                      value={problemForm.paper_id}
                      label="関連する論文（任意）"
                      onChange={handleSelectChange}
                    >
                      <MenuItem value="">
                        <em>なし</em>
                      </MenuItem>
                      {papers.map((paper) => (
                        <MenuItem key={paper.id} value={paper.id}>
                          {paper.metadata?.title || `論文 ID: ${paper.id}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    id="description"
                    name="description"
                    label="問題の詳細"
                    multiline
                    rows={4}
                    value={problemForm.description}
                    onChange={handleProblemChange}
                    placeholder="発生した問題について詳しく教えてください"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="steps_to_reproduce"
                    name="steps_to_reproduce"
                    label="再現手順（任意）"
                    multiline
                    rows={3}
                    value={problemForm.steps_to_reproduce}
                    onChange={handleProblemChange}
                    placeholder="問題を再現する手順を教えてください"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={problemForm.share_with_admin}
                        onChange={handleShareChange}
                        name="share_with_admin"
                        color="primary"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        問題調査のために、選択した論文を管理者と共有することに同意します
                      </Typography>
                    }
                  />
                </Grid>
                
                <Grid item xs={12}>
                  {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  )}
                  
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={20} /> : <BugReportIcon />}
                  >
                    {submitting ? '送信中...' : '問題を報告する'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          )}
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default ContactPage;