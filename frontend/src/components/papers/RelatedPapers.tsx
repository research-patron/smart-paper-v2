// ~/Desktop/smart-paper-v2/frontend/src/components/papers/RelatedPapers.tsx
import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Link,
  Alert,
  CircularProgress,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SortIcon from '@mui/icons-material/Sort';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { RelatedPaper } from '../../api/papers';

interface RelatedPapersProps {
  relatedPapers: RelatedPaper[];
  loading?: boolean;
  error?: string | null;
}

const RelatedPapers: React.FC<RelatedPapersProps> = ({ 
  relatedPapers, 
  loading = false,
  error = null
}) => {
  // ソート方法（引用数順のみ）
  const [sortBy, setSortBy] = useState<'relatedness' | 'citations'>('relatedness');
  
  // 関連論文の有無を確認
  const hasPapers = relatedPapers && relatedPapers.length > 0;
  
  // 現在のソート方法でソートされた関連論文リスト
  const sortedPapers = hasPapers 
    ? [...relatedPapers].sort((a, b) => {
        if (sortBy === 'relatedness') {
          // 関連度でソート (高い順)
          return (b.relatedness_score || 0) - (a.relatedness_score || 0);
        } else {
          // 引用数でソート (多い順)
          return (b.citation_count || 0) - (a.citation_count || 0);
        }
      })
    : [];

  // DOIリンクの生成
  const generateDoiLink = (doi: string) => {
    if (!doi) return '#';
    return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
  };
  
  // ロード中の表示
  if (loading) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4, flexDirection: 'column' }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Box component="span" sx={{ typography: 'body1', color: 'text.secondary' }}>
            関連論文を取得しています...
          </Box>
        </Box>
      </Paper>
    );
  }

  // エラー表示
  if (error) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          関連論文の取得中にエラーが発生しました。
        </Alert>
          <Box component="span" sx={{ typography: 'body2', color: 'text.secondary' }}>
            {error}
          </Box>
      </Paper>
    );
  }
  
  // 関連論文がない場合
  if (!hasPapers) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Alert severity="info">
          関連論文が見つかりませんでした。
        </Alert>
          <Box component="span" sx={{ display: 'block', typography: 'body2', color: 'text.secondary', mt: 2 }}>
            この論文のDOIが見つからないか、または関連する論文が検出されませんでした。
          </Box>
      </Paper>
    );
  }
  
  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box component="h2" sx={{ typography: 'h6' }}>
          関連論文 ({sortedPapers.length})
        </Box>
        
        <Tooltip title="この機能について">
          <IconButton size="small">
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <InfoIcon sx={{ mr: 1, mt: 0.5 }} fontSize="small" />
          <Box component="div">
            <Box component="span" sx={{ display: 'block', typography: 'body2', fontWeight: 'bold' }}>
              推薦ロジックについて
            </Box>
            <Box component="span" sx={{ display: 'block', typography: 'body2' }}>
              この論文と同様のトピックを扱う論文や、この論文と共通の引用関係を持つ論文を分析して表示しています。
              推薦には論文のDOIまたはタイトルを使用して関連度を計算しています。
            </Box>
          </Box>
        </Box>
      </Alert>
      
      <Box sx={{ mb: 3 }}>
        <FormControl sx={{ width: 200 }} size="small" variant="outlined">
          <InputLabel id="sort-by-label">並び替え</InputLabel>
          <Select
            labelId="sort-by-label"
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relatedness' | 'citations')}
            label="並び替え"
            startAdornment={
              <SortIcon fontSize="small" sx={{ mr: 1 }} />
            }
          >
            <MenuItem value="relatedness">関連度</MenuItem>
            <MenuItem value="citations">引用数</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {sortedPapers.length === 0 ? (
        <Alert severity="info">
          関連論文が見つかりません。
        </Alert>
      ) : (
        <List disablePadding>
          {sortedPapers.map((paper, index) => (
            <Box key={paper.doi || index}>
              {index > 0 && <Divider component="li" />}
              <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                <ListItemText
                  disableTypography
                  primary={
                    <Box component="div" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box component="span" sx={{ flex: 1, fontWeight: 500, typography: 'subtitle1' }}>
                        {paper.title}
                      </Box>
                      {paper.year && (
                        <Chip
                          label={paper.year}
                          size="small"
                          sx={{ ml: 1, minWidth: 60, bgcolor: 'background.paper' }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box component="div" sx={{ mt: 1 }}>
                      {paper.authors && (
                        <Box component="span" sx={{ display: 'block', mb: 1, typography: 'body2', color: 'text.secondary' }}>
                          {Array.isArray(paper.authors) 
                            ? paper.authors.join(', ')
                            : paper.authors}
                        </Box>
                      )}
                      
                      <Box component="div" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {paper.doi && (
                          <Link
                            href={generateDoiLink(paper.doi)}
                            target="_blank"
                            rel="noopener"
                            sx={{ display: 'flex', alignItems: 'center' }}
                          >
                            <Box component="span" sx={{ display: 'flex', alignItems: 'center', typography: 'body2' }}>
                              DOI: {paper.doi}
                              <OpenInNewIcon fontSize="small" sx={{ ml: 0.5, fontSize: '1rem' }} />
                            </Box>
                          </Link>
                        )}
                        
                        <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
                          {paper.citation_count !== undefined && (
                            <Tooltip title="引用数">
                              <Chip
                                label={`${paper.citation_count} 引用`}
                                size="small"
                                color={sortBy === 'citations' ? 'primary' : 'default'}
                                variant={sortBy === 'citations' ? 'filled' : 'outlined'}
                              />
                            </Tooltip>
                          )}
                          
                          {paper.relatedness_score !== undefined && (
                            <Tooltip title="関連度スコア (0-1)">
                              <Chip
                                label={`関連度: ${Math.round(paper.relatedness_score * 100)}%`}
                                size="small"
                                color={sortBy === 'relatedness' ? 'primary' : 'default'}
                                variant={sortBy === 'relatedness' ? 'filled' : 'outlined'}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            </Box>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default RelatedPapers;
