// ~/Desktop/smart-paper-v2/frontend/src/utils/MarkdownExporter.ts
import { Paper, PaperMetadata, TranslatedChapter } from '../api/papers';

/**
 * 論文データからMarkdownを生成するクラス
 */
export class MarkdownExporter {
  /**
   * 論文全体のMarkdownを生成
   * @param paper 論文データ
   * @param translatedChapters 翻訳された章データ (オプション)
   * @returns Markdown文字列
   */
  static generateFullMarkdown(paper: Paper, translatedChapters?: TranslatedChapter[]): string {
    let markdown = '';
    
    // ヘッダー情報
    markdown += this.generateHeader(paper.metadata);
    
    // 要約
    if (paper.summary) {
      markdown += `\n## 要約\n\n${this.cleanHtml(paper.summary)}\n\n`;
    }
    
    // 翻訳テキスト
    markdown += `\n## 翻訳\n\n`;
    
    // 章ごとの翻訳テキストを使用する場合
    if (translatedChapters && translatedChapters.length > 0) {
      // 章番号でソート
      const sortedChapters = [...translatedChapters].sort((a, b) => a.chapter_number - b.chapter_number);
      
      for (const chapter of sortedChapters) {
        markdown += `\n### ${chapter.chapter_number}. ${chapter.title}\n\n`;
        markdown += `${this.cleanHtml(chapter.translated_text)}\n\n`;
      }
    } 
    // 全文翻訳テキストを使用する場合
    else if (paper.translated_text) {
      markdown += this.cleanHtml(paper.translated_text);
    }
    
    return markdown;
  }
  
  /**
   * 論文のメタデータからMarkdownのヘッダーを生成
   * @param metadata 論文メタデータ
   * @returns Markdown文字列
   */
  static generateHeader(metadata: PaperMetadata | null): string {
    if (!metadata) return '# 無題の論文\n\n';
    
    const authors = metadata.authors.map(a => a.name).join(', ');
    
    let header = `# ${metadata.title}\n\n`;
    
    if (authors) {
      header += `**著者:** ${authors}\n\n`;
    }
    
    if (metadata.journal) {
      header += `**ジャーナル:** ${metadata.journal}\n\n`;
    }
    
    if (metadata.year) {
      header += `**出版年:** ${metadata.year}\n\n`;
    }
    
    if (metadata.doi) {
      header += `**DOI:** ${metadata.doi}\n\n`;
    }
    
    if (metadata.keywords && metadata.keywords.length > 0) {
      header += `**キーワード:** ${metadata.keywords.join(', ')}\n\n`;
    }
    
    return header;
  }
  
  /**
   * HTMLをプレーンテキストに変換
   * @param html HTML文字列
   * @returns プレーンテキスト
   */
  static cleanHtml(html: string): string {
    // 基本的なHTMLタグをMarkdown形式に変換
    let text = html;
    
    // リスト要素を一時的なマーカーに置換（ネストの処理のため）
    text = text.replace(/<ul>[\s\S]*?<\/ul>/g, (match) => {
      return match.replace(/<li>([\s\S]*?)<\/li>/g, '@@LI@@$1@@/LI@@');
    });
    text = text.replace(/<ol>[\s\S]*?<\/ol>/g, (match) => {
      return match.replace(/<li>([\s\S]*?)<\/li>/g, '@@OLI@@$1@@/OLI@@');
    });
    
    // テーブルを置換
    text = text.replace(/<table>[\s\S]*?<\/table>/g, '(表は省略されています)');
    
    // コードブロックを変換
    text = text.replace(/<pre>[\s\S]*?<\/pre>/g, (match) => {
      return '```\n' + match.replace(/<\/?pre>/g, '') + '\n```\n';
    });
    
    // 段落タグを変換
    text = text.replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n');
    
    // 見出しタグを変換
    text = text.replace(/<h1>([\s\S]*?)<\/h1>/g, '# $1\n\n');
    text = text.replace(/<h2>([\s\S]*?)<\/h2>/g, '## $1\n\n');
    text = text.replace(/<h3>([\s\S]*?)<\/h3>/g, '### $1\n\n');
    text = text.replace(/<h4>([\s\S]*?)<\/h4>/g, '#### $1\n\n');
    text = text.replace(/<h5>([\s\S]*?)<\/h5>/g, '##### $1\n\n');
    text = text.replace(/<h6>([\s\S]*?)<\/h6>/g, '###### $1\n\n');
    
    // 強調タグを変換
    text = text.replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**');
    text = text.replace(/<b>([\s\S]*?)<\/b>/g, '**$1**');
    text = text.replace(/<em>([\s\S]*?)<\/em>/g, '*$1*');
    text = text.replace(/<i>([\s\S]*?)<\/i>/g, '*$1*');
    
    // リンクタグを変換
    text = text.replace(/<a href="(.*?)">([\s\S]*?)<\/a>/g, '[$2]($1)');
    
    // リスト要素を実際のMarkdownに変換
    text = text.replace(/@@LI@@([\s\S]*?)@@\/LI@@/g, '- $1\n');
    text = text.replace(/@@OLI@@([\s\S]*?)@@\/OLI@@/g, '1. $1\n');
    
    // 改行タグと水平線を変換
    text = text.replace(/<br\s*\/?>/g, '\n');
    text = text.replace(/<hr\s*\/?>/g, '\n---\n');
    
    // インラインコードを変換
    text = text.replace(/<code>([\s\S]*?)<\/code>/g, '`$1`');
    
    // 残りのHTMLタグを除去
    text = text.replace(/<[^>]*>/g, '');
    
    // HTMLエンティティをデコード
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');
    
    // 連続した改行を整理
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
  }
  
  /**
   * Markdownファイルをダウンロード
   * @param markdown Markdown文字列
   * @param filename ファイル名
   */
  static downloadMarkdown(markdown: string, filename: string): void {
    // ファイル名に.mdが含まれていない場合は追加
    if (!filename.toLowerCase().endsWith('.md')) {
      filename += '.md';
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
  
  /**
   * Obsidianスタイルのフロントマターを含むMarkdownを生成
   * @param paper 論文データ
   * @returns Markdown文字列
   */
  static generateObsidianMarkdown(paper: Paper, translatedChapters?: TranslatedChapter[]): string {
    let markdown = '';
    
    // Obsidianフロントマター
    markdown += '---\n';
    
    if (paper.metadata) {
      markdown += `title: ${paper.metadata.title}\n`;
      
      if (paper.metadata.authors && paper.metadata.authors.length > 0) {
        markdown += `authors: [${paper.metadata.authors.map(a => `"${a.name}"`).join(', ')}]\n`;
      }
      
      if (paper.metadata.journal) {
        markdown += `journal: "${paper.metadata.journal}"\n`;
      }
      
      if (paper.metadata.year) {
        markdown += `year: ${paper.metadata.year}\n`;
      }
      
      if (paper.metadata.doi) {
        markdown += `doi: "${paper.metadata.doi}"\n`;
      }
      
      if (paper.metadata.keywords && paper.metadata.keywords.length > 0) {
        markdown += `tags: [${paper.metadata.keywords.map(k => `"${k}"`).join(', ')}]\n`;
      }
    }
    
    markdown += `date: "${new Date().toISOString().split('T')[0]}"\n`;
    markdown += '---\n\n';
    
    // 通常のMarkdownコンテンツを追加
    markdown += this.generateFullMarkdown(paper, translatedChapters);
    
    return markdown;
  }
}