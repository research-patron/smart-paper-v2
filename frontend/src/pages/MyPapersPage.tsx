import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Grid,
  Box,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  LinearProgress,
  Alert,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import { Paper as PaperType } from '../api/papers';
import CategoryTree from '../components/papers/CategoryTree';
import CategorySection from '../components/papers/CategorySection';
import ViewModeToggle, { ViewMode } from '../components/papers/ViewModeToggle';

interface ExtendedPaper extends PaperType {
  createdAt?: {
    toMillis: () => number;
  };
}

// 論文をカテゴリーに分類する関数
const categorizePapers = (papers: ExtendedPaper[]) => {
  const categories = new Map<string, ExtendedPaper[]>();
  const uncategorized: ExtendedPaper[] = [];

  papers.forEach(paper => {
    if (paper.metadata?.keywords && paper.metadata.keywords.length > 0) {
      // 最初のキーワードをメインカテゴリーとして使用
      const mainCategory = paper.metadata.keywords[0];
      if (!categories.has(mainCategory)) {
        categories.set(mainCategory, []);
      }
      categories.get(mainCategory)?.push(paper);
    } else {
      uncategorized.push(paper);
    }
  });

  return {
    categories: Array.from(categories.entries()).map(([name, papers]) => ({
      id: name,
      name,
      count: papers.length,
      papers
    })),
    uncategorized
  };
};

const MyPapersPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchy');
  
  const { user } = useAuthStore();
  const { papers, loading, error, fetchUserPapers } = usePaperStore();

  useEffect(() => {
    if (user) {
      fetchUserPapers(user.uid);
    }
  }, [user, fetchUserPapers]);

  // 検索フィルター
  const filteredPapers = useMemo(() => {
    if (!searchTerm) return papers;

    const searchLower = searchTerm.toLowerCase();
    return papers.filter(paper => {
      const titleMatch = paper.metadata?.title?.toLowerCase().includes(searchLower);
      const authorMatch = paper.metadata?.authors?.some(author => 
        author.name.toLowerCase().includes(searchLower)
      );
      const journalMatch = paper.metadata?.journal?.toLowerCase().includes(searchLower);
      const keywordMatch = paper.metadata?.keywords?.some(keyword =>
        keyword.toLowerCase().includes(searchLower)
      );
      
      return titleMatch || authorMatch || journalMatch || keywordMatch;
    });
  }, [papers, searchTerm]);

  // カテゴリー分類
  const { categories, uncategorized } = useMemo(() => {
    return categorizePapers(filteredPapers);
  }, [filteredPapers]);

  // 検索条件をクリア
  const clearSearch = () => {
    setSearchTerm('');
  };

  // カテゴリーがクリックされたときの処理
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(prev => prev === categoryId ? null : categoryId);
  };

  // 表示モードが変更されたときの処理
  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        {/* 検索バー */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <Typography variant="h4" component="h1">
                マイ論文
              </Typography>
            </Grid>
            <Grid item xs={12} md="auto">
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="論文を検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={clearSearch}>
                        <FilterListIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: { xs: '100%', md: 300 } }}
              />
            </Grid>
          </Grid>
        </Box>

        {loading ? (
          <LinearProgress />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : papers.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6">
              論文がありません
            </Typography>
            <Typography variant="body2" color="text.secondary">
              PDFをアップロードして論文を翻訳してみましょう
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {/* サイドバー: カテゴリーツリー */}
            {!isMobile && (
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <CategoryTree
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onCategorySelect={handleCategorySelect}
                  />
                </Paper>
              </Grid>
            )}

            {/* メインコンテンツ */}
            <Grid item xs={12} md={isMobile ? 12 : 9}>
              {/* 表示モード切り替え */}
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <ViewModeToggle
                  mode={viewMode}
                  onChange={handleViewModeChange}
                />
              </Box>

              {viewMode === 'hierarchy' ? (
                // 階層表示モード
                <>
                  {/* 選択されたカテゴリーの論文を表示 */}
                  {selectedCategory ? (
                    <CategorySection
                      title={selectedCategory}
                      papers={categories.find(c => c.id === selectedCategory)?.papers || []}
                    />
                  ) : (
                    // すべてのカテゴリーを表示
                    <>
                      {categories.map(category => (
                        <CategorySection
                          key={category.id}
                          title={category.name}
                          papers={category.papers}
                          onCategoryClick={() => handleCategorySelect(category.id)}
                        />
                      ))}
                      {uncategorized.length > 0 && (
                        <CategorySection
                          title="未分類"
                          papers={uncategorized}
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                // グリッド表示モード
                <Grid container spacing={2}>
                  {(selectedCategory
                    ? categories.find(c => c.id === selectedCategory)?.papers
                    : filteredPapers
                  )?.map((paper) => (
                    <Grid item xs={12} sm={6} key={paper.id}>
                      <Paper
                        sx={{
                          p: 2,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          '&:hover': {
                            boxShadow: 3,
                          },
                        }}
                        onClick={() => navigate(`/papers/${paper.id}`)}
                      >
                        <Typography variant="h6" gutterBottom noWrap>
                          {paper.metadata?.title || '無題の論文'}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" noWrap>
                          {paper.metadata?.authors?.map(a => a.name).join(', ') || '著者不明'}
                        </Typography>

                        {paper.metadata?.keywords && (
                          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {paper.metadata.keywords.map((keyword, index) => (
                              <Typography
                                key={index}
                                variant="caption"
                                color="primary"
                                sx={{ backgroundColor: 'primary.50', px: 1, borderRadius: 1 }}
                              >
                                {keyword}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Grid>
          </Grid>
        )}
      </Box>
    </Container>
  );
};

export default MyPapersPage;
