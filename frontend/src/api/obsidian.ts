// ~/Desktop/smart-paper-v2/frontend/src/api/obsidian.ts
import { Paper, TranslatedChapter } from './papers';
import { MarkdownExporter } from '../utils/MarkdownExporter';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

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

// Obsidian連携状態の型定義
export interface ObsidianState {
  exported: boolean;
  export_path?: string;
  exported_at?: Date;
  error?: string;
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
      mode: 'readwrite',
    });
    
    // 選択されたフォルダのパスを取得
    const dirPath = handle.name;
    const vaultName = extractVaultName(dirPath);
    
    // ハンドルをセッションストレージに保存
    sessionStorage.setItem('obsidian_vault_handle', JSON.stringify({
      name: handle.name,
      kind: handle.kind
    }));
    
    // FileSystemHandleはシリアライズできないため、グローバル変数に保存
    if (!window.obsidianHandles) {
      window.obsidianHandles = new Map();
    }
    window.obsidianHandles.set('vault', handle);
    
    return { dirPath, vaultName };
  } catch (error) {
    console.error('Error selecting Obsidian vault:', error);
    return null;
  }
};

/**
 * フォルダパスからディレクトリツリーを作成
 * @param rootHandle ルートディレクトリハンドル
 * @param path 作成するパス (例: "folder1/folder2/folder3")
 * @returns 作成したディレクトリのハンドル
 */
export const createDirectoryPath = async (rootHandle: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle> => {
  const folders = path.split('/').filter(f => f);
  let currentHandle = rootHandle;
  
  for (const folderName of folders) {
    try {
      // フォルダが存在するか確認
      try {
        currentHandle = await currentHandle.getDirectoryHandle(folderName);
      } catch (e) {
        // フォルダが存在しない場合は作成
        currentHandle = await currentHandle.getDirectoryHandle(folderName, { create: true });
      }
    } catch (error) {
      console.error(`Error creating directory: ${folderName}`, error);
      throw new Error(`Failed to create directory: ${folderName}`);
    }
  }
  
  return currentHandle;
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
 * PDF URLをダウンロードしてファイルとして保存
 * @param pdfUrl PDFのURL
 * @param directoryHandle 保存先ディレクトリハンドル
 * @param fileName ファイル名
 */
const savePdfToDirectory = async (pdfUrl: string, directoryHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> => {
  try {
    // PDFをフェッチ
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error('PDF fetch failed');
    
    const blob = await response.blob();
    
    // ファイル書き込み
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    
    console.log(`PDF saved successfully: ${fileName}`);
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw error;
  }
};

/**
 * Firestore上の論文のObsidian連携状態を更新
 * @param paperId 論文ID
 * @param state 連携状態
 */
export const updateObsidianState = async (paperId: string, state: Partial<ObsidianState>): Promise<void> => {
  try {
    const paperRef = doc(db, 'papers', paperId);
    await updateDoc(paperRef, {
      obsidian: {
        ...state,
        updated_at: Timestamp.now()
      }
    });
  } catch (error) {
    console.error('Error updating Obsidian state:', error);
    throw error;
  }
};

/**
 * 論文をObsidianに直接エクスポートする
 * @param paper 論文データ
 * @param chapters 翻訳された章データ
 * @param settings Obsidian設定
 * @returns エクスポート結果情報
 */
export const exportToObsidian = async (
  paper: Paper, 
  chapters: TranslatedChapter[],
  settings: ObsidianSettings
): Promise<ObsidianState> => {
  try {
    // 結果を初期化
    const result: ObsidianState = {
      exported: false
    };
    
    // ファイル名の生成
    const fileName = formatFileName(settings.file_name_format, paper);
    const extension = settings.file_type === 'md' ? '.md' : '.txt';
    const fullFileName = fileName.endsWith(extension) ? fileName : fileName + extension;
    
    // vaultハンドルを取得
    let vaultHandle = window.obsidianHandles?.get('vault') as FileSystemDirectoryHandle;
    
    // vaultハンドルがない場合は選択を促す
    if (!vaultHandle) {
      const result = await selectObsidianVault();
      if (!result) {
        throw new Error('Obsidian vaultが選択されていません');
      }
      vaultHandle = window.obsidianHandles?.get('vault') as FileSystemDirectoryHandle;
    }
    
    // 権限を確認
    const permission = await vaultHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const newPermission = await vaultHandle.requestPermission({ mode: 'readwrite' });
      if (newPermission !== 'granted') {
        throw new Error('Obsidian vaultへの書き込み権限がありません');
      }
    }
    
    // フォルダパスがある場合は作成
    let targetDirHandle = vaultHandle;
    if (settings.folder_path) {
      targetDirHandle = await createDirectoryPath(vaultHandle, settings.folder_path);
    }
    
    // Markdown生成
    const pdfFileName = paper.file_path ? paper.file_path.split('/').pop() : '';
    let markdown = '';
    
    if (settings.file_type === 'md') {
      markdown = MarkdownExporter.generateObsidianMarkdown(paper, chapters, pdfFileName);
    } else {
      markdown = MarkdownExporter.generateFullMarkdown(paper, chapters);
    }
    
    // ファイル書き込み
    const fileHandle = await targetDirHandle.getFileHandle(fullFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([markdown], { type: settings.file_type === 'md' ? 'text/markdown' : 'text/plain' }));
    await writable.close();
    
    // PDF連携処理
    if (settings.include_pdf && paper.file_path) {
      try {
        // PDFのURLを取得
        const storage_ref = ref(storage, paper.file_path.replace('gs://', ''));
        const pdfUrl = await getDownloadURL(storage_ref);
        
        // 埋め込みフォルダを作成
        let embedDirHandle = targetDirHandle;
        if (settings.create_embed_folder) {
          embedDirHandle = await createDirectoryPath(vaultHandle, 'Embed Documents');
        }
        
        // PDFを保存
        await savePdfToDirectory(pdfUrl, embedDirHandle, pdfFileName || `paper_${paper.id}.pdf`);
      } catch (pdfError) {
        console.error('PDF save error:', pdfError);
        // PDFの保存に失敗してもMarkdownの保存は成功とみなす
      }
    }
    
    // 結果を更新
    result.exported = true;
    result.export_path = settings.folder_path ? `${settings.folder_path}/${fullFileName}` : fullFileName;
    result.exported_at = new Date();
    
    // Firestoreに保存状態を更新
    if (paper.id) {
      await updateObsidianState(paper.id, result);
    }
    
    // Obsidianで開く（設定されている場合）
    if (settings.open_after_export && settings.vault_name) {
      setTimeout(() => {
        openInObsidian(settings.vault_name, result.export_path || '');
      }, 500);
    }
    
    return result;
  } catch (error) {
    console.error('Error exporting to Obsidian:', error);
    // Firestoreにエラー状態を保存
    if (paper.id) {
      await updateObsidianState(paper.id, {
        exported: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    throw error;
  }
};

// 将来のためにWindow型を拡張して、obsidianHandlesプロパティを追加
declare global {
  interface Window {
    obsidianHandles?: Map<string, FileSystemDirectoryHandle>;
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}