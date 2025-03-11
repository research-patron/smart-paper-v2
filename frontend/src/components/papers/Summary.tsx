import React from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';

interface Chapter {
  chapter_number: number;
  title: string;
  start_page: number;
  end_page: number;
}

interface SummaryProps {
  chapters?: Chapter[];
  summaries?: Record<string, string>;
  loading?: boolean;
  error?: string;
}

const Summary: React.FC<SummaryProps> = ({
  chapters = [],
  summaries = {},
  loading = false,
  error
}) => {
  // サマリーテキストから不要な文字（"Chapter X" など）を除去
  const cleanSummaryText = (text: string): string => {
    return text
      .replace(/^Chapter \d+:?\s*/i, '') // "Chapter X:" または "Chapter X" を除去
      .replace(/^\(\d+\)\s*/, '') // "(X)" を除去
      .replace(/^[０-９]+[\.．、]\s*/, '') // 全角数字と区切り文字を除去
      .trim();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (chapters.length === 0 || Object.keys(summaries).length === 0) {
    return (
      <Box p={2}>
        <Alert severity="info">要約はまだ生成されていません。</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {chapters.map((chapter) => {
        const summaryText = summaries[chapter.chapter_number];
        if (!summaryText) return null;

        return (
          <Paper key={chapter.chapter_number} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              {chapter.title}
            </Typography>
            <Typography variant="body1" component="div">
              {cleanSummaryText(summaryText)}
            </Typography>
          </Paper>
        );
      })}
    </Box>
  );
};

export default Summary;
