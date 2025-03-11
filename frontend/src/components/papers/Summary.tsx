// ~/Desktop/smart-paper-v2/frontend/src/components/papers/Summary.tsx
import React from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';

interface Chapter {
  chapter_number: number;
  title: string;
  start_page: number;
  end_page: number;
}

interface SummaryProps {
  chapters?: Chapter[];
  summaryText?: string; // 単一の文字列としての要約に変更
  loading?: boolean;
  error?: string;
}

const Summary: React.FC<SummaryProps> = ({
  chapters = [],
  summaryText = '', // 変更: chapters ごとの要約ではなく単一の要約テキスト
  loading = false,
  error
}) => {
  // 要約を章ごとに分割する関数
  const splitSummaryByChapter = (text: string): Record<number, string> => {
    if (!text) return {};
    
    const chapterSummaries: Record<number, string> = {};
    
    // "Chapter X:" または "**Chapter X:**" のパターンで分割
    const chapterPattern = /\*?\*?Chapter\s+(\d+):?\*?\*?/gi;
    const parts = text.split(chapterPattern);
    
    // 先頭に章番号がない場合の処理
    if (parts.length > 0 && !parts[0].trim().match(/^\d+$/)) {
      // 先頭が数字でない場合は全体の要約や導入部分の可能性がある
      chapterSummaries[0] = parts[0].trim();
    }
    
    // 章ごとに分割
    for (let i = 1; i < parts.length; i += 2) {
      if (i + 1 < parts.length) {
        const chapterNum = parseInt(parts[i], 10);
        const chapterContent = parts[i + 1].trim();
        if (!isNaN(chapterNum) && chapterContent) {
          chapterSummaries[chapterNum] = chapterContent;
        }
      }
    }
    
    return chapterSummaries;
  };

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

  if (!summaryText) {
    return (
      <Box p={2}>
        <Alert severity="info">要約はまだ生成されていません。</Alert>
      </Box>
    );
  }

  // 要約を章ごとに分割
  const chapterSummaries = splitSummaryByChapter(summaryText);
  
  // 章情報がない場合は単一のペーパーとして表示
  if (chapters.length === 0 || Object.keys(chapterSummaries).length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          論文の要約
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body1" component="div" whiteSpace="pre-line">
          {summaryText}
        </Typography>
      </Paper>
    );
  }

  // 章ごとに要約を表示
  return (
    <Box>
      {/* 全体の要約があれば表示 */}
      {chapterSummaries[0] && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            全体の要約
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body1" component="div" whiteSpace="pre-line">
            {chapterSummaries[0]}
          </Typography>
        </Paper>
      )}
      
      {/* 章ごとの要約を表示 */}
      {chapters.map((chapter) => {
        const summaryForChapter = chapterSummaries[chapter.chapter_number];
        if (!summaryForChapter) return null;

        return (
          <Paper key={chapter.chapter_number} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {chapter.chapter_number}. {chapter.title}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" component="div" whiteSpace="pre-line">
              {cleanSummaryText(summaryForChapter)}
            </Typography>
          </Paper>
        );
      })}
    </Box>
  );
};

export default Summary;