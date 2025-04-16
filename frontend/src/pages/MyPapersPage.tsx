import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Menu,
  MenuItem,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  Tooltip,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  Autocomplete,
  SelectChangeEvent,
  OutlinedInput,
  Skeleton,
  Snackbar,
  Avatar,
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
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DoNotDisturbAltIcon from '@mui/icons-material/DoNotDisturbAlt';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import FlagIcon from '@mui/icons-material/Flag';
import SortIcon from '@mui/icons-material/Sort';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LabelIcon from '@mui/icons-material/Label';
import WorkIcon from '@mui/icons-material/Work';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import TuneIcon from '@mui/icons-material/Tune';
import CheckIcon from '@mui/icons-material/Check';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ReplayIcon from '@mui/icons-material/Replay';
import SaveIcon from '@mui/icons-material/Save';

import { useAuthStore } from '../store/authStore';
import { usePaperStore } from '../store/paperStore';
import { Paper as PaperType } from '../api/papers';

// 拡張されたPaper型を定義
interface ExtendedPaper {
  id: string;
  user_id: string;
  file_path: string;
  status: 'pending' | 'metadata_extracted' | 'processing' | 'completed' | 'error' | 'reported' | 'problem';
  uploaded_at: {
    toMillis: () => number;
  };
  completed_at: any;
  metadata?: {
    title?: string;
    authors?: Array<{name: string; affiliation?: string}>;
    year?: number;
    journal?: string;
    doi?: string;
    keywords?: string[];
    abstract?: string;
  };
  chapters?: Array<{
    chapter_number: number;
    title: string;
    start_page: number;
    end_page: number;
  }>;
  summary?: string;
  required_knowledge?: string;
  translated_text?: string;
  translated_text_path?: string;
  related_papers?: any[];
  error_message?: string;
  progress?: number;
  
  // 追加のカスタムフィールド
  readStatus?: 'unread' | 'reading' | 'completed' | 'important' | 'review_later';
  projects?: string[];
  collections?: string[];
  notes?: string;
  favorite?: boolean;
  lastOpened?: number;
  customTags?: string[];
  
  createdAt?: {
    toMillis: () => number;
  };
}

// ユーザー設定の型
interface UserSettings {
  defaultView: ViewMode;
  cardDisplayOptions: {
    showAuthors: boolean;
    showYear: boolean;
    showJournal: boolean;
    showKeywords: boolean;
    showAbstract: boolean;
    showStatus: boolean;
    showProgress: boolean;
  };
  sortOption: SortOption;
  sortDirection: 'asc' | 'desc';
}

// ソートオプションの型
type SortOption = 'uploaded' | 'title' | 'year' | 'journal' | 'lastOpened' | 'status';

// 表示モードの型
type ViewMode = 'grid' | 'list' | 'compact' | 'hierarchy' | 'dashboard';

// タブの値の型
type TabValue = 'all' | 'projects' | 'collections' | 'status' | 'recent';

// プロジェクトの型
interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: number;
}

// コレクションの型
interface Collection {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt: number;
}

// 検索フィルターの型
interface SearchFilters {
  authors: string[];
  years: number[];
  journals: string[];
  keywords: string[];
  readStatus: ('unread' | 'reading' | 'completed' | 'important' | 'review_later')[];
  projects: string[];
  collections: string[];
  favorite: boolean | null;
}

// ローカルストレージキー
const STORAGE_KEY_SETTINGS = 'smart_paper_user_settings';
const STORAGE_KEY_PROJECTS = 'smart_paper_projects';
const STORAGE_KEY_COLLECTIONS = 'smart_paper_collections';
const STORAGE_KEY_PAPER_META = 'smart_paper_paper_metadata';

// デフォルトのユーザー設定
const defaultSettings: UserSettings = {
  defaultView: 'grid',
  cardDisplayOptions: {
    showAuthors: true,
    showYear: true,
    showJournal: true,
    showKeywords: true,
    showAbstract: false,
    showStatus: true,
    showProgress: true,
  },
  sortOption: 'uploaded',
  sortDirection: 'desc',
};

// Paper用のステータスバッジコンポーネント
const StatusBadge: React.FC<{ status: string, small?: boolean }> = ({ status, small }) => {
  const getStatusInfo = (statusValue: string) => {
    switch (statusValue) {
      case 'unread':
        return { label: '未読', icon: <BookmarkBorderIcon fontSize={small ? 'small' : 'medium'} />, color: 'default' };
      case 'reading':
        return { label: '読書中', icon: <BookmarkIcon fontSize={small ? 'small' : 'medium'} />, color: 'primary' };
      case 'completed':
        return { label: '読了', icon: <CheckCircleIcon fontSize={small ? 'small' : 'medium'} />, color: 'success' };
      case 'important':
        return { label: '重要', icon: <PriorityHighIcon fontSize={small ? 'small' : 'medium'} />, color: 'error' };
      case 'review_later':
        return { label: '後で再読', icon: <ReplayIcon fontSize={small ? 'small' : 'medium'} />, color: 'secondary' };
      default:
        return { label: '未設定', icon: <BookmarkBorderIcon fontSize={small ? 'small' : 'medium'} />, color: 'default' };
    }
  };

  const statusInfo = getStatusInfo(status);

  return (
    <Chip
      size={small ? "small" : "medium"}
      icon={statusInfo.icon}
      label={statusInfo.label}
      color={statusInfo.color as any}
      sx={{
        borderRadius: '50px',
        fontWeight: 600,
        '& .MuiChip-label': {
          px: small ? 0.5 : 1,
        }
      }}
    />
  );
};

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

// CategoryCardのインターフェースを定義
interface CategoryCardProps {
  title: string;
  count: number;
  isSelected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  color?: string;
  // 新しいプロパティをオプショナルにする
  onEdit?: () => void;
  onDelete?: () => void;
}

