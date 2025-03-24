import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  FolderOutlined as FolderIcon,
} from '@mui/icons-material';

interface Category {
  id: string;
  name: string;
  count: number;
  children?: Category[];
}

interface CategoryTreeProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string) => void;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());

  // カテゴリーの展開/折りたたみを切り替え
  const handleToggle = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // 検索条件に合うカテゴリーをフィルタリング
  const filterCategories = (categories: Category[]): Category[] => {
    return categories.reduce<Category[]>((acc, category) => {
      const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
      const filteredChildren = category.children ? filterCategories(category.children) : undefined;
      
      if (matchesSearch || (filteredChildren && filteredChildren.length > 0)) {
        acc.push({
          ...category,
          children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined
        });
      }
      return acc;
    }, []);
  };

  // カテゴリーアイテムをレンダリング
  const renderCategoryItem = (category: Category, level: number = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const isSelected = category.id === selectedCategory;

    return (
      <Box key={category.id}>
        <ListItem
          button
          onClick={() => onCategorySelect(category.id)}
          selected={isSelected}
          sx={{
            pl: level * 2 + 2,
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <FolderIcon color={isSelected ? "primary" : "action"} />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography variant="body2" noWrap>
                {category.name}
              </Typography>
            }
            secondary={
              <Typography variant="caption" color="text.secondary">
                {category.count}件
              </Typography>
            }
          />
          {hasChildren ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(category.id);
              }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          ) : null}
        </ListItem>
        
        {hasChildren && category.children && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {category.children.map(child => renderCategoryItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  const filteredCategories = filterCategories(categories);

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="カテゴリーを検索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      
      <List dense component="nav">
        {filteredCategories.map(category => renderCategoryItem(category))}
      </List>
    </Box>
  );
};

export default CategoryTree;
