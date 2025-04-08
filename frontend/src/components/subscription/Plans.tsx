// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/Plans.tsx
import { useState, useMemo, memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Radio,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useAuthStore } from '../../store/authStore';

// プラン情報の型定義
interface PlanFeature {
  name: string;
  free: string | boolean; // 無料会員
  paid: string | boolean; // 有料会員
}

interface PlanOption {
  id: string;
  title: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
}

interface PlansProps {
  onSelectPlan?: (planId: string, requiresPayment: boolean) => void;
  selectedPlan?: string;
  showComparisonOnly?: boolean;
}

const Plans: React.FC<PlansProps> = ({ 
  onSelectPlan, 
  selectedPlan,
  showComparisonOnly = false
}) => {
  const { userData, user } = useAuthStore();
  const [annually, setAnnually] = useState(true);
  
  // プラン機能の比較データ
  const planFeatures: PlanFeature[] = useMemo(() => [
    { name: '翻訳数', free: '3個/月', paid: '無制限' },
    { name: '論文保存期間', free: '3日間', paid: '1ヶ月間' },
    { name: '関連論文推薦', free: '3件/月', paid: '無制限' },
    { name: 'PDFファイルサイズ上限', free: '10MB', paid: '10MB' },
    { name: 'Obsidian連携', free: true, paid: true },
    { name: 'Zotero連携', free: true, paid: true },
  ], []);
  
  // お得率の計算
  // 月額: 500円/月 × 12カ月 = 6,000円/年
  // 年額: 5,000円/年
  // お得率: (6,000 - 5,000) / 6,000 ≈ 0.1667... = 約17%
  const savingsPercentage = 17;
  
  // プランオプション - 非会員プランを削除
  const planOptions: PlanOption[] = useMemo(() => [
    {
      id: 'free',
      title: '無料会員プラン',
      price: '¥0',
      period: '永久無料',
      description: '登録して使える無料プラン',
      features: planFeatures,
    },
    {
      id: annually ? 'annual' : 'monthly',
      title: 'プレミアムプラン',
      price: annually ? '¥5,000' : '¥500',
      period: annually ? '年額' : '月額',
      description: 'すべての機能を無制限で利用できる有料プラン',
      features: planFeatures,
      popular: true,
    }
  ], [annually, planFeatures]);
  
  // 現在のプラン状態を計算
  const activePlan = useMemo(() => {
    if (userData?.subscription_status === 'paid') {
      return annually ? 'annual' : 'monthly'; // 有料会員は年払いか月払いのプラン
    }
    return 'free'; // 無料会員
  }, [userData, annually]);
  
  // 比較表のみ表示する場合
  if (showComparisonOnly) {
    return (
      <Box sx={{ mb: 4 }}>
        {/* 修正部分: プラン比較の文字を削除し、スイッチを中央に配置 */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mb: 3 
        }}>
          <FormControlLabel
            control={
              <Switch
                checked={annually}
                onChange={(e) => setAnnually(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    fontWeight: !annually ? 'bold' : 'normal',
                    color: !annually ? 'primary.main' : 'text.secondary'
                  }}
                >
                  月払い
                </Typography>
                <Typography component="span" variant="body2" sx={{ mx: 1 }}>|</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{
                      fontWeight: annually ? 'bold' : 'normal',
                      color: annually ? 'primary.main' : 'text.secondary'
                    }}
                  >
                    年払い
                  </Typography>
                  {annually && (
                    <Chip
                      label={`${savingsPercentage}%お得`}
                      size="small"
                      color="secondary"
                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              </Box>
            }
          />
        </Box>
        
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>機能</TableCell>
                <TableCell align="center">無料会員プラン</TableCell>
                <TableCell align="center">プレミアムプラン {annually ? "(年額 ¥5,000)" : "(月額 ¥500)"}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {planFeatures.map((feature, index) => (
                <TableRow key={index}>
                  <TableCell component="th" scope="row">
                    {feature.name}
                  </TableCell>
                  <TableCell align="center">
                    {typeof feature.free === 'boolean' ? (
                      feature.free ? 
                        <CheckIcon color="success" /> : 
                        <CloseIcon color="error" />
                    ) : (
                      feature.free
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {typeof feature.paid === 'boolean' ? (
                      feature.paid ? 
                        <CheckIcon color="success" /> : 
                        <CloseIcon color="error" />
                    ) : (
                      // PDFファイルサイズ上限は全プラン同じなので強調しない
                      feature.name === 'PDFファイルサイズ上限' ? (
                        <Typography>
                          {feature.paid}
                        </Typography>
                      ) : (
                        <Typography fontWeight="bold" color="primary">
                          {feature.paid}
                        </Typography>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell component="th" scope="row">
                  料金
                </TableCell>
                <TableCell align="center">
                  ¥0
                </TableCell>
                <TableCell align="center">
                  <Typography fontWeight="bold" color="primary">
                    {annually ? "¥5,000/年" : "¥500/月"}
                  </Typography>
                  {annually && (
                    <Typography variant="caption" color="text.secondary">
                      (月あたり ¥417)
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }
  
  // 通常表示（選択可能なプランカード）
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={annually}
              onChange={(e) => setAnnually(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                component="span"
                variant="body2"
                sx={{
                  fontWeight: !annually ? 'bold' : 'normal',
                  color: !annually ? 'primary.main' : 'text.secondary'
                }}
              >
                月払い
              </Typography>
              <Typography component="span" variant="body2" sx={{ mx: 1 }}>|</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    fontWeight: annually ? 'bold' : 'normal',
                    color: annually ? 'primary.main' : 'text.secondary'
                  }}
                >
                  年払い
                </Typography>
                {annually && (
                  <Chip
                    label={`${savingsPercentage}%お得`}
                    size="small"
                    color="secondary"
                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
            </Box>
          }
        />
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'center' }}>
        {planOptions.map((plan) => (
          <Card 
            key={plan.id} 
            variant="outlined"
            sx={{ 
              width: { xs: '100%', md: 500 },
              position: 'relative',
              border: plan.popular ? '2px solid' : '1px solid',
              borderColor: plan.popular ? 'primary.main' : 'divider',
              boxShadow: plan.popular ? 3 : 0,
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-5px)',
                boxShadow: 5
              }
            }}
          >
            {plan.popular && (
              <Chip
                label="おすすめ"
                color="primary"
                size="small"
                sx={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  fontWeight: 'bold',
                  height: 28,
                  paddingX: 1,
                  '& .MuiChip-label': {
                    paddingX: 1,
                    lineHeight: 1.5
                  }
                }}
              />
            )}
            
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                {plan.title}
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="h3" component="p" gutterBottom>
                  {plan.price}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {plan.period}
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                {plan.description}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <List disablePadding>
                {planFeatures.map((feature, index) => {
                  // プランIDに基づいて適切な機能値を選択
                  let value;
                  if (plan.id === 'free') {
                    value = feature.free;
                  } else {
                    value = feature.paid;
                  }
                  
                  const isEnabled = typeof value === 'boolean' ? value : true;
                  
                  return (
                    <ListItem key={index} disablePadding disableGutters sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}>
                        <FiberManualRecordIcon 
                          fontSize="small" 
                          color={isEnabled ? "primary" : "disabled"}
                          sx={{ fontSize: 10 }}
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Typography
                            variant="body2"
                            color={isEnabled ? "text.primary" : "text.disabled"}
                          >
                            {feature.name}: {typeof value === 'boolean' ? 
                              (value ? '利用可能' : '利用不可') : 
                              value}
                          </Typography>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
            
            <CardActions sx={{ p: 3, pt: 0 }}>
              <Button
                variant={plan.id === activePlan ? "outlined" : "contained"}
                color="primary"
                fullWidth
                onClick={() => onSelectPlan && onSelectPlan(
                  plan.id, 
                  // プレミアムプランのみ支払いが必要
                  plan.id === 'annual' || plan.id === 'monthly'
                )}
                disabled={plan.id === activePlan}
                startIcon={plan.id === activePlan && <CheckIcon />}
              >
                {plan.id === activePlan ? 
                  '現在のプラン' : 
                  plan.id === 'free' ? '選択する' : 'アップグレード'}
              </Button>
            </CardActions>
            
            {selectedPlan === plan.id && (
              <Radio
                checked
                color="primary"
                sx={{ position: 'absolute', top: 10, right: 10 }}
              />
            )}
          </Card>
        ))}
      </Box>
    </Box>
  );
};

// React.memo でコンポーネントをメモ化して不要な再レンダリングを防止
export default memo(Plans);