// SANGO風のカテゴリーカードコンポーネント
const CategoryCard = ({ 
  title, 
  count, 
  isSelected, 
  onSelect,
  icon,
  color,
  onEdit,
  onDelete
}: { 
  title: string; 
  count: number; 
  isSelected: boolean; 
  onSelect: () => void;
  icon?: React.ReactNode;
  color?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) => {
  const theme = useTheme();
  const customColor = color || theme.palette.primary.main;
  
  // 3点メニューの状態管理
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);
  
  // メニューを開く処理
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // カード自体のクリックイベントを阻止
    setMenuAnchorEl(event.currentTarget);
  };
  
  // メニューを閉じる処理
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  // 編集ボタンのクリックハンドラー
  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation(); // 伝播を止める
    handleMenuClose();
    if (onEdit) onEdit();
  };
  
  // 削除ボタンのクリックハンドラー
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation(); // 伝播を止める
    handleMenuClose();
    if (onDelete) onDelete();
  };
  
  return (
    <Card 
      onClick={onSelect}
      sx={{
        mb: 1.5,
        borderRadius: 3,
        boxShadow: isSelected 
          ? `0 0 0 2px ${customColor}, 0 8px 20px rgba(0,0,0,0.1)` 
          : '0 4px 12px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: isSelected 
            ? `0 0 0 2px ${customColor}, 0 10px 25px rgba(0,0,0,0.15)` 
            : '0 8px 20px rgba(0,0,0,0.1)',
        },
        bgcolor: isSelected ? alpha(customColor, 0.05) : 'background.paper',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {icon ? (
              <Box sx={{ color: isSelected ? customColor : 'text.secondary', mr: 1.5 }}>
                {icon}
              </Box>
            ) : (
              <LibraryBooksIcon 
                color={isSelected ? 'primary' : 'action'} 
                sx={{ mr: 1.5, fontSize: 20, color: isSelected ? customColor : undefined }} 
              />
            )}
            <Typography 
              variant="body1" 
              sx={{ 
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? customColor : 'text.primary',
              }}
            >
              {title}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* 数値カウント */}
            <Chip 
              label={count} 
              size="small" 
              sx={{ 
                minWidth: 40,
                fontWeight: 600,
                bgcolor: isSelected ? customColor : undefined,
                color: isSelected ? 'white' : undefined,
                mr: 1, // 3点メニューとの間隔を追加
              }} 
            />
            
            {/* 3点メニューボタン（編集/削除可能な場合のみ表示） */}
            {(onEdit || onDelete) && (
              <IconButton
                size="small"
                aria-label="more"
                aria-controls={menuOpen ? 'category-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={menuOpen ? 'true' : undefined}
                onClick={handleMenuOpen}
                sx={{ p: 0.5 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
            
            {/* 編集/削除メニュー */}
            <Menu
              id="category-menu"
              anchorEl={menuAnchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              onClick={(e) => e.stopPropagation()} // メニュークリックでカードのクリックを阻止
              MenuListProps={{
                'aria-labelledby': 'more-button',
              }}
            >
              {onEdit && (
                <MenuItem onClick={handleEdit}>
                  <ListItemIcon>
                    <EditIcon fontSize="small" />
                  </ListItemIcon>
                  編集
                </MenuItem>
              )}
              {onDelete && (
                <MenuItem onClick={handleDelete}>
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" />
                  </ListItemIcon>
                  削除
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// SANGO風の論文カードコンポーネント
const PaperCard = ({ 
  paper, 
  onClick, 
  onStatusChange, 
  onProjectAdd, 
  onCollectionAdd,
  onFavoriteToggle,
  displayOptions,
  projects,
  collections,
  viewMode
}: { 
  paper: ExtendedPaper; 
  onClick: () => void; 
  onStatusChange: (paperId: string, status: string) => void;
  onProjectAdd: (paperId: string, projectId: string) => void;
  onCollectionAdd: (paperId: string, collectionId: string) => void;
  onFavoriteToggle: (paperId: string) => void;
  displayOptions: UserSettings['cardDisplayOptions'];
  projects: Project[];
  collections: Collection[];
  viewMode: ViewMode;
}) => {
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [statusAnchorEl, setStatusAnchorEl] = useState<null | HTMLElement>(null);
  const [projectAnchorEl, setProjectAnchorEl] = useState<null | HTMLElement>(null);
  const [collectionAnchorEl, setCollectionAnchorEl] = useState<null | HTMLElement>(null);
  
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
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = (_: {}, reason: "backdropClick" | "escapeKeyDown") => {
    setMenuAnchorEl(null);
  };
  
  const handleMenuItemClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuAnchorEl(null);
  };
  
  const handleStatusMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setStatusAnchorEl(event.currentTarget);
  };
  
  const handleStatusMenuClose = (_: {}, reason: "backdropClick" | "escapeKeyDown") => {
    setStatusAnchorEl(null);
  };
  
  const handleProjectMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setProjectAnchorEl(event.currentTarget);
  };
  
  const handleProjectMenuClose = (_: {}, reason: "backdropClick" | "escapeKeyDown") => {
    setProjectAnchorEl(null);
  };
  
  const handleCollectionMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setCollectionAnchorEl(event.currentTarget);
  };
  
  const handleCollectionMenuClose = (_: {}, reason: "backdropClick" | "escapeKeyDown") => {
    setCollectionAnchorEl(null);
  };
  
  const handleStatusChange = (status: string) => (event: React.MouseEvent) => {
    event.stopPropagation();
    onStatusChange(paper.id, status);
    handleStatusMenuClose({}, "backdropClick");
  };
  
  const handleProjectAdd = (projectId: string) => (event: React.MouseEvent) => {
    event.stopPropagation();
    onProjectAdd(paper.id, projectId);
    handleProjectMenuClose({}, "backdropClick");
  };
  
  const handleCollectionAdd = (collectionId: string) => (event: React.MouseEvent) => {
    event.stopPropagation();
    onCollectionAdd(paper.id, collectionId);
    handleCollectionMenuClose({}, "backdropClick");
  };
  
  const handleFavoriteToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    onFavoriteToggle(paper.id);
  };
  
  // 論文が所属するプロジェクトを取得
  const paperProjects = projects.filter(p => paper.projects?.includes(p.id));
  
  // 論文が所属するコレクションを取得
  const paperCollections = collections.filter(c => paper.collections?.includes(c.id));
  
  // コンパクトモードの場合は簡略化したカードを表示
  if (viewMode === 'compact') {
    return (
      <Card 
        sx={{ 
          display: 'flex',
          borderRadius: 2,
          mb: 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }
        }}
      >
        <CardActionArea 
          onClick={onClick}
          sx={{ 
            display: 'flex', 
            justifyContent: 'flex-start', 
            alignItems: 'center',
            p: 1.5,
            width: '100%',
          }}
        >
          <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DescriptionIcon color="action" />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography noWrap variant="body1" fontWeight={500} title={paper.metadata?.title}>
              {paper.metadata?.title || '無題の論文'}
            </Typography>
            {displayOptions.showAuthors && paper.metadata?.authors && (
              <Typography noWrap variant="body2" color="text.secondary">
                {paper.metadata.authors.map(a => a.name).join(', ')}
              </Typography>
            )}
          </Box>
          <Box sx={{ ml: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {paper.favorite && (
              <Tooltip title="お気に入り">
                <StarIcon fontSize="small" color="warning" />
              </Tooltip>
            )}
            {paper.readStatus && displayOptions.showStatus && (
              <StatusBadge status={paper.readStatus} small />
            )}
          </Box>
        </CardActionArea>
      </Card>
    );
  }
  
  // リストモードの場合は横長のカードを表示
  if (viewMode === 'list') {
    return (
      <Card 
        sx={{ 
          display: 'flex',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease',
          mb: 2,
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
          }
        }}
      >
        <CardActionArea 
          onClick={onClick}
          sx={{ 
            display: 'flex', 
            justifyContent: 'flex-start', 
            alignItems: 'stretch',
            width: '100%',
          }}
        >
          <Box 
            sx={{ 
              width: 8, 
              bgcolor: paper.readStatus === 'completed' 
                ? 'success.main' 
                : paper.readStatus === 'important' 
                  ? 'error.main'
                  : paper.readStatus === 'reading'
                    ? 'primary.main'
                    : paper.readStatus === 'review_later'
                      ? 'secondary.main'
                      : 'grey.300'
            }} 
          />
          <Box sx={{ display: 'flex', flexGrow: 1, p: 2 }}>
            <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Avatar 
                sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                }}
              >
                <ArticleIcon />
              </Avatar>
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="h6" fontWeight={600} noWrap title={paper.metadata?.title}>
                  {paper.metadata?.title || '無題の論文'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {paper.favorite && (
                    <Tooltip title="お気に入り">
                      <StarIcon fontSize="small" color="warning" />
                    </Tooltip>
                  )}
                  <IconButton 
                    size="small" 
                    onClick={handleMenuOpen}
                    sx={{ ml: 1 }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              
              {displayOptions.showAuthors && paper.metadata?.authors && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <SchoolIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary', fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {paper.metadata.authors.map(a => a.name).join(', ')}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                {displayOptions.showJournal && paper.metadata?.journal && (
                  <Chip
                    size="small"
                    icon={<LocalLibraryIcon fontSize="small" />}
                    label={paper.metadata.journal}
                    variant="outlined"
                  />
                )}
                
                {displayOptions.showYear && paper.metadata?.year && (
                  <Chip
                    size="small"
                    icon={<CalendarTodayIcon fontSize="small" />}
                    label={paper.metadata.year}
                    variant="outlined"
                  />
                )}
                
                {paper.readStatus && displayOptions.showStatus && (
                  <StatusBadge status={paper.readStatus} small />
                )}
                
                {paperProjects.length > 0 && (
                  <Tooltip title={`プロジェクト: ${paperProjects.map(p => p.name).join(', ')}`}>
                    <Chip
                      size="small"
                      icon={<WorkIcon fontSize="small" />}
                      label={paperProjects.length === 1 ? paperProjects[0].name : `${paperProjects.length}件`}
                      variant="outlined"
                      color="secondary"
                    />
                  </Tooltip>
                )}
                
                {paperCollections.length > 0 && (
                  <Tooltip title={`コレクション: ${paperCollections.map(c => c.name).join(', ')}`}>
                    <Chip
                      size="small"
                      icon={<FolderSpecialIcon fontSize="small" />}
                      label={paperCollections.length === 1 ? paperCollections[0].name : `${paperCollections.length}件`}
                      variant="outlined"
                      color="info"
                    />
                  </Tooltip>
                )}
                
                {paper.status === 'processing' && paper.progress && displayOptions.showProgress && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={paper.progress} 
                      sx={{ 
                        width: 60,
                        height: 4, 
                        borderRadius: 2,
                        mr: 0.5
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {paper.progress}%
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </CardActionArea>
        
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuItemClick}
        >
          <MenuItem onClick={handleStatusMenuOpen}>
            <ListItemIcon>
              <BookmarkIcon fontSize="small" />
            </ListItemIcon>
            読書状態を変更
          </MenuItem>
          <MenuItem onClick={handleProjectMenuOpen}>
            <ListItemIcon>
              <WorkIcon fontSize="small" />
            </ListItemIcon>
            プロジェクトに追加
          </MenuItem>
          <MenuItem onClick={handleCollectionMenuOpen}>
            <ListItemIcon>
              <FolderSpecialIcon fontSize="small" />
            </ListItemIcon>
            コレクションに追加
          </MenuItem>
          <MenuItem onClick={handleFavoriteToggle}>
            <ListItemIcon>
              {paper.favorite ? (
                <StarIcon fontSize="small" color="warning" />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </ListItemIcon>
            {paper.favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
          </MenuItem>
        </Menu>
        
        <Menu
          anchorEl={statusAnchorEl}
          open={Boolean(statusAnchorEl)}
          onClose={handleStatusMenuClose}
          onClick={handleMenuItemClick}
        >
          <MenuItem onClick={handleStatusChange('unread')}>
            <ListItemIcon>
              <BookmarkBorderIcon fontSize="small" />
            </ListItemIcon>
            未読
          </MenuItem>
          <MenuItem onClick={handleStatusChange('reading')}>
            <ListItemIcon>
              <BookmarkIcon fontSize="small" color="primary" />
            </ListItemIcon>
            読書中
          </MenuItem>
          <MenuItem onClick={handleStatusChange('completed')}>
            <ListItemIcon>
              <CheckCircleIcon fontSize="small" color="success" />
            </ListItemIcon>
            読了
          </MenuItem>
          <MenuItem onClick={handleStatusChange('important')}>
            <ListItemIcon>
              <PriorityHighIcon fontSize="small" color="error" />
            </ListItemIcon>
            重要
          </MenuItem>
          <MenuItem onClick={handleStatusChange('review_later')}>
            <ListItemIcon>
              <ReplayIcon fontSize="small" color="secondary" />
            </ListItemIcon>
            後で再読
          </MenuItem>
        </Menu>
        
        <Menu
          anchorEl={projectAnchorEl}
          open={Boolean(projectAnchorEl)}
          onClose={handleProjectMenuClose}
          onClick={handleMenuItemClick}
        >
          {projects.length > 0 ? (
            projects.map(project => (
              <MenuItem 
                key={project.id} 
                onClick={handleProjectAdd(project.id)}
                disabled={paper.projects?.includes(project.id)}
              >
                <ListItemIcon>
                  {paper.projects?.includes(project.id) ? (
                    <CheckIcon fontSize="small" sx={{ color: project.color }} />
                  ) : (
                    <WorkIcon fontSize="small" sx={{ color: project.color }} />
                  )}
                </ListItemIcon>
                {project.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>
              プロジェクトがありません
            </MenuItem>
          )}
        </Menu>
        
        <Menu
          anchorEl={collectionAnchorEl}
          open={Boolean(collectionAnchorEl)}
          onClose={handleCollectionMenuClose}
          onClick={handleMenuItemClick}
        >
          {collections.length > 0 ? (
            collections.map(collection => (
              <MenuItem 
                key={collection.id} 
                onClick={handleCollectionAdd(collection.id)}
                disabled={paper.collections?.includes(collection.id)}
              >
                <ListItemIcon>
                  {paper.collections?.includes(collection.id) ? (
                    <CheckIcon fontSize="small" sx={{ color: collection.color }} />
                  ) : (
                    <FolderSpecialIcon fontSize="small" sx={{ color: collection.color }} />
                  )}
                </ListItemIcon>
                {collection.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>
              コレクションがありません
            </MenuItem>
          )}
        </Menu>
      </Card>
    );
  }
  
  // デフォルトのグリッドモード用カード
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
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 15px 30px rgba(0,0,0,0.12)',
          '& .paper-card-actions': {
            opacity: 1,
          }
        }
      }}
    >
      {/* 右上のアクションボタン - ホバー時に表示 */}
      <Box 
        className="paper-card-actions"
        sx={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          zIndex: 1, 
          display: 'flex',
          opacity: 0,
          transition: 'opacity 0.2s ease-in-out',
          bgcolor: 'background.paper',
          borderRadius: 20,
          boxShadow: 2,
          p: 0.5
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title={paper.favorite ? "お気に入りから削除" : "お気に入りに追加"}>
          <IconButton size="small" onClick={handleFavoriteToggle}>
            {paper.favorite ? <StarIcon color="warning" /> : <StarBorderIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title="読書状態を変更">
          <IconButton size="small" onClick={handleStatusMenuOpen}>
            <BookmarkAddIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="詳細メニュー">
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      <CardActionArea 
        onClick={onClick}
        sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'stretch',
          height: '100%'
        }}
      >
        <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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
          
          {displayOptions.showAuthors && paper.metadata?.authors && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SchoolIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
              <Typography variant="body2" color="text.secondary" noWrap>
                                      {paper.metadata?.authors?.map((a: {name: string}) => a.name).join(', ') || '著者不明'}
              </Typography>
            </Box>
          )}
          
          {displayOptions.showYear && paper.metadata?.year && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <ArticleIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {paper.metadata.year}年
              </Typography>
            </Box>
          )}
          
          {displayOptions.showJournal && paper.metadata?.journal && (
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
          
          {paper.status === 'processing' && paper.progress && displayOptions.showProgress && (
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
          
          {/* 読書状態バッジ */}
          {paper.readStatus && displayOptions.showStatus && (
            <Box sx={{ mt: 2 }}>
              <StatusBadge status={paper.readStatus} />
            </Box>
          )}
          
          {/* プロジェクトとコレクションの表示 */}
          <Box sx={{ mt: 'auto', pt: 2 }}>
            {paperProjects.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {paperProjects.slice(0, 2).map(project => (
                  <Chip
                    key={project.id}
                    size="small"
                    icon={<WorkIcon fontSize="small" />}
                    label={project.name}
                    variant="outlined"
                    sx={{ borderColor: project.color, color: project.color }}
                  />
                ))}
                {paperProjects.length > 2 && (
                  <Chip
                    size="small"
                    label={`+${paperProjects.length - 2}`}
                    variant="outlined"
                  />
                )}
              </Box>
            )}
            
            {paperCollections.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {paperCollections.slice(0, 2).map(collection => (
                  <Chip
                    key={collection.id}
                    size="small"
                    icon={<FolderSpecialIcon fontSize="small" />}
                    label={collection.name}
                    variant="outlined"
                    sx={{ borderColor: collection.color, color: collection.color }}
                  />
                ))}
                {paperCollections.length > 2 && (
                  <Chip
                    size="small"
                    label={`+${paperCollections.length - 2}`}
                    variant="outlined"
                  />
                )}
              </Box>
            )}
          </Box>
          
          {displayOptions.showKeywords && paper.metadata?.keywords && paper.metadata.keywords.length > 0 && (
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
      
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleStatusMenuOpen}>
          <ListItemIcon>
            <BookmarkIcon fontSize="small" />
          </ListItemIcon>
          読書状態を変更
        </MenuItem>
        <MenuItem onClick={handleProjectMenuOpen}>
          <ListItemIcon>
            <WorkIcon fontSize="small" />
          </ListItemIcon>
          プロジェクトに追加
        </MenuItem>
        <MenuItem onClick={handleCollectionMenuOpen}>
          <ListItemIcon>
            <FolderSpecialIcon fontSize="small" />
          </ListItemIcon>
          コレクションに追加
        </MenuItem>
        <MenuItem onClick={handleFavoriteToggle}>
          <ListItemIcon>
            {paper.favorite ? (
              <StarIcon fontSize="small" color="warning" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </ListItemIcon>
          {paper.favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
        </MenuItem>
      </Menu>
      
      <Menu
        anchorEl={statusAnchorEl}
        open={Boolean(statusAnchorEl)}
        onClose={handleStatusMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleStatusChange('unread')}>
          <ListItemIcon>
            <BookmarkBorderIcon fontSize="small" />
          </ListItemIcon>
          未読
        </MenuItem>
        <MenuItem onClick={handleStatusChange('reading')}>
          <ListItemIcon>
            <BookmarkIcon fontSize="small" color="primary" />
          </ListItemIcon>
          読書中
        </MenuItem>
        <MenuItem onClick={handleStatusChange('completed')}>
          <ListItemIcon>
            <CheckCircleIcon fontSize="small" color="success" />
          </ListItemIcon>
          読了
        </MenuItem>
        <MenuItem onClick={handleStatusChange('important')}>
          <ListItemIcon>
            <PriorityHighIcon fontSize="small" color="error" />
          </ListItemIcon>
          重要
        </MenuItem>
        <MenuItem onClick={handleStatusChange('review_later')}>
          <ListItemIcon>
            <ReplayIcon fontSize="small" color="secondary" />
          </ListItemIcon>
          後で再読
        </MenuItem>
      </Menu>
      
      <Menu
        anchorEl={projectAnchorEl}
        open={Boolean(projectAnchorEl)}
        onClose={handleProjectMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        {projects.length > 0 ? (
          projects.map(project => (
            <MenuItem 
              key={project.id} 
              onClick={handleProjectAdd(project.id)}
              disabled={paper.projects?.includes(project.id)}
            >
              <ListItemIcon>
                {paper.projects?.includes(project.id) ? (
                  <CheckIcon fontSize="small" sx={{ color: project.color }} />
                ) : (
                  <WorkIcon fontSize="small" sx={{ color: project.color }} />
                )}
              </ListItemIcon>
              {project.name}
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>
            プロジェクトがありません
          </MenuItem>
        )}
      </Menu>
      
      <Menu
        anchorEl={collectionAnchorEl}
        open={Boolean(collectionAnchorEl)}
        onClose={handleCollectionMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        {collections.length > 0 ? (
          collections.map(collection => (
            <MenuItem 
              key={collection.id} 
              onClick={handleCollectionAdd(collection.id)}
              disabled={paper.collections?.includes(collection.id)}
            >
              <ListItemIcon>
                {paper.collections?.includes(collection.id) ? (
                  <CheckIcon fontSize="small" sx={{ color: collection.color }} />
                ) : (
                  <FolderSpecialIcon fontSize="small" sx={{ color: collection.color }} />
                )}
              </ListItemIcon>
              {collection.name}
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>
            コレクションがありません
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

// コレクション追加・編集ダイアログ
const CollectionDialog = ({
  open,
  onClose,
  onSave,
  editCollection
}: {
  open: boolean;
  onClose: () => void;
  onSave: (collection: Omit<Collection, 'id' | 'createdAt'>) => void;
  editCollection?: Collection;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3f51b5');
  
  // 編集モードの場合、初期値をセット
  useEffect(() => {
    if (editCollection) {
      setName(editCollection.name);
      setDescription(editCollection.description || '');
      setColor(editCollection.color || '#3f51b5');
    } else {
      setName('');
      setDescription('');
      setColor('#3f51b5');
    }
  }, [editCollection, open]);
  
  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim(),
      color
    });
    
    onClose();
  };
  
  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
    '#ff5722', '#795548', '#607d8b'
  ];
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editCollection ? 'コレクションを編集' : '新しいコレクション'}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="コレクション名"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Typography variant="subtitle1" gutterBottom>
          カラー
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {colors.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                border: color === c ? '2px solid #000' : 'none',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={!name.trim()}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// プロジェクト追加・編集ダイアログ
const ProjectDialog = ({
  open,
  onClose,
  onSave,
  editProject
}: {
  open: boolean;
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  editProject?: Project;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3f51b5');
  
  // 編集モードの場合、初期値をセット
  useEffect(() => {
    if (editProject) {
      setName(editProject.name);
      setDescription(editProject.description || '');
      setColor(editProject.color || '#3f51b5');
    } else {
      setName('');
      setDescription('');
      setColor('#3f51b5');
    }
  }, [editProject, open]);
  
  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim(),
      color
    });
    
    onClose();
  };
  
  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
    '#ff5722', '#795548', '#607d8b'
  ];
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editProject ? 'プロジェクトを編集' : '新しいプロジェクト'}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="プロジェクト名"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Typography variant="subtitle1" gutterBottom>
          カラー
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {colors.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                border: color === c ? '2px solid #000' : 'none',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={!name.trim()}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 表示設定ダイアログ
const DisplaySettingsDialog = ({
  open,
  onClose,
  settings,
  onSave
}: {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
}) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  
  // 親コンポーネントの設定が変更されたら反映
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);
  
  const handleChange = (field: keyof UserSettings['cardDisplayOptions']) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings({
      ...localSettings,
      cardDisplayOptions: {
        ...localSettings.cardDisplayOptions,
        [field]: event.target.checked
      }
    });
  };
  
  const handleViewModeChange = (event: SelectChangeEvent<ViewMode>) => {
    setLocalSettings({
      ...localSettings,
      defaultView: event.target.value as ViewMode
    });
  };
  
  const handleSortOptionChange = (event: SelectChangeEvent<SortOption>) => {
    setLocalSettings({
      ...localSettings,
      sortOption: event.target.value as SortOption
    });
  };
  
  const handleSortDirectionChange = (event: SelectChangeEvent<'asc' | 'desc'>) => {
    setLocalSettings({
      ...localSettings,
      sortDirection: event.target.value as 'asc' | 'desc'
    });
  };
  
  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>表示設定</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            デフォルト表示モード
          </Typography>
          <FormControl fullWidth>
            <Select
              value={localSettings.defaultView}
              onChange={handleViewModeChange}
            >
              <MenuItem value="grid">カード表示</MenuItem>
              <MenuItem value="list">リスト表示</MenuItem>
              <MenuItem value="compact">コンパクト表示</MenuItem>
              <MenuItem value="hierarchy">階層表示</MenuItem>
              <MenuItem value="dashboard">ダッシュボード</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            ソート設定
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <FormControl fullWidth>
                <InputLabel>ソート項目</InputLabel>
                <Select
                  value={localSettings.sortOption}
                  onChange={handleSortOptionChange}
                  label="ソート項目"
                >
                  <MenuItem value="uploaded">アップロード日</MenuItem>
                  <MenuItem value="title">タイトル</MenuItem>
                  <MenuItem value="year">発行年</MenuItem>
                  <MenuItem value="journal">ジャーナル</MenuItem>
                  <MenuItem value="lastOpened">最終閲覧日</MenuItem>
                  <MenuItem value="status">読書状態</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel>方向</InputLabel>
                <Select
                  value={localSettings.sortDirection}
                  onChange={handleSortDirectionChange}
                  label="方向"
                >
                  <MenuItem value="asc">昇順</MenuItem>
                  <MenuItem value="desc">降順</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
        
        <Typography variant="subtitle1" gutterBottom>
          カード表示オプション
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localSettings.cardDisplayOptions.showAuthors}
                  onChange={handleChange('showAuthors')}
                />
              }
              label="著者を表示"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localSettings.cardDisplayOptions.showYear}
                  onChange={handleChange('showYear')}
                />
              }
              label="発行年を表示"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localSettings.cardDisplayOptions.showJournal}
                  onChange={handleChange('showJournal')}
                />
              }
              label="ジャーナルを表示"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localSettings.cardDisplayOptions.showKeywords}
                  onChange={handleChange('showKeywords')}
                />
              }
              label="キーワードを表示"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localSettings.cardDisplayOptions.showStatus}
                  onChange={handleChange('showStatus')}
                />
              }
              label="読書状態を表示"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localSettings.cardDisplayOptions.showProgress}
                  onChange={handleChange('showProgress')}
                />
              }
              label="進捗バーを表示"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 高度な検索ダイアログ
const AdvancedSearchDialog = ({
  open,
  onClose,
  onSearch,
  papers,
  projects,
  collections
}: {
  open: boolean;
  onClose: () => void;
  onSearch: (filters: SearchFilters) => void;
  papers: ExtendedPaper[];
  projects: Project[];
  collections: Collection[];
}) => {
  // フィルター状態
  const [filters, setFilters] = useState<SearchFilters>({
    authors: [],
    years: [],
    journals: [],
    keywords: [],
    readStatus: [],
    projects: [],
    collections: [],
    favorite: null
  });
  
  // 利用可能なオプションをPaperから抽出
  const availableAuthors = useMemo(() => {
    const authors = new Set<string>();
    papers.forEach(paper => {
      paper.metadata?.authors?.forEach((author: {name: string; affiliation?: string}) => {
        if (author.name) authors.add(author.name);
      });
    });
    return Array.from(authors).sort();
  }, [papers]);
  
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    papers.forEach(paper => {
      if (paper.metadata?.year) years.add(paper.metadata.year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [papers]);
  
  const availableJournals = useMemo(() => {
    const journals = new Set<string>();
    papers.forEach(paper => {
      if (paper.metadata?.journal) journals.add(paper.metadata.journal);
    });
    return Array.from(journals).sort();
  }, [papers]);
  
  const availableKeywords = useMemo(() => {
    const keywords = new Set<string>();
    papers.forEach(paper => {
      paper.metadata?.keywords?.forEach((keyword: string) => {
        keywords.add(keyword);
      });
    });
    return Array.from(keywords).sort();
  }, [papers]);
  
  const handleChange = (field: keyof SearchFilters) => (event: any, newValue: any) => {
    setFilters({
      ...filters,
      [field]: newValue
    });
  };
  
  const handleReadStatusChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      readStatus: typeof value === 'string' ? [value as any] : value as any[]
    });
  };
  
  const handleProjectsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      projects: typeof value === 'string' ? [value] : value as string[]
    });
  };
  
  const handleCollectionsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      collections: typeof value === 'string' ? [value] : value as string[]
    });
  };
  
  const handleFavoriteChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      favorite: value === 'true' ? true : value === 'false' ? false : null
    });
  };
  
  const handleSearch = () => {
    onSearch(filters);
    onClose();
  };
  
  const handleClearAll = () => {
    setFilters({
      authors: [],
      years: [],
      journals: [],
      keywords: [],
      readStatus: [],
      projects: [],
      collections: [],
      favorite: null
    });
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon />
          高度な検索
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Autocomplete
              multiple
              options={availableAuthors}
              value={filters.authors}
              onChange={handleChange('authors')}
              renderInput={(params) => (
                <TextField {...params} label="著者で検索" fullWidth variant="outlined" />
              )}
              sx={{ mb: 3 }}
            />
            
            <Autocomplete
              multiple
              options={availableYears}
              value={filters.years}
              onChange={handleChange('years')}
              renderInput={(params) => (
                <TextField {...params} label="発行年で検索" fullWidth variant="outlined" />
              )}
              sx={{ mb: 3 }}
            />
            
            <Autocomplete
              multiple
              options={availableJournals}
              value={filters.journals}
              onChange={handleChange('journals')}
              renderInput={(params) => (
                <TextField {...params} label="ジャーナルで検索" fullWidth variant="outlined" />
              )}
              sx={{ mb: 3 }}
            />
            
            <Autocomplete
              multiple
              options={availableKeywords}
              value={filters.keywords}
              onChange={handleChange('keywords')}
              renderInput={(params) => (
                <TextField {...params} label="キーワードで検索" fullWidth variant="outlined" />
              )}
              sx={{ mb: 3 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>読書状態</InputLabel>
              <Select
                multiple
                value={filters.readStatus}
                onChange={handleReadStatusChange}
                input={<OutlinedInput label="読書状態" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={
                          value === 'unread' ? '未読' :
                          value === 'reading' ? '読書中' :
                          value === 'completed' ? '読了' :
                          value === 'important' ? '重要' :
                          value === 'review_later' ? '後で再読' : value
                        } 
                        size="small" 
                      />
                    ))}
                  </Box>
                )}
              >
                <MenuItem value="unread">未読</MenuItem>
                <MenuItem value="reading">読書中</MenuItem>
                <MenuItem value="completed">読了</MenuItem>
                <MenuItem value="important">重要</MenuItem>
                <MenuItem value="review_later">後で再読</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>プロジェクト</InputLabel>
              <Select
                multiple
                value={filters.projects}
                onChange={handleProjectsChange}
                input={<OutlinedInput label="プロジェクト" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const project = projects.find(p => p.id === value);
                      return (
                        <Chip 
                          key={value} 
                          label={project?.name || value} 
                          size="small" 
                          sx={{ 
                            color: project?.color,
                            borderColor: project?.color,
                          }}
                          variant="outlined"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: project.color,
                          mr: 1 
                        }} 
                      />
                      {project.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>コレクション</InputLabel>
              <Select
                multiple
                value={filters.collections}
                onChange={handleCollectionsChange}
                input={<OutlinedInput label="コレクション" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const collection = collections.find(c => c.id === value);
                      return (
                        <Chip 
                          key={value} 
                          label={collection?.name || value} 
                          size="small" 
                          sx={{ 
                            color: collection?.color,
                            borderColor: collection?.color,
                          }}
                          variant="outlined"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {collections.map((collection) => (
                  <MenuItem key={collection.id} value={collection.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: collection.color,
                          mr: 1 
                        }} 
                      />
                      {collection.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>お気に入り</InputLabel>
              <Select
                value={filters.favorite === null ? '' : filters.favorite.toString()}
                onChange={handleFavoriteChange}
                input={<OutlinedInput label="お気に入り" />}
              >
                <MenuItem value=""><em>指定なし</em></MenuItem>
                <MenuItem value="true">お気に入り済み</MenuItem>
                <MenuItem value="false">お気に入りでない</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClearAll} color="secondary">
          すべてクリア
        </Button>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSearch} variant="contained">
          検索
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// メイン機能 - マイ論文ページ
const MyPapersPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // 検索とフィルタリング
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  
  // 表示設定
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showMobileCategories, setShowMobileCategories] = useState(false);
  const [currentTab, setCurrentTab] = useState<TabValue>('all');
  
  // ユーザー設定
  const [userSettings, setUserSettings] = useState<UserSettings>(defaultSettings);
  
  // ダイアログ状態
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [editingCollection, setEditingCollection] = useState<Collection | undefined>(undefined);
  
  // サイドメニューの状態
  const [isProjectsMenuOpen, setIsProjectsMenuOpen] = useState(true);
  const [isCollectionsMenuOpen, setIsCollectionsMenuOpen] = useState(true);
  const [isStatusesMenuOpen, setIsStatusesMenuOpen] = useState(true);
  
  // 通知メッセージ
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  
  // 検索フィルター
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    authors: [],
    years: [],
    journals: [],
    keywords: [],
    readStatus: [],
    projects: [],
    collections: [],
    favorite: null
  });
  
  // ユーザー状態
  const { user } = useAuthStore();
  
  // 論文状態
  const { papers, loading, error, fetchUserPapers } = usePaperStore();
  
  // プロジェクトとコレクションの状態
  const [projects, setProjects] = useState<Project[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  
  // 拡張された論文データ（メタデータ付き）
  const [extendedPapers, setExtendedPapers] = useState<ExtendedPaper[]>([]);
  
  // 初期読み込み
  useEffect(() => {
    if (user) {
      fetchUserPapers(user.uid);
      
      // 保存されているユーザー設定を読み込む
      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          setUserSettings(parsedSettings);
          setViewMode(parsedSettings.defaultView);
        } catch (e) {
          console.error('Failed to parse saved settings:', e);
        }
      }
      
      // 保存されているプロジェクトを読み込む
      const savedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (savedProjects) {
        try {
          const parsedProjects = JSON.parse(savedProjects);
          setProjects(parsedProjects);
        } catch (e) {
          console.error('Failed to parse saved projects:', e);
        }
      } else {
        // デフォルトのプロジェクトを設定
        const defaultProjects: Project[] = [
          { id: 'thesis', name: '論文執筆', color: '#f44336', createdAt: Date.now() },
          { id: 'review', name: '文献レビュー', color: '#4caf50', createdAt: Date.now() },
        ];
        setProjects(defaultProjects);
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(defaultProjects));
      }
      
      // 保存されているコレクションを読み込む
      const savedCollections = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
      if (savedCollections) {
        try {
          const parsedCollections = JSON.parse(savedCollections);
          setCollections(parsedCollections);
        } catch (e) {
          console.error('Failed to parse saved collections:', e);
        }
      } else {
        // デフォルトのコレクションを設定
        const defaultCollections: Collection[] = [
          { id: 'favorites', name: 'お気に入り', color: '#ffc107', createdAt: Date.now() },
          { id: 'later', name: '後で読む', color: '#607d8b', createdAt: Date.now() },
        ];
        setCollections(defaultCollections);
        localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(defaultCollections));
      }
      
      // 保存されている論文メタデータを読み込む
      const savedPaperMeta = localStorage.getItem(STORAGE_KEY_PAPER_META);
      if (savedPaperMeta) {
        try {
          const parsedPaperMeta = JSON.parse(savedPaperMeta);
          // 後で論文データとマージする
          setPaperMetadata(parsedPaperMeta);
        } catch (e) {
          console.error('Failed to parse saved paper metadata:', e);
        }
      }
    }
  }, [user, fetchUserPapers]);
  
  // 論文データが変更されたらメタデータとマージ
  const [paperMetadata, setPaperMetadata] = useState<Record<string, Partial<ExtendedPaper>>>({});
  
  useEffect(() => {
    if (papers.length > 0) {
      // ベースの論文データにメタデータをマージ
      const extended = papers.map(paper => {
        const meta = paperMetadata[paper.id] || {};
        return {
          ...paper,
          ...meta,
          readStatus: meta.readStatus || 'unread',
          projects: meta.projects || [],
          collections: meta.collections || [],
          favorite: meta.favorite || false,
          lastOpened: meta.lastOpened || 0,
          customTags: meta.customTags || [],
        } as ExtendedPaper;
      });
      
      setExtendedPapers(extended);
    }
  }, [papers, paperMetadata]);
  
  // 論文のメタデータを更新する関数
  const updatePaperMetadata = useCallback((paperId: string, data: Partial<ExtendedPaper>) => {
    setPaperMetadata(prev => {
      const updated = {
        ...prev,
        [paperId]: {
          ...(prev[paperId] || {}),
          ...data
        }
      };
      
      // ローカルストレージに保存
      localStorage.setItem(STORAGE_KEY_PAPER_META, JSON.stringify(updated));
      
      return updated;
    });
  }, []);
  
  // 読書状態の変更
  const handleStatusChange = useCallback((paperId: string, status: string) => {
    updatePaperMetadata(paperId, { readStatus: status as any });
    setSnackbarMessage(`読書状態を「${
      status === 'unread' ? '未読' :
      status === 'reading' ? '読書中' :
      status === 'completed' ? '読了' :
      status === 'important' ? '重要' :
      status === 'review_later' ? '後で再読' : status
    }」に変更しました`);
    setIsSnackbarOpen(true);
  }, [updatePaperMetadata]);
  
  // プロジェクトの追加・削除
  const handleProjectAdd = useCallback((paperId: string, projectId: string) => {
    const paper = extendedPapers.find(p => p.id === paperId);
    if (!paper) return;
    
    const currentProjects = paper.projects || [];
    
    // すでに追加済みなら削除、なければ追加
    if (currentProjects.includes(projectId)) {
      updatePaperMetadata(paperId, { 
        projects: currentProjects.filter(id => id !== projectId) 
      });
      setSnackbarMessage('プロジェクトから論文を削除しました');
    } else {
      updatePaperMetadata(paperId, { 
        projects: [...currentProjects, projectId] 
      });
      const project = projects.find(p => p.id === projectId);
      setSnackbarMessage(`「${project?.name || 'プロジェクト'}」に論文を追加しました`);
    }
    setIsSnackbarOpen(true);
  }, [extendedPapers, projects, updatePaperMetadata]);
  
  // コレクションの追加・削除
  const handleCollectionAdd = useCallback((paperId: string, collectionId: string) => {
    const paper = extendedPapers.find(p => p.id === paperId);
    if (!paper) return;
    
    const currentCollections = paper.collections || [];
    
    // すでに追加済みなら削除、なければ追加
    if (currentCollections.includes(collectionId)) {
      updatePaperMetadata(paperId, { 
        collections: currentCollections.filter(id => id !== collectionId) 
      });
      setSnackbarMessage('コレクションから論文を削除しました');
    } else {
      updatePaperMetadata(paperId, { 
        collections: [...currentCollections, collectionId] 
      });
      const collection = collections.find(c => c.id === collectionId);
      setSnackbarMessage(`「${collection?.name || 'コレクション'}」に論文を追加しました`);
    }
    setIsSnackbarOpen(true);
  }, [extendedPapers, collections, updatePaperMetadata]);
  
  // お気に入りの切り替え
  const handleFavoriteToggle = useCallback((paperId: string) => {
    const paper = extendedPapers.find(p => p.id === paperId);
    if (!paper) return;
    
    updatePaperMetadata(paperId, { favorite: !paper.favorite });
    setSnackbarMessage(paper.favorite 
      ? 'お気に入りから削除しました' 
      : 'お気に入りに追加しました'
    );
    setIsSnackbarOpen(true);
  }, [extendedPapers, updatePaperMetadata]);
  
  // 論文を開く際にlastOpenedを更新
  const handlePaperClick = useCallback((paperId: string) => {
    updatePaperMetadata(paperId, { lastOpened: Date.now() });
    navigate(`/papers/${paperId}`);
  }, [navigate, updatePaperMetadata]);
  
  // 新しいプロジェクトを追加
  const handleAddProject = useCallback((projectData: Omit<Project, 'id' | 'createdAt'>) => {
    const newProject: Project = {
      ...projectData,
      id: `project-${Date.now()}`,
      createdAt: Date.now()
    };
    
    setProjects(prev => {
      const updated = [...prev, newProject];
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
      return updated;
    });
    
    setSnackbarMessage(`プロジェクト「${projectData.name}」を作成しました`);
    setIsSnackbarOpen(true);
  }, []);
  
  // プロジェクトを更新
  const handleUpdateProject = useCallback((projectData: Omit<Project, 'id' | 'createdAt'>) => {
    if (!editingProject) return;
    
    setProjects(prev => {
      const updated = prev.map(p => 
        p.id === editingProject.id 
          ? { ...p, ...projectData } 
          : p
      );
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
      return updated;
    });
    
    setSnackbarMessage(`プロジェクト「${projectData.name}」を更新しました`);
    setIsSnackbarOpen(true);
  }, [editingProject]);
  
  // プロジェクトを削除
  const handleDeleteProject = useCallback((projectId: string) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== projectId);
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updated));
      return updated;
    });
    
    // 関連する論文のプロジェクト参照も削除
    setExtendedPapers(prev => 
      prev.map(paper => {
        if (paper.projects?.includes(projectId)) {
          const updatedProjects = paper.projects.filter(id => id !== projectId);
          updatePaperMetadata(paper.id, { projects: updatedProjects });
          return { ...paper, projects: updatedProjects };
        }
        return paper;
      })
    );
    
    setSnackbarMessage('プロジェクトを削除しました');
    setIsSnackbarOpen(true);
  }, [updatePaperMetadata]);
  
  // 新しいコレクションを追加
  const handleAddCollection = useCallback((collectionData: Omit<Collection, 'id' | 'createdAt'>) => {
    const newCollection: Collection = {
      ...collectionData,
      id: `collection-${Date.now()}`,
      createdAt: Date.now()
    };
    
    setCollections(prev => {
      const updated = [...prev, newCollection];
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(updated));
      return updated;
    });
    
    setSnackbarMessage(`コレクション「${collectionData.name}」を作成しました`);
    setIsSnackbarOpen(true);
  }, []);
  
  // コレクションを更新
  const handleUpdateCollection = useCallback((collectionData: Omit<Collection, 'id' | 'createdAt'>) => {
    if (!editingCollection) return;
    
    setCollections(prev => {
      const updated = prev.map(c => 
        c.id === editingCollection.id 
          ? { ...c, ...collectionData } 
          : c
      );
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(updated));
      return updated;
    });
    
    setSnackbarMessage(`コレクション「${collectionData.name}」を更新しました`);
    setIsSnackbarOpen(true);
  }, [editingCollection]);
  
  // コレクションを削除
  const handleDeleteCollection = useCallback((collectionId: string) => {
    setCollections(prev => {
      const updated = prev.filter(c => c.id !== collectionId);
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(updated));
      return updated;
    });
    
    // 関連する論文のコレクション参照も削除
    setExtendedPapers(prev => 
      prev.map(paper => {
        if (paper.collections?.includes(collectionId)) {
          const updatedCollections = paper.collections.filter(id => id !== collectionId);
          updatePaperMetadata(paper.id, { collections: updatedCollections });
          return { ...paper, collections: updatedCollections };
        }
        return paper;
      })
    );
    
    setSnackbarMessage('コレクションを削除しました');
    setIsSnackbarOpen(true);
  }, [updatePaperMetadata]);
  
  // 表示設定を保存
  const handleSaveSettings = useCallback((newSettings: UserSettings) => {
    setUserSettings(newSettings);
    setViewMode(newSettings.defaultView);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    
    setSnackbarMessage('表示設定を保存しました');
    setIsSnackbarOpen(true);
  }, []);
  
  // 高度な検索を実行
  const handleAdvancedSearch = useCallback((filters: SearchFilters) => {
    setSearchFilters(filters);
    
    // 結果があるかどうかを確認
    const hasFilters = Object.values(filters).some(value => 
      Array.isArray(value) ? value.length > 0 : value !== null
    );
    
    if (hasFilters) {
      setSnackbarMessage('検索フィルターを適用しました');
      setIsSnackbarOpen(true);
      
      // タブを「all」に切り替え、カテゴリー選択をクリア
      setCurrentTab('all');
      setSelectedCategory(null);
      setSelectedProject(null);
      setSelectedCollection(null);
      setSelectedStatus(null);
    } else {
      setSnackbarMessage('すべてのフィルターをクリアしました');
      setIsSnackbarOpen(true);
    }
  }, []);
  
  // カテゴリーがクリックされたときの処理
  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategory(prev => prev === categoryId ? null : categoryId);
    
    // モバイルの場合はカテゴリー選択後にパネルを閉じる
    if (isMobile) {
      setShowMobileCategories(false);
    }
    
    // プロジェクト・コレクション・ステータス選択をクリア
    setSelectedProject(null);
    setSelectedCollection(null);
    setSelectedStatus(null);
  }, [isMobile]);
  
  // プロジェクト選択処理
  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProject(prev => prev === projectId ? null : projectId);
    
    // カテゴリー・コレクション・ステータス選択をクリア
    setSelectedCategory(null);
    setSelectedCollection(null);
    setSelectedStatus(null);
    
    // プロジェクトタブに切り替え
    setCurrentTab('projects');
  }, []);
  
  // コレクション選択処理
  const handleCollectionSelect = useCallback((collectionId: string) => {
    setSelectedCollection(prev => prev === collectionId ? null : collectionId);
    
    // カテゴリー・プロジェクト・ステータス選択をクリア
    setSelectedCategory(null);
    setSelectedProject(null);
    setSelectedStatus(null);
    
    // コレクションタブに切り替え
    setCurrentTab('collections');
  }, []);
  
  // ステータス選択処理
  const handleStatusSelect = useCallback((status: string) => {
    setSelectedStatus(prev => prev === status ? null : status);
    
    // カテゴリー・プロジェクト・コレクション選択をクリア
    setSelectedCategory(null);
    setSelectedProject(null);
    setSelectedCollection(null);
    
    // ステータスタブに切り替え
    setCurrentTab('status');
  }, []);
  
  // タブが変更されたときの処理
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: TabValue) => {
    setCurrentTab(newValue);
    
    // カテゴリー・プロジェクト・コレクション・ステータス選択をクリア
    setSelectedCategory(null);
    setSelectedProject(null);
    setSelectedCollection(null);
    setSelectedStatus(null);
    
    // 最近表示タブの場合は最終表示日で並べ替え
    if (newValue === 'recent') {
      setUserSettings(prev => ({
        ...prev,
        sortOption: 'lastOpened',
        sortDirection: 'desc'
      }));
    }
  }, []);
  
  // 表示モードが変更されたときの処理
  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    setUserSettings(prev => ({
      ...prev,
      defaultView: newMode
    }));
    
    // 設定を保存
    localStorage.setItem(
      STORAGE_KEY_SETTINGS, 
      JSON.stringify({
        ...userSettings,
        defaultView: newMode
      })
    );
  };
  
  // 検索条件をクリア
  const clearSearch = () => {
    setSearchTerm('');
    setSearchFilters({
      authors: [],
      years: [],
      journals: [],
      keywords: [],
      readStatus: [],
      projects: [],
      collections: [],
      favorite: null
    });
  };
  
  // 論文のカテゴリーとステータスによるフィルタリング
  const filteredPapers = useMemo(() => {
    // 基本検索でフィルタリング
    let filtered = extendedPapers;
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(paper => {
        const titleMatch = paper.metadata?.title?.toLowerCase().includes(searchLower);
        const authorMatch = paper.metadata?.authors?.some(author => 
          author.name.toLowerCase().includes(searchLower)
        );
        const journalMatch = paper.metadata?.journal?.toLowerCase().includes(searchLower);
        const keywordMatch = paper.metadata?.keywords?.some(keyword =>
          keyword.toLowerCase().includes(searchLower)
        );
        const abstractMatch = paper.metadata?.abstract?.toLowerCase().includes(searchLower);
        
        return titleMatch || authorMatch || journalMatch || keywordMatch || abstractMatch;
      });
    }
    
    // 高度な検索フィルターでフィルタリング
    const {
      authors, years, journals, keywords, readStatus, projects, collections, favorite
    } = searchFilters;
    
    if (authors.length > 0) {
      filtered = filtered.filter(paper => 
        paper.metadata?.authors?.some(author => 
          authors.includes(author.name)
        )
      );
    }
    
    if (years.length > 0) {
      filtered = filtered.filter(paper => 
        paper.metadata?.year && years.includes(paper.metadata.year)
      );
    }
    
    if (journals.length > 0) {
      filtered = filtered.filter(paper => 
        paper.metadata?.journal && journals.includes(paper.metadata.journal)
      );
    }
    
    if (keywords.length > 0) {
      filtered = filtered.filter(paper => 
        paper.metadata?.keywords?.some(keyword => 
          keywords.includes(keyword)
        )
      );
    }
    
    if (readStatus.length > 0) {
      filtered = filtered.filter(paper => 
        paper.readStatus && readStatus.includes(paper.readStatus)
      );
    }
    
    if (projects.length > 0) {
      filtered = filtered.filter(paper => 
        paper.projects?.some(projectId => 
          projects.includes(projectId)
        )
      );
    }
    
    if (collections.length > 0) {
      filtered = filtered.filter(paper => 
        paper.collections?.some(collectionId => 
          collections.includes(collectionId)
        )
      );
    }
    
    if (favorite !== null) {
      filtered = filtered.filter(paper => 
        paper.favorite === favorite
      );
    }
    
    // プロジェクトでフィルタリング
    if (selectedProject) {
      filtered = filtered.filter(paper => 
        paper.projects?.includes(selectedProject)
      );
    }
    
    // コレクションでフィルタリング
    if (selectedCollection) {
      filtered = filtered.filter(paper => 
        paper.collections?.includes(selectedCollection)
      );
    }
    
    // 読書状態でフィルタリング
    if (selectedStatus) {
      filtered = filtered.filter(paper => 
        paper.readStatus === selectedStatus
      );
    }
    
    // カテゴリー（キーワード）でフィルタリング
    if (selectedCategory && selectedCategory !== 'uncategorized') {
      filtered = filtered.filter(paper => 
        paper.metadata?.keywords?.includes(selectedCategory)
      );
    } else if (selectedCategory === 'uncategorized') {
      filtered = filtered.filter(paper => 
        !paper.metadata?.keywords || paper.metadata.keywords.length === 0
      );
    }
    
    // 必要に応じてソート
    const { sortOption, sortDirection } = userSettings;
    filtered = [...filtered].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortOption) {
        case 'title':
          valueA = a.metadata?.title || '';
          valueB = b.metadata?.title || '';
          break;
        case 'year':
          valueA = a.metadata?.year || 0;
          valueB = b.metadata?.year || 0;
          break;
        case 'journal':
          valueA = a.metadata?.journal || '';
          valueB = b.metadata?.journal || '';
          break;
        case 'lastOpened':
          valueA = a.lastOpened || 0;
          valueB = b.lastOpened || 0;
          break;
        case 'status':
          valueA = a.readStatus || 'unread';
          valueB = b.readStatus || 'unread';
          break;
        case 'uploaded':
        default:
          valueA = a.uploaded_at?.toMillis() || 0;
          valueB = b.uploaded_at?.toMillis() || 0;
      }
      
      // 数値の場合
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // 文字列の場合
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      return 0;
    });
    
    return filtered;
  }, [extendedPapers, searchTerm, searchFilters, selectedCategory, selectedProject, selectedCollection, selectedStatus, userSettings]);
  
  // タブに表示する論文一覧
  const tabPapers = useMemo(() => {
    switch (currentTab) {
      case 'projects':
        // プロジェクトに属する論文
        return filteredPapers.filter(paper => 
          paper.projects && paper.projects.length > 0
        );
      case 'collections':
        // コレクションに属する論文
        return filteredPapers.filter(paper => 
          paper.collections && paper.collections.length > 0
        );
      case 'status':
        // 読書状態が設定されている論文
        return filteredPapers.filter(paper => 
          paper.readStatus && paper.readStatus !== 'unread'
        );
      case 'recent':
        // 最近閲覧した論文（上位20件）
        return [...filteredPapers]
          .filter(paper => paper.lastOpened && paper.lastOpened > 0)
          .sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))
          .slice(0, 20);
      case 'all':
      default:
        return filteredPapers;
    }
  }, [currentTab, filteredPapers]);
  
  // 論文一覧をカテゴリーに分類する関数
  const categorizePapers = useMemo(() => {
    const categories = new Map<string, ExtendedPaper[]>();
    const uncategorized: ExtendedPaper[] = [];

    tabPapers.forEach((paper: ExtendedPaper) => {
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
  }, [tabPapers]);
  
  // すべての可能なカテゴリーを抽出
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    extendedPapers.forEach(paper => {
      paper.metadata?.keywords?.forEach(keyword => {
        categories.add(keyword);
      });
    });
    return Array.from(categories);
  }, [extendedPapers]);
  
  // 統計データ
  const statistics = useMemo(() => {
    const total = extendedPapers.length;
    const unread = extendedPapers.filter(p => p.readStatus === 'unread').length;
    const reading = extendedPapers.filter(p => p.readStatus === 'reading').length;
    const completed = extendedPapers.filter(p => p.readStatus === 'completed').length;
    const important = extendedPapers.filter(p => p.readStatus === 'important').length;
    const review = extendedPapers.filter(p => p.readStatus === 'review_later').length;
    const favorite = extendedPapers.filter(p => p.favorite).length;
    
    return {
      total,
      unread,
      reading,
      completed,
      important,
      review,
      favorite
    };
  }, [extendedPapers]);
  
  // レンダリング
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
              あなたの研究論文を整理し、効率的に管理します
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
            
            <Button
              variant="outlined"
              color="primary"
              startIcon={<TuneIcon />}
              onClick={() => setIsAdvancedSearchOpen(true)}
              sx={{ 
                borderRadius: 3,
                height: 40,
                whiteSpace: 'nowrap',
              }}
            >
              高度な検索
            </Button>
            
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
                サイドパネルを{showMobileCategories ? '閉じる' : '表示'}
              </Button>
            )}
          </Box>
        </Box>

        {/* タブメニュー */}
        <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="論文管理タブ"
          >
            <Tab 
              value="all" 
              label="すべて" 
              icon={<MenuBookIcon />} 
              iconPosition="start"
            />
            <Tab 
              value="projects" 
              label="プロジェクト" 
              icon={<WorkIcon />} 
              iconPosition="start"
            />
            <Tab 
              value="collections" 
              label="コレクション" 
              icon={<FolderSpecialIcon />} 
              iconPosition="start"
            />
            <Tab 
              value="status" 
              label="読書状態" 
              icon={<BookmarkIcon />} 
              iconPosition="start"
            />
            <Tab 
              value="recent" 
              label="最近表示" 
              icon={<AccessTimeIcon />} 
              iconPosition="start"
            />
          </Tabs>
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
              {/* ダッシュボード統計 */}
              <Box sx={{ mb: 3 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2, 
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
                  ダッシュボード
                </Typography>
                
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Card sx={{ borderRadius: 2, boxShadow: 'none', bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="h5" fontWeight={700}>{statistics.total}</Typography>
                        <Typography variant="body2" color="text.secondary">総論文数</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card sx={{ borderRadius: 2, boxShadow: 'none', bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="h5" fontWeight={700}>{statistics.favorite}</Typography>
                        <Typography variant="body2" color="text.secondary">お気に入り</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card sx={{ borderRadius: 2, boxShadow: 'none', bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="h5" fontWeight={700}>{statistics.completed}</Typography>
                        <Typography variant="body2" color="text.secondary">読了</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card sx={{ borderRadius: 2, boxShadow: 'none', bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="h5" fontWeight={700}>{statistics.reading}</Typography>
                        <Typography variant="body2" color="text.secondary">読書中</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
              
              {/* すべての論文 */}
              <CategoryCard
                title="すべての論文"
                count={extendedPapers.length}
                isSelected={selectedCategory === null && !selectedProject && !selectedCollection && !selectedStatus}
                onSelect={() => {
                  setSelectedCategory(null);
                  setSelectedProject(null);
                  setSelectedCollection(null);
                  setSelectedStatus(null);
                  setCurrentTab('all');
                }}
                icon={<MenuBookIcon fontSize="small" />}
              />
              
              {/* プロジェクト一覧 */}
              <Box sx={{ mt: 3 }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 1,
                  }}
                  onClick={() => setIsProjectsMenuOpen(prev => !prev)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {isProjectsMenuOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
                    <Typography variant="subtitle1" fontWeight={600}>プロジェクト</Typography>
                  </Box>
                  <Box>
                    <Tooltip title="新しいプロジェクトを作成">
                      <IconButton 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(undefined);
                          setIsProjectDialogOpen(true);
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                <Collapse in={isProjectsMenuOpen}>
                  {projects.length > 0 ? (
                    projects.map(project => (
                      <CategoryCard
                        key={project.id}
                        title={project.name}
                        count={extendedPapers.filter(p => p.projects?.includes(project.id)).length}
                        isSelected={selectedProject === project.id}
                        onSelect={() => handleProjectSelect(project.id)}
                        icon={<WorkIcon fontSize="small" />}
                        color={project.color}
                        onEdit={() => {
                          setEditingProject(project);
                          setIsProjectDialogOpen(true);
                        }}
                        onDelete={() => handleDeleteProject(project.id)}
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4, my: 1 }}>
                      プロジェクトがありません
                    </Typography>
                  )}
                </Collapse>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 1,
                  }}
                  onClick={() => setIsCollectionsMenuOpen(prev => !prev)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {isCollectionsMenuOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
                    <Typography variant="subtitle1" fontWeight={600}>コレクション</Typography>
                  </Box>
                  <Box>
                    <Tooltip title="新しいコレクションを作成">
                      <IconButton 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCollection(undefined);
                          setIsCollectionDialogOpen(true);
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                <Collapse in={isCollectionsMenuOpen}>
                  {collections.length > 0 ? (
                    collections.map(collection => (
                      <CategoryCard
                        key={collection.id}
                        title={collection.name}
                        count={extendedPapers.filter(p => p.collections?.includes(collection.id)).length}
                        isSelected={selectedCollection === collection.id}
                        onSelect={() => handleCollectionSelect(collection.id)}
                        icon={<FolderSpecialIcon fontSize="small" />}
                        color={collection.color}
                        onEdit={() => {
                          setEditingCollection(collection);
                          setIsCollectionDialogOpen(true);
                        }}
                        onDelete={() => handleDeleteCollection(collection.id)}
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4, my: 1 }}>
                      コレクションがありません
                    </Typography>
                  )}
                </Collapse>
              </Box>
              
              {/* 読書状態フィルター */}
              <Box sx={{ mt: 3 }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 1,
                  }}
                  onClick={() => setIsStatusesMenuOpen(prev => !prev)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {isStatusesMenuOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
                    <Typography variant="subtitle1" fontWeight={600}>読書状態</Typography>
                  </Box>
                </Box>
                
                <Collapse in={isStatusesMenuOpen}>
                  <CategoryCard
                    title="未読"
                    count={extendedPapers.filter(p => p.readStatus === 'unread').length}
                    isSelected={selectedStatus === 'unread'}
                    onSelect={() => handleStatusSelect('unread')}
                    icon={<BookmarkBorderIcon fontSize="small" />}
                  />
                  <CategoryCard
                    title="読書中"
                    count={extendedPapers.filter(p => p.readStatus === 'reading').length}
                    isSelected={selectedStatus === 'reading'}
                    onSelect={() => handleStatusSelect('reading')}
                    icon={<BookmarkIcon fontSize="small" color="primary" />}
                    color={theme.palette.primary.main}
                  />
                  <CategoryCard
                    title="読了"
                    count={extendedPapers.filter(p => p.readStatus === 'completed').length}
                    isSelected={selectedStatus === 'completed'}
                    onSelect={() => handleStatusSelect('completed')}
                    icon={<CheckCircleIcon fontSize="small" color="success" />}
                    color={theme.palette.success.main}
                  />
                  <CategoryCard
                    title="重要"
                    count={extendedPapers.filter(p => p.readStatus === 'important').length}
                    isSelected={selectedStatus === 'important'}
                    onSelect={() => handleStatusSelect('important')}
                    icon={<PriorityHighIcon fontSize="small" color="error" />}
                    color={theme.palette.error.main}
                  />
                  <CategoryCard
                    title="後で再読"
                    count={extendedPapers.filter(p => p.readStatus === 'review_later').length}
                    isSelected={selectedStatus === 'review_later'}
                    onSelect={() => handleStatusSelect('review_later')}
                    icon={<ReplayIcon fontSize="small" color="secondary" />}
                    color={theme.palette.secondary.main}
                  />
                </Collapse>
              </Box>
              
              {/* カテゴリー一覧 */}
              {allCategories.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 600,
                      mb: 1
                    }}
                  >
                    キーワードカテゴリー
                  </Typography>
                  
                  {allCategories.slice(0, 10).map(category => (
                    <CategoryCard
                      key={category}
                      title={category}
                      count={extendedPapers.filter(p => p.metadata?.keywords?.includes(category)).length}
                      isSelected={selectedCategory === category}
                      onSelect={() => handleCategorySelect(category)}
                      icon={<LabelIcon fontSize="small" />}
                    />
                  ))}
                  
                  {allCategories.length > 10 && (
                    <Button
                      variant="text"
                      sx={{ mt: 1, ml: 2 }}
                      endIcon={<ArrowRightIcon />}
                    >
                      さらに表示 ({allCategories.length - 10}件)
                    </Button>
                  )}
                </>
              )}
              
              {/* 未分類 */}
              <CategoryCard
                title="未分類"
                count={extendedPapers.filter(p => !p.metadata?.keywords || p.metadata.keywords.length === 0).length}
                isSelected={selectedCategory === 'uncategorized'}
                onSelect={() => handleCategorySelect('uncategorized')}
                icon={<DoNotDisturbAltIcon fontSize="small" />}
              />
              
              {/* 表示設定 */}
              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  fullWidth
                  startIcon={<SettingsIcon />}
                  onClick={() => setIsDisplaySettingsOpen(true)}
                  sx={{ 
                    borderRadius: 3,
                    textTransform: 'none',
                  }}
                >
                  表示設定
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* メインコンテンツ */}
          <Grid item xs={12} md={isMobile ? 12 : 9}>
            {/* 表示モード切り替え */}
            <Box sx={{ 
              mb: 3, 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1
            }}>
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                  }}
                >
                  {selectedProject 
                    ? `「${projects.find(p => p.id === selectedProject)?.name || ''}」のプロジェクト`
                    : selectedCollection
                      ? `「${collections.find(c => c.id === selectedCollection)?.name || ''}」のコレクション`
                      : selectedStatus
                        ? `「${
                            selectedStatus === 'unread' ? '未読' :
                            selectedStatus === 'reading' ? '読書中' :
                            selectedStatus === 'completed' ? '読了' :
                            selectedStatus === 'important' ? '重要' :
                            selectedStatus === 'review_later' ? '後で再読' : selectedStatus
                          }」の論文`
                        : selectedCategory 
                          ? (selectedCategory === 'uncategorized' 
                            ? '未分類の論文' 
                            : `「${selectedCategory}」の論文`)
                          : currentTab === 'projects'
                            ? 'プロジェクト内の論文'
                            : currentTab === 'collections'
                              ? 'コレクション内の論文'
                              : currentTab === 'status'
                                ? '読書状態が設定された論文'
                                : currentTab === 'recent'
                                  ? '最近表示した論文'
                                  : 'すべての論文'}
                </Typography>
                
                <Typography variant="body2" color="text.secondary">
                  {tabPapers.length}件の論文
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  startIcon={<SortIcon />}
                  onClick={() => setIsDisplaySettingsOpen(true)}
                  sx={{ 
                    borderRadius: 3,
                    textTransform: 'none',
                  }}
                >
                  {userSettings.sortOption === 'uploaded' ? 'アップロード日' :
                   userSettings.sortOption === 'title' ? 'タイトル' :
                   userSettings.sortOption === 'year' ? '発行年' :
                   userSettings.sortOption === 'journal' ? 'ジャーナル' :
                   userSettings.sortOption === 'lastOpened' ? '最終閲覧日' :
                   userSettings.sortOption === 'status' ? '読書状態' : '並び替え'}
                  {userSettings.sortDirection === 'asc' ? ' ↑' : ' ↓'}
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
                  カード
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'contained' : 'outlined'}
                  color="primary"
                  size="small"
                  startIcon={<FormatListBulletedIcon />}
                  onClick={() => handleViewModeChange('list')}
                  sx={{ 
                    borderRadius: 3,
                    boxShadow: viewMode === 'list' ? 3 : 0,
                  }}
                >
                  リスト
                </Button>
                <Button
                  variant={viewMode === 'compact' ? 'contained' : 'outlined'}
                  color="primary"
                  size="small"
                  startIcon={<MenuBookIcon />}
                  onClick={() => handleViewModeChange('compact')}
                  sx={{ 
                    borderRadius: 3,
                    boxShadow: viewMode === 'compact' ? 3 : 0,
                  }}
                >
                  コンパクト
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
                {/* ダッシュボード表示モード */}
                {viewMode === 'dashboard' && (
                  <Box>
                    {/* TODO: ダッシュボード表示のUI */}
                    <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        ダッシュボード表示はまだ開発中です
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => handleViewModeChange('grid')}
                      >
                        カード表示に戻る
                      </Button>
                    </Paper>
                  </Box>
                )}
                
                {/* 階層表示モード */}
                {viewMode === 'hierarchy' && (
                  <>
                    {/* 選択されたカテゴリーの論文を表示 */}
                    {selectedCategory || selectedProject || selectedCollection || selectedStatus ? (
                      tabPapers.length > 0 ? (
                        <Grid container spacing={3}>
                          {tabPapers.map(paper => (
                            <Grid item xs={12} sm={6} md={4} key={paper.id}>
                              <PaperCard
                                paper={paper}
                                onClick={() => handlePaperClick(paper.id)}
                                onStatusChange={handleStatusChange}
                                onProjectAdd={handleProjectAdd}
                                onCollectionAdd={handleCollectionAdd}
                                onFavoriteToggle={handleFavoriteToggle}
                                displayOptions={userSettings.cardDisplayOptions}
                                projects={projects}
                                collections={collections}
                                viewMode={viewMode}
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
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>論文がありません</Typography>
                        </Paper>
                      )
                    ) : (
                      // すべてのカテゴリーを表示
                      <>
                        {tabPapers.length === 0 ? (
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
                            {categorizePapers.categories.map(category => (
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
                                        onClick={() => handlePaperClick(paper.id)}
                                        onStatusChange={handleStatusChange}
                                        onProjectAdd={handleProjectAdd}
                                        onCollectionAdd={handleCollectionAdd}
                                        onFavoriteToggle={handleFavoriteToggle}
                                        displayOptions={userSettings.cardDisplayOptions}
                                        projects={projects}
                                        collections={collections}
                                        viewMode={viewMode}
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
                            {categorizePapers.uncategorized.length > 0 && (
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
                                  {categorizePapers.uncategorized.slice(0, 3).map(paper => (
                                    <Grid item xs={12} sm={6} md={4} key={paper.id}>
                                      <PaperCard
                                        paper={paper}
                                        onClick={() => handlePaperClick(paper.id)}
                                        onStatusChange={handleStatusChange}
                                        onProjectAdd={handleProjectAdd}
                                        onCollectionAdd={handleCollectionAdd}
                                        onFavoriteToggle={handleFavoriteToggle}
                                        displayOptions={userSettings.cardDisplayOptions}
                                        projects={projects}
                                        collections={collections}
                                        viewMode={viewMode}
                                      />
                                    </Grid>
                                  ))}
                                </Grid>
                                {categorizePapers.uncategorized.length > 3 && (
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
                                      残り{categorizePapers.uncategorized.length - 3}件を表示
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
                )}
                
                {/* グリッド・リスト・コンパクト表示モード */}
                {(viewMode === 'grid' || viewMode === 'list' || viewMode === 'compact') && (
                  <>
                    {tabPapers.length === 0 ? (
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
                      // グリッドまたはリスト表示
                      viewMode === 'compact' ? (
                        // コンパクト表示
                        <Paper sx={{ borderRadius: 3, p: 2 }}>
                          {tabPapers.map((paper) => (
                            <PaperCard 
                              key={paper.id}
                              paper={paper} 
                              onClick={() => handlePaperClick(paper.id)}
                              onStatusChange={handleStatusChange}
                              onProjectAdd={handleProjectAdd}
                              onCollectionAdd={handleCollectionAdd}
                              onFavoriteToggle={handleFavoriteToggle}
                              displayOptions={userSettings.cardDisplayOptions}
                              projects={projects}
                              collections={collections}
                              viewMode={viewMode}
                            />
                          ))}
                        </Paper>
                      ) : (
                        // グリッドまたはリスト表示
                        viewMode === 'list' ? (
                          // リスト表示
                          <Box>
                            {tabPapers.map((paper) => (
                              <PaperCard 
                                key={paper.id}
                                paper={paper} 
                                onClick={() => handlePaperClick(paper.id)}
                                onStatusChange={handleStatusChange}
                                onProjectAdd={handleProjectAdd}
                                onCollectionAdd={handleCollectionAdd}
                                onFavoriteToggle={handleFavoriteToggle}
                                displayOptions={userSettings.cardDisplayOptions}
                                projects={projects}
                                collections={collections}
                                viewMode={viewMode}
                              />
                            ))}
                          </Box>
                        ) : (
                          // グリッド表示
                          <Grid container spacing={3}>
                            {tabPapers.map((paper) => (
                              <Grid item xs={12} sm={6} md={4} key={paper.id}>
                                <PaperCard 
                                  paper={paper} 
                                  onClick={() => handlePaperClick(paper.id)}
                                  onStatusChange={handleStatusChange}
                                  onProjectAdd={handleProjectAdd}
                                  onCollectionAdd={handleCollectionAdd}
                                  onFavoriteToggle={handleFavoriteToggle}
                                  displayOptions={userSettings.cardDisplayOptions}
                                  projects={projects}
                                  collections={collections}
                                  viewMode={viewMode}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        )
                      )
                    )}
                  </>
                )}
              </>
            )}
          </Grid>
        </Grid>
      </Box>
      
      {/* ダイアログ: 表示設定 */}
      <DisplaySettingsDialog
        open={isDisplaySettingsOpen}
        onClose={() => setIsDisplaySettingsOpen(false)}
        settings={userSettings}
        onSave={handleSaveSettings}
      />
      
      {/* ダイアログ: 高度な検索 */}
      <AdvancedSearchDialog
        open={isAdvancedSearchOpen}
        onClose={() => setIsAdvancedSearchOpen(false)}
        onSearch={handleAdvancedSearch}
        papers={extendedPapers}
        projects={projects}
        collections={collections}
      />
      
      {/* ダイアログ: プロジェクト */}
      <ProjectDialog
        open={isProjectDialogOpen}
        onClose={() => {
          setIsProjectDialogOpen(false);
          setEditingProject(undefined);
        }}
        onSave={editingProject ? handleUpdateProject : handleAddProject}
        editProject={editingProject}
      />
      
      {/* ダイアログ: コレクション */}
      <CollectionDialog
        open={isCollectionDialogOpen}
        onClose={() => {
          setIsCollectionDialogOpen(false);
          setEditingCollection(undefined);
        }}
        onSave={editingCollection ? handleUpdateCollection : handleAddCollection}
        editCollection={editingCollection}
      />
      
      {/* 通知メッセージ */}
      <Snackbar
        open={isSnackbarOpen}
        autoHideDuration={3000}
        onClose={() => setIsSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default MyPapersPage;