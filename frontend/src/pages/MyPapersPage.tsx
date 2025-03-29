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
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Button,
  alpha,
  Collapse,
  Divider,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SchoolIcon from '@mui/icons-material/School';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import ArticleIcon from '@mui/icons-material/Article';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import GridViewIcon from '@mui/icons-material/GridView';
import DescriptionIcon from '@mui/icons-material/Description';
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

// SANGO風のセクションタイトルコンポーネント
const SectionTitle = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ 
      position: 'relative', 
      mb: 3,
      display: 'inline-block',
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: -1,
        left: 0,
        width: '40%',
        height: 3,
        backgroundColor: theme.palette.primary.main,
        borderRadius: 1.5,
      }
    }}>
      <Typography 
        variant="h5" 
        component="h2" 
        sx={{ 
          fontWeight: 700,
          position: 'relative',
          pb: 0.5,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
};

// SANGO風のカテゴリーカードコンポーネント
const CategoryCard = ({ 
  title, 
  count, 
  isSelected, 
  onSelect 
}: { 
  title: string; 
  count: number; 
  isSelected: boolean; 
  onSelect: () => void;
}) => {
  const theme = useTheme();
  
  return (
    <Card 
      onClick={onSelect}
      sx={{
        mb: 1.5,
        borderRadius: 3,
        boxShadow: isSelected 
          ? `0 0 0 2px ${theme.palette.primary.main}, 0 8px 20px rgba(0,0,0,0.1)` 
          : '0 4px 12px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: isSelected 
            ? `0 0 0 2px ${theme.palette.primary.main}, 0 10px 25px rgba(0,0,0,0.15)` 
            : '0 8px 20px rgba(0,0,0,0.1)',
        },
        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LibraryBooksIcon 
              color={isSelected ? 'primary' : 'action'} 
              sx={{ mr: 1.5, fontSize: 20 }} 
            />
            <Typography 
              variant="body1" 
              sx={{ 
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? 'primary.main' : 'text.primary',
              }}
            >
              {title}
            </Typography>
          </Box>
          <Chip 
            label={count} 
            size="small" 
            color={isSelected ? 'primary' : 'default'} 
            sx={{ 
              minWidth: 40,
              fontWeight: 600,
            }} 
          />
        </Box>
      </CardContent>
    </Card>
  );
};

// SANGO風の論文カードコンポーネント
const PaperCard = ({ paper, onClick }: { paper: PaperType; onClick: () => void }) => {
  const theme = useTheme();
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '処理待ち';
      case 'metadata_extracted':
        return 'メタデータ抽出完了';
      case 'processing':
        return '翻訳中';
      case 'completed':
        return '完了';
      case 'error':
        return 'エラー';
      default:
        return '不明';
    }
  };
  
  return (
    <Card 
      sx={{ 
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 6px 16px rgba(0,0,0,0.07)',
        transition: 'all 0.3s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 15px 30px rgba(0,0,0,0.12)',
        }
      }}
    >
      <CardActionArea 
        onClick={onClick}
        sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'stretch'
        }}
      >
        <CardContent sx={{ p: 3, flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Chip
              label={getStatusText(paper.status)}
              size="small"
              color={
                paper.status === 'completed' ? 'success' :
                paper.status === 'error' ? 'error' :
                'primary'
              }
              sx={{ 
                fontWeight: 600,
                px: 1, 
                borderRadius: '50px',
              }}
            />
            {paper.status === 'processing' && paper.progress && (
              <Typography variant="caption" color="text.secondary">
                {paper.progress}%
              </Typography>
            )}
          </Box>
          
          <Typography 
            variant="h6" 
            noWrap 
            title={paper.metadata?.title}
            sx={{ 
              fontWeight: 700,
              mb: 1.5,
            }}
          >
            {paper.metadata?.title || '無題の論文'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <SchoolIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
            <Typography variant="body2" color="text.secondary" noWrap>
              {paper.metadata?.authors?.map(a => a.name).join(', ') || '著者不明'}
            </Typography>
          </Box>
          
          {paper.metadata?.year && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <ArticleIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {paper.metadata.year}年
              </Typography>
            </Box>
          )}
          
          {paper.metadata?.journal && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <LocalLibraryIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
              <Typography 
                variant="body2"
                color="text.secondary"
                noWrap
              >
                {paper.metadata.journal}
              </Typography>
            </Box>
          )}
          
          {paper.status === 'processing' && paper.progress && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">処理中...</Typography>
                <Typography variant="caption" color="text.secondary">{paper.progress}%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={paper.progress} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                }}
              />
            </Box>
          )}
          
          {paper.metadata?.keywords && paper.metadata.keywords.length > 0 && (
            <Box sx={{ 
              mt: 2, 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: 0.5,
            }}>
              {paper.metadata.keywords.slice(0, 3).map((keyword, index) => (
                <Chip
                  key={index}
                  label={keyword}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ 
                    borderRadius: '50px',
                    '& .MuiChip-label': {
                      px: 1,
                    }
                  }}
                />
              ))}
              {paper.metadata.keywords.length > 3 && (
                <Chip
                  label={`+${paper.metadata.keywords.length - 3}`}
                  size="small"
                  sx={{ 
                    borderRadius: '50px',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    '& .MuiChip-label': {
                      px: 1,
                    }
                  }}
                />
              )}
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

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
  const [showMobileCategories, setShowMobileCategories] = useState(false);
  
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
    // モバイルの場合はカテゴリー選択後にパネルを閉じる
    if (isMobile) {
      setShowMobileCategories(false);
    }
  };

  // 表示モードが変更されたときの処理
  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
  };

  return (
    <Container maxWidth="xl" sx={{ pb: 6 }}>
      <Box sx={{ my: 4 }}>
        {/* ヘッダーセクション */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            mb: 4,
            gap: 2,
          }}
        >
          <Box>
            <SectionTitle>マイ論文ライブラリ</SectionTitle>
            <Typography color="text.secondary">
              あなたの研究論文をカテゴリー別に整理・閲覧できます
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
            <TextField
              placeholder="論文を検索"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={clearSearch}
                      edge="end"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { 
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                  '&.Mui-focused': {
                    boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
                  },
                }
              }}
              sx={{ 
                width: { xs: '100%', md: 250 },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: alpha(theme.palette.primary.main, 0.2)
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: theme.palette.primary.main
                },
              }}
            />
            
            {/* モバイル用のカテゴリー表示切り替えボタン */}
            {isMobile && (
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                onClick={() => setShowMobileCategories(prev => !prev)}
                endIcon={showMobileCategories ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
                sx={{ 
                  borderRadius: 3,
                  textTransform: 'none',
                }}
              >
                カテゴリーを{showMobileCategories ? '閉じる' : '表示'}
              </Button>
            )}
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* サイドバー: カテゴリーツリー */}
          <Grid 
            item 
            xs={12} 
            md={3}
            sx={{ 
              display: { 
                xs: isMobile && showMobileCategories ? 'block' : 'none', 
                md: 'block' 
              },
              mb: { xs: 2, md: 0 },
            }}
          >
            <Paper 
              sx={{ 
                p: 3, 
                height: '100%',
                borderRadius: 3,
                boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
              }}
            >
              <Typography 
                variant="h6" 
                sx={{ 
                  mb: 3, 
                  fontWeight: 700,
                  position: 'relative',
                  display: 'inline-block',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: -8,
                    left: 0,
                    width: '40%',
                    height: 3,
                    backgroundColor: theme.palette.primary.main,
                    borderRadius: 1.5,
                  }
                }}
              >
                カテゴリー
              </Typography>
              
              {/* すべての論文 */}
              <CategoryCard
                title="すべての論文"
                count={papers.length}
                isSelected={selectedCategory === null}
                onSelect={() => setSelectedCategory(null)}
              />
              
              {/* カテゴリー一覧 */}
              {categories.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ mb: 1, fontWeight: 500 }}
                  >
                    キーワード別
                  </Typography>
                  
                  {categories.map(category => (
                    <CategoryCard
                      key={category.id}
                      title={category.name}
                      count={category.count}
                      isSelected={selectedCategory === category.id}
                      onSelect={() => handleCategorySelect(category.id)}
                    />
                  ))}
                </>
              )}
              
              {/* 未分類 */}
              {uncategorized.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <CategoryCard
                    title="未分類"
                    count={uncategorized.length}
                    isSelected={selectedCategory === 'uncategorized'}
                    onSelect={() => handleCategorySelect('uncategorized')}
                  />
                </>
              )}
            </Paper>
          </Grid>

          {/* メインコンテンツ */}
          <Grid item xs={12} md={isMobile ? 12 : 9}>
            {/* 表示モード切り替え */}
            <Box sx={{ 
              mb: 3, 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: selectedCategory 
                    ? theme.palette.primary.main
                    : theme.palette.text.primary,
                }}
              >
                {selectedCategory 
                  ? (selectedCategory === 'uncategorized' 
                    ? '未分類の論文' 
                    : `"${selectedCategory}" の論文`)
                  : 'すべての論文'}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={viewMode === 'hierarchy' ? 'contained' : 'outlined'}
                  color="primary"
                  size="small"
                  startIcon={<FormatListBulletedIcon />}
                  onClick={() => handleViewModeChange('hierarchy')}
                  sx={{ 
                    borderRadius: 3,
                    boxShadow: viewMode === 'hierarchy' ? 3 : 0,
                  }}
                >
                  階層表示
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                  color="primary"
                  size="small"
                  startIcon={<GridViewIcon />}
                  onClick={() => handleViewModeChange('grid')}
                  sx={{ 
                    borderRadius: 3,
                    boxShadow: viewMode === 'grid' ? 3 : 0,
                  }}
                >
                  カード表示
                </Button>
              </Box>
            </Box>

            {loading ? (
              <Paper 
                sx={{ 
                  p: 4, 
                  textAlign: 'center',
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography>読み込み中...</Typography>
              </Paper>
            ) : error ? (
              <Alert 
                severity="error" 
                sx={{ 
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                {error}
              </Alert>
            ) : (
              <>
                {viewMode === 'hierarchy' ? (
                  // 階層表示モード
                  <>
                    {/* 選択されたカテゴリーの論文を表示 */}
                    {selectedCategory ? (
                      selectedCategory === 'uncategorized' ? (
                        uncategorized.length > 0 ? (
                          <Grid container spacing={3}>
                            {uncategorized.map(paper => (
                              <Grid item xs={12} sm={6} md={4} key={paper.id}>
                                <PaperCard
                                  paper={paper}
                                  onClick={() => navigate(`/papers/${paper.id}`)}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        ) : (
                          <Paper 
                            sx={{ 
                              p: 4, 
                              textAlign: 'center',
                              borderRadius: 3,
                              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                            }}
                          >
                            <DescriptionIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>未分類の論文はありません</Typography>
                          </Paper>
                        )
                      ) : (
                        <Grid container spacing={3}>
                          {categories
                            .find(c => c.id === selectedCategory)
                            ?.papers.map(paper => (
                              <Grid item xs={12} sm={6} md={4} key={paper.id}>
                                <PaperCard
                                  paper={paper}
                                  onClick={() => navigate(`/papers/${paper.id}`)}
                                />
                              </Grid>
                            ))}
                        </Grid>
                      )
                    ) : (
                      // すべてのカテゴリーを表示
                      <>
                        {papers.length === 0 ? (
                          <Paper 
                            sx={{ 
                              p: 4, 
                              textAlign: 'center',
                              borderRadius: 3,
                              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                            }}
                          >
                            <MenuBookIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>論文がありません</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              PDFをアップロードして論文を翻訳してみましょう
                            </Typography>
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={() => navigate('/')}
                              sx={{ 
                                mt: 3, 
                                borderRadius: 3,
                                px: 3,
                                py: 1,
                                boxShadow: '0 4px 10px rgba(248, 198, 119, 0.3)',
                              }}
                            >
                              PDFをアップロード
                            </Button>
                          </Paper>
                        ) : (
                          // カテゴリーごとに表示
                          <Box>
                            {categories.map(category => (
                              <Box key={category.id} sx={{ mb: 6 }}>
                                <Box 
                                  sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    mb: 2.5
                                  }}
                                >
                                  <Typography 
                                    variant="h6" 
                                    sx={{ 
                                      fontWeight: 700,
                                      position: 'relative',
                                      display: 'inline-block',
                                      '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        bottom: -4,
                                        left: 0,
                                        width: '40%',
                                        height: 2.5,
                                        backgroundColor: theme.palette.primary.main,
                                        borderRadius: 1.5,
                                      }
                                    }}
                                  >
                                    {category.name}
                                  </Typography>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="primary"
                                    onClick={() => handleCategorySelect(category.id)}
                                    sx={{ 
                                      borderRadius: 3,
                                      textTransform: 'none',
                                    }}
                                  >
                                    すべて表示
                                  </Button>
                                </Box>
                                <Grid container spacing={3}>
                                  {category.papers.slice(0, 3).map(paper => (
                                    <Grid item xs={12} sm={6} md={4} key={paper.id}>
                                      <PaperCard
                                        paper={paper}
                                        onClick={() => navigate(`/papers/${paper.id}`)}
                                      />
                                    </Grid>
                                  ))}
                                </Grid>
                                {category.papers.length > 3 && (
                                  <Box sx={{ textAlign: 'center', mt: 2 }}>
                                    <Button
                                      variant="outlined"
                                      color="primary"
                                      onClick={() => handleCategorySelect(category.id)}
                                      endIcon={<ArrowRightIcon />}
                                      sx={{ 
                                        borderRadius: 3,
                                        textTransform: 'none',
                                      }}
                                    >
                                      残り{category.papers.length - 3}件を表示
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            ))}
                            
                            {/* 未分類の論文セクション */}
                            {uncategorized.length > 0 && (
                              <Box sx={{ mb: 4 }}>
                                <Box 
                                  sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    mb: 2.5
                                  }}
                                >
                                  <Typography 
                                    variant="h6" 
                                    sx={{ 
                                      fontWeight: 700,
                                      position: 'relative',
                                      display: 'inline-block',
                                      '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        bottom: -4,
                                        left: 0,
                                        width: '40%',
                                        height: 2.5,
                                        backgroundColor: theme.palette.primary.main,
                                        borderRadius: 1.5,
                                      }
                                    }}
                                  >
                                    未分類
                                  </Typography>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="primary"
                                    onClick={() => handleCategorySelect('uncategorized')}
                                    sx={{ 
                                      borderRadius: 3,
                                      textTransform: 'none',
                                    }}
                                  >
                                    すべて表示
                                  </Button>
                                </Box>
                                <Grid container spacing={3}>
                                  {uncategorized.slice(0, 3).map(paper => (
                                    <Grid item xs={12} sm={6} md={4} key={paper.id}>
                                      <PaperCard
                                        paper={paper}
                                        onClick={() => navigate(`/papers/${paper.id}`)}
                                      />
                                    </Grid>
                                  ))}
                                </Grid>
                                {uncategorized.length > 3 && (
                                  <Box sx={{ textAlign: 'center', mt: 2 }}>
                                    <Button
                                      variant="outlined"
                                      color="primary"
                                      onClick={() => handleCategorySelect('uncategorized')}
                                      endIcon={<ArrowRightIcon />}
                                      sx={{ 
                                        borderRadius: 3,
                                        textTransform: 'none',
                                      }}
                                    >
                                      残り{uncategorized.length - 3}件を表示
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            )}
                          </Box>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  // グリッド表示モード
                  <>
                    {papers.length === 0 ? (
                      <Paper 
                        sx={{ 
                          p: 4, 
                          textAlign: 'center',
                          borderRadius: 3,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                        }}
                      >
                        <MenuBookIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>論文がありません</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          PDFをアップロードして論文を翻訳してみましょう
                        </Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => navigate('/')}
                          sx={{ 
                            mt: 3, 
                            borderRadius: 3,
                            px: 3,
                            py: 1,
                            boxShadow: '0 4px 10px rgba(248, 198, 119, 0.3)',
                          }}
                        >
                          PDFをアップロード
                        </Button>
                      </Paper>
                    ) : (
                      <Grid container spacing={3}>
                        {(selectedCategory
                          ? selectedCategory === 'uncategorized'
                            ? uncategorized
                            : categories.find(c => c.id === selectedCategory)?.papers
                          : filteredPapers
                        )?.map((paper) => (
                          <Grid item xs={12} sm={6} md={4} key={paper.id}>
                            <PaperCard paper={paper} onClick={() => navigate(`/papers/${paper.id}`)} />
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </>
                )}
              </>
            )}
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default MyPapersPage;