// ~/Desktop/smart-paper-v2/frontend/src/components/subscription/Plans.tsx
import { useState } from 'react';
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
  free: string | boolean;
  paid: string | boolean;
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
  onSelectPlan?: (planId: string) => void;
  selectedPlan?: string;
  showComparisonOnly?: boolean;
}

const Plans: React.FC<PlansProps> = ({ 
  onSelectPlan, 
  selectedPlan,
  showComparisonOnly = false
}) => {
  const { userData } = useAuthStore();
  const [annually, setAnnually] = useState(true);
  
  // プラン機能の比較データ
  const planFeatures: PlanFeature[] = [
    { name: '翻訳数', free: '3個/日', paid: '無制限' },
    { name: '論文保存期間', free: '3日間', paid: '1ヶ月間' },
    { name: '関連論文推薦', free: '3件/日', paid: '無制限' },
    { name: 'PDFファイルサイズ上限', free: '20MB', paid: '20MB' },
    { name: 'Obsidian連携', free: true, paid: true },
    { name: 'Zotero連携', free: true, paid: true },
    { name: '広告表示', free: false, paid: false },
  ];
  
  // プランオプション
  const planOptions: PlanOption[] = [
    {
      id: 'free',
      title: '無料プラン',
      price: '¥0',
      period: '永久無料',
      description: '基本機能を利用できる無料プラン',
      features: planFeatures,
    },
    {
      id: annually ? 'annual' : 'monthly',
      title: 'プレミアムプラン',
      price: annually ? '¥3,000' : '¥300',
      period: annually ? '年額' : '月額',
      description: 'すべての機能を無制限で利用できる有料プラン',
      features: planFeatures,
      popular: true,
    }
  ];
  
  // 表示するプランを選択
  const activePlan = userData?.subscription_status === 'paid' ? 'paid' : 'free';
  
  // 比較表のみ表示する場合
  if (showComparisonOnly) {
    return (
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">プラン比較</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={annually}
                onChange={(e) => setAnnually(e.target.checked)}
                color="primary"
              />
            }
            label={annually ? "年払い" : "月払い"}
          />
        </Box>
        
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>機能</TableCell>
                <TableCell align="center">無料プラン</TableCell>
                <TableCell align="center">プレミアムプラン {annually ? "(年額 ¥3,000)" : "(月額 ¥300)"}</TableCell>
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
                      <Typography fontWeight="bold" color="primary">
                        {feature.paid}
                      </Typography>
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
                    {annually ? "¥3,000/年" : "¥300/月"}
                  </Typography>
                  {annually && (
                    <Typography variant="caption" color="text.secondary">
                      (月あたり ¥250)
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
                variant="body2" 
                sx={{ 
                  fontWeight: !annually ? 'bold' : 'normal',
                  color: !annually ? 'primary.main' : 'text.secondary'
                }}
              >
                月払い
              </Typography>
              <Typography variant="body2" sx={{ mx: 1 }}>|</Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: annually ? 'bold' : 'normal',
                  color: annually ? 'primary.main' : 'text.secondary'
                }}
              >
                年払い
                {annually && (
                  <Chip 
                    label="17%お得" 
                    size="small" 
                    color="secondary" 
                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Typography>
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
              width: { xs: '100%', md: 340 },
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
                  top: -10,
                  right: 20,
                  fontWeight: 'bold',
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
                  const value = plan.id === 'free' ? feature.free : feature.paid;
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
                onClick={() => onSelectPlan && onSelectPlan(plan.id)}
                disabled={plan.id === activePlan}
                startIcon={plan.id === activePlan && <CheckIcon />}
              >
                {plan.id === activePlan ? 
                  '現在のプラン' : 
                  plan.id === 'free' ? 'ダウングレード' : 'アップグレード'}
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

export default Plans;