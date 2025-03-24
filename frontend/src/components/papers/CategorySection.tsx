import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  Link,
  Stack,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  AccessTime as AccessTimeIcon,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { Paper as PaperType, Author } from '../../api/papers';

interface Paper extends PaperType {
  createdAt?: {
    toMillis: () => number;
  };
}

interface CategorySectionProps {
  title: string;
  description?: string;
  papers: Paper[];
  onCategoryClick?: () => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  title,
  description,
  papers,
  onCategoryClick,
}) => {
  const navigate = useNavigate();

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      if (typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString('ja-JP');
      }
      return new Date(date).toLocaleDateString('ja-JP');
    } catch (error) {
      return '';
    }
  };

  return (
    <Paper sx={{ mb: 3, overflow: 'hidden' }}>
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {onCategoryClick && (
          <Button
            variant="outlined"
            size="small"
            sx={{
              color: 'primary.contrastText',
              borderColor: 'primary.contrastText',
              '&:hover': {
                borderColor: 'primary.contrastText',
                bgcolor: 'primary.dark',
              },
            }}
            onClick={onCategoryClick}
          >
            すべて表示
          </Button>
        )}
      </Box>

      {description && (
        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      )}

      <Box>
        {papers.map((paper) => (
          <Accordion key={paper.id} disableGutters>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                '&:hover': { bgcolor: 'action.hover' },
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                    {formatDate(paper.createdAt)}
                  </Typography>
                  {paper.metadata?.keywords && paper.metadata.keywords.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                      <LocalOfferIcon fontSize="small" sx={{ mr: 0.5 }} />
                      {paper.metadata.keywords.slice(0, 3).join(', ')}
                      {paper.metadata.keywords.length > 3 && '...'}
                    </Typography>
                  )}
                </Stack>

                <Link
                  component="button"
                  variant="h6"
                  color="text.primary"
                  align="left"
                  underline="none"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/papers/${paper.id}`);
                  }}
                  sx={{
                    display: 'block',
                    textAlign: 'left',
                    fontWeight: 500,
                    fontSize: '1rem',
                    '&:hover': {
                      color: 'primary.main',
                    },
                  }}
                >
                  {paper.metadata?.title || '無題の論文'}
                </Link>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {paper.metadata?.authors?.map(a => a.name).join(', ') || '著者不明'}
                  {paper.metadata?.journal && ` - ${paper.metadata.journal}`}
                </Typography>
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ bgcolor: 'grey.50' }}>
              {paper.metadata?.keywords && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" component="div" color="text.secondary" sx={{ mb: 0.5 }}>
                    キーワード:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {paper.metadata.keywords.map((keyword) => (
                      <Chip
                        key={keyword}
                        label={keyword}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {paper.summary && (
                <Box>
                  <Typography variant="caption" component="div" color="text.secondary" sx={{ mb: 0.5 }}>
                    要約:
                  </Typography>
                  <Typography variant="body2">
                    {paper.summary}
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Paper>
  );
};

export default CategorySection;
