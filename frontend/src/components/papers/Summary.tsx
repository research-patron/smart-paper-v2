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

// JSONパース関数
const extractJsonContent = (text: string): { summary: string, requiredKnowledge?: string } => {
  if (!text) return { summary: '' };

  try {
    // 1. 完全なJSONオブジェクトとして解析を試みる
    try {
      const jsonObj = JSON.parse(text);
      if (jsonObj && typeof jsonObj === 'object') {
        return { 
          summary: jsonObj.summary || '',
          requiredKnowledge: jsonObj.required_knowledge || jsonObj.requiredKnowledge || ''
        };
      }
    } catch (e) {
      // JSONとして解析できない場合は以降の方法を試す
      console.log("Not a complete JSON object, trying other methods");
    }

    // 2. JSON形式のコードブロックを探す
    const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
    const codeBlockMatch = codeBlockRegex.exec(text);
    if (codeBlockMatch) {
      try {
        const jsonObj = JSON.parse(codeBlockMatch[1]);
        return {
          summary: jsonObj.summary || '',
          requiredKnowledge: jsonObj.required_knowledge || jsonObj.requiredKnowledge || ''
        };
      } catch (e) {
        console.log("Code block is not valid JSON, trying other methods");
      }
    }

    // 3. JSON構造をパターンマッチで抽出
    const jsonPattern = /\{\s*"summary"\s*:\s*"([\s\S]+?)"\s*(?:,\s*"required_knowledge"\s*:\s*"([\s\S]+?)"\s*)?\}/;
    const jsonMatch = jsonPattern.exec(text);
    
    if (jsonMatch) {
      // コードブロック内のJSONテキストを抽出
      let extractedSummary = jsonMatch[1] || '';
      let extractedKnowledge = jsonMatch[2] || '';
      // エスケープされた引用符を戻す
      extractedSummary = extractedSummary.replace(/\\"/g, '"');
      extractedKnowledge = extractedKnowledge.replace(/\\"/g, '"');
      return { 
        summary: extractedSummary,
        requiredKnowledge: extractedKnowledge 
      };
    }

    // 4. 個別のフィールドをそれぞれパターンマッチで抽出
    const summaryPattern = /"summary"\s*:\s*"([\s\S]+?)(?:"\s*,|\"\s*\})/;
    const knowledgePattern = /"required_knowledge"\s*:\s*"([\s\S]+?)(?:"\s*,|\"\s*\})/;
    
    const summaryMatch = summaryPattern.exec(text);
    const knowledgeMatch = knowledgePattern.exec(text);
    
    if (summaryMatch) {
      const extractedSummary = summaryMatch[1].replace(/\\"/g, '"');
      const extractedKnowledge = knowledgeMatch ? knowledgeMatch[1].replace(/\\"/g, '"') : '';
      
      return {
        summary: extractedSummary,
        requiredKnowledge: extractedKnowledge
      };
    }

    // 5. "この分野の研究を行うために必要な知識" や "必要な知識" のような見出しを探す
    const knowledgeSectionPattern = /(?:##|<h[1-6]>)\s*(?:この分野の研究を行うために必要な知識|必要な知識|前提知識)(?:<\/h[1-6]>)?:?\s*([\s\S]+?)(?:(?:##|<h[1-6]>)|$)/i;
    const knowledgeSectionMatch = knowledgeSectionPattern.exec(text);
    
    // 要約と必要な知識のセクションを分離
    if (knowledgeSectionMatch) {
      const knowledgeText = knowledgeSectionMatch[1].trim();
      // セクションの開始位置を見つけて、それより前を要約として扱う
      const start = text.indexOf(knowledgeSectionMatch[0]);
      const summaryText = start > 0 ? text.substring(0, start).trim() : text;
      
      return {
        summary: summaryText,
        requiredKnowledge: knowledgeText
      };
    }

    // どの方法でも抽出できない場合は元のテキストをsummaryとして返す
    return { summary: text };
  } catch (e) {
    console.error('Error extracting summary content:', e instanceof Error ? e.message : 'Unknown error');
    return {
      summary: text,
      requiredKnowledge: ''
    };
  }
};

// Markdownをプレーンテキストに変換する関数
const parseMarkdown = (markdown: string): string => {
  if (!markdown) return '';
  
  let html = markdown;
  
  // 強調（太字）
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // 強調（イタリック）
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // リスト
  // 箇条書き（- や * で始まる行）
  html = html.replace(/^[\s]*[-*+][\s]+(.*?)$/gm, '<li>$1</li>');
  // 箇条書きが連続するケースで<ul>タグで囲む
  html = html.replace(/(<li>.*?<\/li>)\n(<li>)/g, '$1$2');
  html = html.replace(/^<li>/m, '<ul><li>');
  html = html.replace(/<\/li>$/m, '</li></ul>');
  
  // 番号付きリスト
  html = html.replace(/^[\s]*(\d+)\.[\s]+(.*?)$/gm, '<li>$2</li>');
  
  // 見出し (##, ### など)
  html = html.replace(/^##\s+(.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^###\s+(.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^####\s+(.*?)$/gm, '<h4>$1</h4>');
  
  // リンク
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  
  // コード
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // 段落
  // 連続する改行を<p>タグで置換
  html = html.replace(/\n\n(.*?)\n\n/g, '</p><p>$1</p>');
  
  // 不完全なリストの修正
  html = html.replace(/<li>/g, '<ul><li>').replace(/<\/li>/g, '</li></ul>');
  html = html.replace(/<\/ul><ul>/g, '');
  
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
  // メモ化された要約情報（JSONパース処理を含む）
  const processedContent = useMemo(() => {
    const result = extractJsonContent(summaryText);
    
    // 別フィールドとして requiredKnowledgeText が提供されている場合はそれを優先
    if (requiredKnowledgeText) {
      result.requiredKnowledge = requiredKnowledgeText;
    }
    
    return result;
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
      {/* メイン要約 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          論文の要約
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <div
          dangerouslySetInnerHTML={{
            __html: parseMarkdown(chapterSummaries[0] || processedContent.summary)
          }}
        />
      </Paper>
      
      {/* 必要な知識の表示 */}
      {processedContent.requiredKnowledge && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            この分野の研究を行うために必要な知識
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <div
            dangerouslySetInnerHTML={{
              __html: parseMarkdown(processedContent.requiredKnowledge)
            }}
          />
        </Paper>
      )}
      
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
              <Paper key={chapter.chapter_number} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {chapter.chapter_number}. {chapter.title}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <div
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdown(cleanSummaryText(summaryForChapter))
                  }}
                />
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default Summary;