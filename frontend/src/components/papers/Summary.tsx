// ~/Desktop/smart-paper-v2/frontend/src/components/papers/Summary.tsx
import React, { useMemo } from 'react';
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
  summaryText?: string; // 単一の文字列としての要約
  requiredKnowledgeText?: string | null; // 必要な知識のテキスト（null許容）
  loading?: boolean;
  error?: string;
}

// Markdownをプレーンテキストに変換する関数
const parseMarkdown = (markdown: string): string => {
  if (!markdown) return '';
  
  let html = markdown;
  
  // 段落単位で処理するために、行を配列に分割
  const lines = html.split('\n');
  const processedLines = [];
  
  // 前の行がリストかどうかを追跡
  let inNumberedList = false;
  let inBulletList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmedLine = line.trim();
    
    // 空行の処理
    if (trimmedLine === '') {
      // リストを閉じる
      if (inNumberedList) {
        processedLines.push('</ol>');
        inNumberedList = false;
      }
      if (inBulletList) {
        processedLines.push('</ul>');
        inBulletList = false;
      }
      processedLines.push('');
      continue;
    }
    
    // 番号付きリストの検出（1. 2. 3. などで始まる行）
    const numberedListMatch = trimmedLine.match(/^(\d+)\.\s+(.*?)$/);
    if (numberedListMatch) {
      const [_, number, content] = numberedListMatch;
      
      // 新しいリストを開始
      if (!inNumberedList) {
        processedLines.push('<ol>');
        inNumberedList = true;
      }
      
      // リスト項目の処理
      processedLines.push(`<li>${content}</li>`);
      continue;
    }
    
    // 箇条書きリストの検出（- * + で始まる行）
    const bulletListMatch = trimmedLine.match(/^[-*+]\s+(.*?)$/);
    if (bulletListMatch) {
      const [_, content] = bulletListMatch;
      
      // 新しいリストを開始
      if (!inBulletList) {
        processedLines.push('<ul>');
        inBulletList = true;
      }
      
      // リスト項目の処理
      processedLines.push(`<li>${content}</li>`);
      continue;
    }
    
    // ここまでの処理でリストと判定されなかった場合、リストを閉じる
    if (inNumberedList) {
      processedLines.push('</ol>');
      inNumberedList = false;
    }
    if (inBulletList) {
      processedLines.push('</ul>');
      inBulletList = false;
    }
    
    // 見出し (##, ### など)の処理
    if (trimmedLine.startsWith('## ')) {
      processedLines.push(`<h2>${trimmedLine.substring(3)}</h2>`);
      continue;
    }
    if (trimmedLine.startsWith('### ')) {
      processedLines.push(`<h3>${trimmedLine.substring(4)}</h3>`);
      continue;
    }
    if (trimmedLine.startsWith('#### ')) {
      processedLines.push(`<h4>${trimmedLine.substring(5)}</h4>`);
      continue;
    }
    
    // 強調（太字）
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // 強調（イタリック）
    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
    line = line.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // リンク
    line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
    
    // コード
    line = line.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // 通常のテキスト行（他のどのパターンにも一致しない）として追加
    processedLines.push(line);
  }
  
  // 処理後の行をつなげる
  html = processedLines.join('\n');
  
  // 段落の処理：連続する行をpタグでグループ化
  html = '<p>' + html.replace(/\n\n+/g, '</p>\n\n<p>') + '</p>';
  
  // 空の段落を削除
  html = html.replace(/<p><\/p>/g, '');
  
  return html;
};

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
    .replace(/^Chapter\s+\d+:?\s*/i, '') // "Chapter X:" または "Chapter X" を除去（スペースの数を柔軟に）
    .replace(/^\([\d０-９]+\)\s*/, '') // 半角・全角数字の "(X)" を除去
    .replace(/^[\d０-９]+[.．、:：]\s*/, '') // 半角・全角数字と区切り文字を除去
    .trim();
};

const Summary: React.FC<SummaryProps> = ({
  chapters = [],
  summaryText = '',
  requiredKnowledgeText = '',
  loading = false,
  error
}) => {
  // Cloud Functionsから直接提供されたテキストを使用
  // 複雑なJSONパース処理を避ける
  const processedContent = useMemo(() => {
    // summaryTextはCloud Functionsで既に処理されたテキスト
    const summary = summaryText || '';
    
    // requiredKnowledgeTextが提供されている場合はそれを使用
    const requiredKnowledge = requiredKnowledgeText || '';
    
    return {
      summary,
      requiredKnowledge
    };
  }, [summaryText, requiredKnowledgeText]);

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

  if (!processedContent.summary) {
    return (
      <Box p={2}>
        <Alert severity="info">要約はまだ生成されていません。</Alert>
      </Box>
    );
  }

  // 要約を章ごとに分割
  const chapterSummaries = splitSummaryByChapter(processedContent.summary);
  
  return (
    <Box>
      <Box sx={{ p: 3 }}>
        {/* 論文の要約部分 */}
        <Typography variant="h5" gutterBottom>
          <strong><u style={{ paddingTop: '5px', display: 'inline-block', textUnderlineOffset: '3px' }}>論文の要約</u></strong>
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <div
          dangerouslySetInnerHTML={{
            __html: parseMarkdown(chapterSummaries[0] || processedContent.summary)
          }}
        />

        {processedContent.requiredKnowledge && (
          <>
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" gutterBottom>
                <strong><u style={{ paddingTop: '5px', display: 'inline-block', textUnderlineOffset: '3px' }}>この分野の研究を行うために必要な知識</u></strong>
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <div
                dangerouslySetInnerHTML={{
                  __html: parseMarkdown(processedContent.requiredKnowledge)
                }}
              />
            </Box>
          </>
        )}
      </Box>
      
      {/* 章ごとの要約を表示（章情報がある場合のみ） */}
      {chapters.length > 0 && Object.keys(chapterSummaries).length > 1 && (
        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            章ごとの要約
          </Typography>
          
          {chapters.map((chapter) => {
            const summaryForChapter = chapterSummaries[chapter.chapter_number];
            if (!summaryForChapter) return null;

            return (
              <Box key={chapter.chapter_number} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {chapter.chapter_number}. {chapter.title}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <div
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdown(cleanSummaryText(summaryForChapter))
                  }}
                />
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default Summary;