import { Paper, TranslatedChapter } from './papers';
import { MarkdownExporter } from '../utils/MarkdownExporter';

// Obsidian関連の型定義
export interface ObsidianSettings {
  vault_dir: string;
  vault_name: string;
  folder_path: string;
  file_name_format: string;
  file_type: 'md' | 'txt';
  open_after_export: boolean;
  include_pdf: boolean;
  create_embed_folder: boolean;
  auto_export: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * 選択されたフォルダからVault名を抽出する
 * @param dirPath フォルダのパス
 * @returns Vault名
 */
export const extractVaultName = (dirPath: string): string => {
  // パスの最後のディレクトリ名をVault名として使用
  return dirPath.split('/').pop() || dirPath.split('\\').pop() || 'vault';
};

/**
 * ユーザーにフォルダを選択させる
 * @returns 選択されたフォルダのパスとVault名
 */
export const selectObsidianVault = async (): Promise<{ dirPath: string; vaultName: string } | null> => {
  try {
    // フォルダ選択ダイアログを表示
    const handle = await window.showDirectoryPicker({
      mode: 'read',
    });
    
    // 選択されたフォルダのパスを取得
    const dirPath = handle.name;
    const vaultName = extractVaultName(dirPath);
    
    return { dirPath, vaultName };
  } catch (error) {
    console.error('Error selecting Obsidian vault:', error);
    return null;
  }
};

/**
 * Obsidian URIを生成する
 * @param vaultName Obsidianのvault名
 * @param filePath ファイルパス (オプション)
 * @returns ObsidianのURI
 */
export const generateObsidianURI = (vaultName: string, filePath?: string): string => {
  // Obsidian URI形式: obsidian://open?vault=VaultName&file=FilePath
  let uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}`;
  
  if (filePath) {
    uri += `&file=${encodeURIComponent(filePath)}`;
  }
  
  return uri;
};

/**
 * ファイル名フォーマットを適用してファイル名を生成する
 * @param format ファイル名フォーマット (例: "{authors}_{title}_{year}")
 * @param paper 論文データ
 * @returns フォーマットに基づいて生成されたファイル名
 */
export const formatFileName = (format: string, paper: Paper): string => {
  if (!paper.metadata) {
    // メタデータがない場合は現在の日時をファイル名にする
    return `paper_${new Date().toISOString().slice(0, 10)}`;
  }
  
  // フォーマット文字列内のプレースホルダーを置換
  let fileName = format;
  
  // 著者名（最初の著者のみ）
  if (format.includes('{authors}') && paper.metadata.authors && paper.metadata.authors.length > 0) {
    const authorName = paper.metadata.authors[0].name.split(' ')[0]; // 姓のみを使用
    fileName = fileName.replace('{authors}', authorName);
  }
  
  // 論文タイトル
  if (format.includes('{title}') && paper.metadata.title) {
    // タイトルから特殊文字を除去し、短く切り詰める
    const safeTitle = paper.metadata.title
      .replace(/[<>:"/\\|?*]/g, '')  // ファイル名に使えない文字を除去
      .replace(/\s+/g, '_')           // スペースをアンダースコアに置換
      .substring(0, 50);              // 長すぎる場合は切り詰め
    
    fileName = fileName.replace('{title}', safeTitle);
  }
  
  // 出版年
  if (format.includes('{year}') && paper.metadata.year) {
    fileName = fileName.replace('{year}', paper.metadata.year.toString());
  }
  
  // ジャーナル名
  if (format.includes('{journal}') && paper.metadata.journal) {
    const safeJournal = paper.metadata.journal
      .replace(/[<>:"/\\|?*]/g, '')  // ファイル名に使えない文字を除去
      .replace(/\s+/g, '_')          // スペースをアンダースコアに置換
      .substring(0, 30);             // 長すぎる場合は切り詰め
    
    fileName = fileName.replace('{journal}', safeJournal);
  }
  
  // DOI
  if (format.includes('{doi}') && paper.metadata.doi) {
    const safeDoi = paper.metadata.doi.replace(/[<>:"/\\|?*]/g, '-');
    fileName = fileName.replace('{doi}', safeDoi);
  }
  
  // アップロード日時
  if (format.includes('{date}')) {
    const uploadDate = paper.uploaded_at ? paper.uploaded_at.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    fileName = fileName.replace('{date}', uploadDate);
  }
  
  // 残りのプレースホルダーを空文字に置換
  fileName = fileName
    .replace(/{authors}/g, 'unknown_author')
    .replace(/{title}/g, 'untitled')
    .replace(/{year}/g, 'yyyy')
    .replace(/{journal}/g, 'unknown_journal')
    .replace(/{doi}/g, 'no-doi')
    .replace(/{date}/g, new Date().toISOString().slice(0, 10));
  
  return fileName;
};

/**
 * ダウンロードしたMarkdownファイルをObsidianで開く
 * @param vaultName Obsidianのvault名
 * @param filePath ファイルパス
 */
export const openInObsidian = (vaultName: string, filePath: string): void => {
  const uri = generateObsidianURI(vaultName, filePath);
  window.location.href = uri;
};

/**
 * 論文をObsidianにエクスポートする
 * @param paper 論文データ
 * @param chapters 翻訳された章データ
 * @param settings Obsidian設定
 */
export const exportToObsidian = async (
  paper: Paper,
  chapters: TranslatedChapter[],
  settings: ObsidianSettings
): Promise<void> => {
  try {
    // ファイル名の生成
    const fileName = formatFileName(settings.file_name_format, paper);
    const extension = settings.file_type === 'md' ? '.md' : '.txt';
    const fullFileName = fileName.endsWith(extension) ? fileName : fileName + extension;

    // Markdown生成
    const markdown = MarkdownExporter.generateObsidianMarkdown(paper, chapters);
    
    // マークダウンファイルのダウンロード
    const blob = new Blob([markdown], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fullFileName;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Obsidianで開く（設定されている場合）
    if (settings.open_after_export && settings.vault_name) {
      // フォルダパスがある場合は結合
      let filePath = fullFileName;
      if (settings.folder_path) {
        filePath = `${settings.folder_path}/${fullFileName}`;
      }
      
      setTimeout(() => {
        openInObsidian(settings.vault_name, filePath);
      }, 500);
    }
  } catch (error) {
    console.error('Error exporting to Obsidian:', error);
    throw error;
  }
};
