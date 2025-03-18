// ~/Desktop/smart-paper-v2/frontend/src/components/papers/RelatedPapers.tsx
import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Link,
  Alert,
  CircularProgress,
  Grid,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SortIcon from '@mui/icons-material/Sort';
import FilterListIcon from '@mui/icons-material/FilterList';
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
  // 状態管理
  const [sortBy, setSortBy] = useState<'relatedness' | 'citations'>('relatedness');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]);
  const [newExcludedKeyword, setNewExcludedKeyword] = useState('');
  
  // 関連論文の有無を確認
  const hasPapers = relatedPapers && relatedPapers.length > 0;
  
  // フィルタリングとソート処理
  const filteredAndSortedPapers = useMemo(() => {
    if (!hasPapers) return [];
    
    // 検索キーワードでフィルタリング
    let filtered = relatedPapers;
    
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(paper => 
        paper.title.toLowerCase().includes(keyword) ||
        paper.doi?.toLowerCase().includes(keyword) ||
        (paper.authors && paper.authors.some(author => 
          author.toLowerCase().includes(keyword)
        ))
      );
    }
    
    // 除外キーワードでフィルタリング
    if (excludedKeywords.length > 0) {
      filtered = filtered.filter(paper => {
        const title = paper.title.toLowerCase();
        return !excludedKeywords.some(keyword => 
          title.includes(keyword.toLowerCase())
        );
      });
    }
    
    // ソート処理
    return [...filtered].sort((a, b) => {
      if (sortBy === 'relatedness') {
        // 関連度でソート (高い順)
        return (b.relatedness_score || 0) - (a.relatedness_score || 0);
      } else {
        // 引用数でソート (多い順)
        return (b.citation_count || 0) - (a.citation_count || 0);
      }
    });
  }, [relatedPapers, sortBy, searchKeyword, excludedKeywords, hasPapers]);
  
  // 除外キーワードの追加
  const handleAddExcludedKeyword = () => {
    if (newExcludedKeyword && !excludedKeywords.includes(newExcludedKeyword)) {
      setExcludedKeywords([...excludedKeywords, newExcludedKeyword]);
      setNewExcludedKeyword('');
    }
  };
  
  // 除外キーワードの削除
  const handleRemoveExcludedKeyword = (keyword: string) => {
    setExcludedKeywords(excludedKeywords.filter(k => k !== keyword));
  };

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
          <Typography variant="body1" color="text.secondary">
            関連論文を取得しています...
          </Typography>
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
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          この論文のDOIが見つからないか、または関連する論文が検出されませんでした。
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2">
          関連論文 ({filteredAndSortedPapers.length})
        </Typography>
        
        <Tooltip title="この機能について">
          <IconButton size="small">
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <InfoIcon sx={{ mr: 1, mt: 0.5 }} fontSize="small" />
          <Box>
            <Typography variant="body2" fontWeight="bold">
              推薦ロジックについて
            </Typography>
            <Typography variant="body2">
              この論文と同様のトピックを扱う論文や、この論文と共通の引用関係を持つ論文を分析して表示しています。
              関連度は文書類似性や共引用関係などの複合要素に基づいて計算されています。
            </Typography>
          </Box>
        </Box>
      </Alert>
      
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="論文を検索..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="sort-by-label">並び替え</InputLabel>
              <Select
                labelId="sort-by-label"
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'relatedness' | 'citations')}
                label="並び替え"
                startAdornment={
                  <InputAdornment position="start">
                    <SortIcon fontSize="small" />
                  </InputAdornment>
                }
              >
                <MenuItem value="relatedness">関連度</MenuItem>
                <MenuItem value="citations">引用数</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <FilterListIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ mr: 1 }}>
                除外キーワード:
              </Typography>
              
              {excludedKeywords.map((keyword) => (
                <Chip
                  key={keyword}
                  label={keyword}
                  size="small"
                  onDelete={() => handleRemoveExcludedKeyword(keyword)}
                />
              ))}
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                <TextField
                  size="small"
                  placeholder="キーワードを追加"
                  value={newExcludedKeyword}
                  onChange={(e) => setNewExcludedKeyword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddExcludedKeyword();
                      e.preventDefault();
                    }
                  }}
                  sx={{ width: 150 }}
                />
                <Typography
                  variant="button"
                  component="button"
                  onClick={handleAddExcludedKeyword}
                  sx={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'primary.main',
                    textDecoration: 'underline',
                    padding: 0,
                    '&:disabled': {
                      color: 'text.disabled',
                      cursor: 'default'
                    }
                  }}
                  disabled={!newExcludedKeyword}
                >
                  追加
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {filteredAndSortedPapers.length === 0 ? (
        <Alert severity="info">
          検索条件に一致する論文が見つかりません。
        </Alert>
      ) : (
        <List disablePadding>
          {filteredAndSortedPapers.map((paper, index) => (
            <Box key={paper.doi || index}>
              {index > 0 && <Divider component="li" />}
              <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle1" component="div" sx={{ flex: 1, fontWeight: 500 }}>
                        {paper.title}
                      </Typography>
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
                    <Box sx={{ mt: 1 }}>
                      {paper.authors && (
                        <Typography variant="body2" color="text.secondary" component="div" sx={{ mb: 1 }}>
                          {Array.isArray(paper.authors) 
                            ? paper.authors.join(', ')
                            : paper.authors}
                        </Typography>
                      )}
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {paper.doi && (
                          <Link
                            href={generateDoiLink(paper.doi)}
                            target="_blank"
                            rel="noopener"
                            sx={{ display: 'flex', alignItems: 'center' }}
                          >
                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                              DOI: {paper.doi}
                              <OpenInNewIcon fontSize="small" sx={{ ml: 0.5, fontSize: '1rem' }} />
                            </Typography>
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