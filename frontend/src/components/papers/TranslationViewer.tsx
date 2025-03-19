// ~/Desktop/smart-paper-v2/frontend/src/components/papers/TranslationViewer.tsx
import { useState, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  CircularProgress
} from '@mui/material';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import ErrorMessage from '../common/ErrorMessage';

interface TranslationViewerProps {
  translatedText: string | null;
  loading?: boolean;
  error?: string | null;
  chapter?: {
    title: string;
    chapter_number: number;
  };
  width?: number | string;
  height?: number | string;
}

// JSONパース関数: 翻訳テキストからJSON構造を抽出する
const extractTranslatedText = (text: string | null): string | null => {
  if (!text) return null;

  try {
    // JSONオブジェクトとして解析できるか試す
    try {
      const jsonObj = JSON.parse(text);
      if (jsonObj && typeof jsonObj === 'object') {
        // 新しい構造に対応 (chapter, translated_text, sub_chapters)
        if (jsonObj.chapter && jsonObj.translated_text) {
          // サブチャプターを含めたHTMLを生成
          let htmlContent = `<h2>${jsonObj.chapter}</h2>\n\n`;
          htmlContent += jsonObj.translated_text;
          
          // サブチャプターがあれば追加
          if (jsonObj.sub_chapters && Array.isArray(jsonObj.sub_chapters)) {
            for (const subChapter of jsonObj.sub_chapters) {
              if (subChapter.title && subChapter.content) {
                htmlContent += `\n\n<h3>${subChapter.title}</h3>\n\n`;
                htmlContent += subChapter.content;
              }
            }
          }
          
          return htmlContent;
        }
        
        // 旧形式に対応 (translated_text のみ)
        if (jsonObj.translated_text) {
          return jsonObj.translated_text;
        }
      }
    } catch (e) {
      // JSONとして解析できない場合は次の方法を試す
      console.log('Failed to parse as JSON object:', e);
    }

    // JSON形式かチェック - 完全なJSON文字列の場合
    const jsonPattern = /^\s*\{\s*"translated_text"\s*:\s*"(.+)"\s*\}\s*$/;
    const jsonMatch = jsonPattern.exec(text);
    if (jsonMatch) {
      // JSON内の実際の翻訳テキストを抽出
      let extractedText = jsonMatch[1];
      // エスケープされた引用符を戻す
      extractedText = extractedText.replace(/\\"/g, '"');
      return extractedText;
    }

    // 見出しの処理
    let processedText = text;
    
    // 連続する見出しの重複を検出して除去
    // 例: <h2>1. I. Introduction</h2><h2>1. 序論</h2> → <h2>1. 序論</h2>
    const headingRegex = /<h([1-6])>\s*(\d+)(?:\.|:)\s*([^<]+)<\/h\1>\s*<h\1>\s*\2(?:\.|:)\s*([^<]+)<\/h\1>/gi;
    processedText = processedText.replace(headingRegex, (match, tag, num, title1, title2) => {
      // ローマ数字（I, II, III等）やラテン文字が多く含まれる方は英語タイトルと判断
      const isTitle1English = /\b[IVX]+\b|(?:[A-Z][a-z]+\s+){2,}/i.test(title1);
      // 日本語文字が含まれる方は日本語タイトルと判断
      const isTitle2Japanese = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/i.test(title2);
      
      if (isTitle1English && isTitle2Japanese) {
        // 英語→日本語の順番の場合、日本語のみ残す
        return `<h${tag}>${num}. ${title2}</h${tag}>`;
      } else if (isTitle2Japanese) {
        // 日本語が検出された場合は後者を優先
        return `<h${tag}>${num}. ${title2}</h${tag}>`;
      } else {
        // それ以外の場合は後者を優先（デフォルト）
        return `<h${tag}>${num}. ${title2}</h${tag}>`;
      }
    });
    
    // 重複した見出し（数字. 英語タイトル 数字. 日本語タイトル）を修正
    processedText = processedText.replace(
      /<h([1-6])>\s*(\d+)(?:\.|:)\s*([^<]+?)\s+\2(?:\.|:)\s*([^<]+)<\/h\1>/gi, 
      (match, tagNum, num, engTitle, jpTitle) => `<h${tagNum}>${num}. ${jpTitle}</h${tagNum}>`
    );
    
    // 「Chapter X: Title」の形式を「X. タイトル」に変換
    processedText = processedText.replace(
      /<h([1-6])>\s*(?:Chapter\s+)?(\d+)(?::|\.)\s*([^<]+)<\/h\1>/gi, 
      (match, tagNum, num, title) => `<h${tagNum}>${num}. ${title}</h${tagNum}>`
    );
    
    // ローマ数字の見出し (I, II, III, etc.)
    processedText = processedText.replace(
      /<h([1-6])>\s*(?:Chapter\s+)?([IVX]+)(?::|\.)\s*([^<]+)<\/h\1>/gi, 
      (match, tagNum, romanNumeral, title) => {
        // ローマ数字をアラビア数字に変換
        const romanToArabic = (roman: string): number => {
          const romanNumerals: {[key: string]: number} = {
            'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000
          };
          let result = 0;
          for (let i = 0; i < roman.length; i++) {
            const current = romanNumerals[roman[i]];
            const next = romanNumerals[roman[i + 1]];
            if (next && current < next) {
              result -= current;
            } else {
              result += current;
            }
          }
          return result;
        };

        const arabicNumeral = romanToArabic(romanNumeral.toUpperCase());
        return `<h${tagNum}>${arabicNumeral}. ${title}</h${tagNum}>`;
      }
    );
    
    // 英語のセクション名が残っている場合の処理（サブセクションも含む）
    const sectionPatterns = [
      { en: "Introduction", ja: "導入" },
      { en: "Abstract", ja: "要旨" },
      { en: "Method", ja: "方法" },
      { en: "Methods", ja: "方法" },
      { en: "Methodology", ja: "方法論" },
      { en: "Results", ja: "結果" },
      { en: "Discussion", ja: "考察" },
      { en: "Results and Discussion", ja: "結果と考察" },
      { en: "Conclusion", ja: "結論" },
      { en: "Conclusions", ja: "結論" },
      { en: "Materials", ja: "材料" },
      { en: "Background", ja: "背景" },
      { en: "Experimental", ja: "実験" },
      { en: "Theory", ja: "理論" },
      { en: "Related Work", ja: "関連研究" },
      { en: "References", ja: "参考文献" },
      { en: "Bibliography", ja: "参考文献" }
    ];

    for (const pattern of sectionPatterns) {
      // タイトルを日本語に置き換える
      const regex = new RegExp(`(<h[1-6]>\\s*\\d+(?:\\.\\:|\\.)\\s*)${pattern.en}(\\s*<\\/h[1-6]>)`, 'gi');
      processedText = processedText.replace(regex, `$1${pattern.ja}$2`);
    }

    return processedText;
  } catch (e) {
    console.error('Error extracting translated text:', e instanceof Error ? e.message : 'Unknown error');
    return text; // エラーの場合は元のテキストを返す
  }
};

const TranslationViewer: React.FC<TranslationViewerProps> = ({
  translatedText,
  loading = false,
  error = null,
  chapter,
  width = '100%',
  height = '100%'
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [copied, setCopied] = useState(false);
  
  // 処理された翻訳テキスト（JSONパース処理を含む）
  const processedText = useMemo(() => {
    return extractTranslatedText(translatedText);
  }, [translatedText]);
  
  // フォントサイズを変更
  const changeFontSize = (delta: number) => {
    setFontSize(prev => Math.min(Math.max(prev + delta, 12), 24));
  };
  
  // テキストをコピー
  const copyText = () => {
    if (!processedText) return;
    
    // HTML形式から平文に変換してコピー
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedText;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    navigator.clipboard.writeText(plainText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text:', err);
      });
  };
  
  if (loading) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column'
        }}
      >
        <ErrorMessage message={error} />
      </Box>
    );
  }
  
  if (!processedText) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Typography>翻訳テキストがありません</Typography>
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* コントロールバー */}
      <Paper
        elevation={1}
        square
        sx={{
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {chapter && (
            <>
              <Chip 
                label={`Chapter ${chapter.chapter_number}`} 
                size="small" 
                color="primary" 
                variant="outlined" 
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                {chapter.title}
              </Typography>
            </>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="フォントサイズを小さく">
            <IconButton onClick={() => changeFontSize(-1)} disabled={fontSize <= 12}>
              <FormatSizeIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
          
          <Typography variant="body2" sx={{ mx: 1, minWidth: 20, textAlign: 'center' }}>
            {fontSize}
          </Typography>
          
          <Tooltip title="フォントサイズを大きく">
            <IconButton onClick={() => changeFontSize(1)} disabled={fontSize >= 24}>
              <FormatSizeIcon sx={{ fontSize: '1.4rem' }} />
            </IconButton>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Tooltip title={copied ? "コピーしました" : "テキストをコピー"}>
            <IconButton onClick={copyText}>
              {copied ? <DoneIcon color="success" /> : <ContentCopyIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      
      {/* 翻訳テキスト */}
      <Box
        ref={contentRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 4,
          bgcolor: 'background.paper',
          fontSize: `${fontSize}px`,
          lineHeight: 1.6,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: processedText }} />
      </Box>
    </Box>
  );
};

export default TranslationViewer;
