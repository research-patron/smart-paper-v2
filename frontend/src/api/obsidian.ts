// ~/Desktop/smart-paper-v2/frontend/src/api/obsidian.ts
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

// Obsidian連携状態の型定義
export interface ObsidianState {
  exported: boolean;
  export_path?: string;
  exported_at?: Date;
  error?: string;
}

// PDFキャッシュ用のグローバルストア（ブラウザメモリ内）
declare global {
  interface Window {
    obsidianHandles?: Map<string, FileSystemDirectoryHandle>;
    pdfCache?: Map<string, Blob>;
    obsidianVaultRoot?: FileSystemDirectoryHandle;
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}

// デフォルトのObsidian設定
export const DEFAULT_OBSIDIAN_SETTINGS: ObsidianSettings = {
  vault_dir: '',
  vault_name: '',
  folder_path: 'smart-paper-v2/' + new Date().toISOString().split('T')[0],
  file_name_format: '{authors}_{title}_{year}',
  file_type: 'md',
  open_after_export: true,
  include_pdf: true,
  create_embed_folder: true,
  auto_export: true,
  created_at: new Date(),
  updated_at: new Date()
};

// 初期化
if (typeof window !== 'undefined') {
  if (!window.pdfCache) {
    window.pdfCache = new Map<string, Blob>();
  }
  if (!window.obsidianHandles) {
    window.obsidianHandles = new Map<string, FileSystemDirectoryHandle>();
  }
}

/**
 * PDF Blobをキャッシュに保存
 * @param paperId 論文ID
 * @param pdfBlob PDFのBlob
 */
export const cachePdfBlob = (paperId: string, pdfBlob: Blob): void => {
  if (window.pdfCache) {
    window.pdfCache.set(paperId, pdfBlob);
  }
};

/**
 * キャッシュからPDF Blobを取得
 * @param paperId 論文ID
 * @returns PDF Blob (存在しない場合はnull)
 */
export const getCachedPdfBlob = (paperId: string): Blob | null => {
  if (window.pdfCache && window.pdfCache.has(paperId)) {
    return window.pdfCache.get(paperId) || null;
  }
  return null;
};

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
    
    // ルートハンドルをグローバル変数に保存
    window.obsidianVaultRoot = handle;
    
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
    
    // 設定情報をローカルストレージに保存
    const settings = {
      ...DEFAULT_OBSIDIAN_SETTINGS,
      vault_dir: dirPath,
      vault_name: vaultName,
      updated_at: new Date()
    };
    localStorage.setItem('obsidian_settings', JSON.stringify(settings));
    
    return { dirPath, vaultName };
  } catch (error) {
    console.error('Error selecting Obsidian vault:', error);
    return null;
  }
};

/**
 * 保存済みのObsidianのVaultを取得
 * @param skipPermissionPrompt 権限リクエストのプロンプトをスキップするかどうか
 * @returns Vaultハンドル。ハンドルが保存されていない場合はnull
 */
export const getVault = async (skipPermissionPrompt: boolean = false): Promise<FileSystemDirectoryHandle | null> => {
  // すでにセッション内にVaultハンドルがある場合はそれを使用
  if (window.obsidianVaultRoot) {
    // 権限をチェック
    const permission = await window.obsidianVaultRoot.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return window.obsidianVaultRoot;
    }
    
    // 権限がなければ再リクエスト（プロンプトスキップフラグがfalseの場合のみ）
    if (!skipPermissionPrompt) {
      try {
        const newPermission = await window.obsidianVaultRoot.requestPermission({ mode: 'readwrite' });
        if (newPermission === 'granted') {
          return window.obsidianVaultRoot;
        }
      } catch (error) {
        console.error('Error requesting permission for existing vault handle:', error);
      }
    }
  }
  
  // または obsidianHandles から取得
  const vaultHandle = window.obsidianHandles?.get('vault') as FileSystemDirectoryHandle;
  if (vaultHandle) {
    // 権限をチェック
    try {
      const permission = await vaultHandle.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        window.obsidianVaultRoot = vaultHandle;
        return vaultHandle;
      }
      
      // 権限がなければ再リクエスト（プロンプトスキップフラグがfalseの場合のみ）
      if (!skipPermissionPrompt) {
        const newPermission = await vaultHandle.requestPermission({ mode: 'readwrite' });
        if (newPermission === 'granted') {
          window.obsidianVaultRoot = vaultHandle;
          return vaultHandle;
        }
      }
    } catch (error) {
      console.error('Error checking permission for vault handle:', error);
    }
  }
  
  return null;
};

/**
 * Obsidian Vaultの選択状態を確認
 * @returns Vaultが選択されているかどうか
 */
export const isVaultSelected = (): boolean => {
  return !!(window.obsidianVaultRoot || window.obsidianHandles?.get('vault'));
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
    let uploadDate: string;
    
    if (paper.uploaded_at) {
      // Firebaseのタイムスタンプオブジェクトかどうかをチェック
      if (typeof paper.uploaded_at.toDate === 'function') {
        // Firebaseのタイムスタンプオブジェクトの場合
        uploadDate = paper.uploaded_at.toDate().toISOString().slice(0, 10);
      } else if (paper.uploaded_at instanceof Date) {
        // JavaScriptのDateオブジェクトの場合
        uploadDate = paper.uploaded_at.toISOString().slice(0, 10);
      } else if (typeof paper.uploaded_at === 'string') {
        // 文字列の場合
        uploadDate = new Date(paper.uploaded_at).toISOString().slice(0, 10);
      } else if (typeof paper.uploaded_at === 'number') {
        // 数値(タイムスタンプ)の場合
        uploadDate = new Date(paper.uploaded_at).toISOString().slice(0, 10);
      } else {
        // その他の場合は現在の日付
        uploadDate = new Date().toISOString().slice(0, 10);
      }
    } else {
      // uploaded_atがない場合は現在の日付
      uploadDate = new Date().toISOString().slice(0, 10);
    }
    
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
 * PDF Blobをファイルとして保存
 * @param pdfBlob PDFのBlob
 * @param directoryHandle 保存先ディレクトリハンドル
 * @param fileName ファイル名
 */
const savePdfBlobToDirectory = async (pdfBlob: Blob, directoryHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> => {
  try {
    // ファイル書き込み
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(pdfBlob);
    await writable.close();
    
    console.log(`PDF saved successfully: ${fileName}`);
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw error;
  }
};

/**
 * 論文をObsidianに直接エクスポートする
 * @param paper 論文データ
 * @param chapters 翻訳された章データ
 * @param settings Obsidian設定
 * @param localPdfBlob ローカルで保持しているPDF Blob
 * @param userInitiated ユーザーが明示的に実行したアクションかどうか
 * @returns エクスポート結果情報
 */
export const exportToObsidian = async (
  paper: Paper, 
  chapters: TranslatedChapter[],
  settings: ObsidianSettings,
  localPdfBlob?: Blob,
  userInitiated: boolean = false
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
    
    // Vault rootハンドルを取得
    let vaultHandle: FileSystemDirectoryHandle | null = null;
    
    if (userInitiated) {
      // ユーザーが明示的に実行した場合は、必要に応じて新しいVaultを選択
      try {
        vaultHandle = await getVault();
        if (!vaultHandle) {
          const result = await selectObsidianVault();
          vaultHandle = window.obsidianVaultRoot || null;
        }
      } catch (error) {
        console.error('Failed to select vault:', error);
        throw new Error('Obsidian vaultの選択に失敗しました');
      }
    } else {
      // 自動実行の場合は、既存のハンドルのみ使用
      vaultHandle = await getVault();
    }
    
    if (!vaultHandle) {
      return {
        exported: false,
        error: 'Obsidian vaultが選択されていません。「Obsidianに保存」ボタンをクリックして保存先を設定してください。'
      };
    }
    
    // 常にsmart-paper-v2フォルダを作成
    let smartPaperRootHandle: FileSystemDirectoryHandle;
    try {
      // すでに存在するか確認
      smartPaperRootHandle = await vaultHandle.getDirectoryHandle('smart-paper-v2');
    } catch (e) {
      // 存在しない場合は作成
      smartPaperRootHandle = await vaultHandle.getDirectoryHandle('smart-paper-v2', { create: true });
    }
    
    // PDFを保存する添付ファイルフォルダを作成
    let attachmentsHandle: FileSystemDirectoryHandle;
    try {
      // すでに存在するか確認
      attachmentsHandle = await smartPaperRootHandle.getDirectoryHandle('添付ファイル');
    } catch (e) {
      // 存在しない場合は作成
      attachmentsHandle = await smartPaperRootHandle.getDirectoryHandle('添付ファイル', { create: true });
    }
    
    // 日付フォルダを作成（YYYY-MM-DD形式）- ローカル時間に基づく日付を使用
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    console.log('Creating/accessing date folder for:', today); // デバッグログ追加

    let dateFolderHandle: FileSystemDirectoryHandle;
    try {
      // すでに存在するか確認
      dateFolderHandle = await smartPaperRootHandle.getDirectoryHandle(today);
    } catch (e) {
      // 存在しない場合は作成
      dateFolderHandle = await smartPaperRootHandle.getDirectoryHandle(today, { create: true });
    }
    
    // PDFファイル名を取得
    let pdfFileName = '';
    if (paper.file_path) {
      // ファイルパスからファイル名を抽出
      pdfFileName = paper.file_path.split('/').pop() || '';
    } else if (paper.id) {
      // IDをもとにファイル名を生成
      pdfFileName = `paper_${paper.id}.pdf`;
    } else {
      // フォールバック: タイムスタンプでファイル名を生成
      pdfFileName = `paper_${Date.now()}.pdf`;
    }
    
    // PDF Blobを取得
    let pdfBlob: Blob | null = null;
    
    // 1. 引数で渡されたBlobを優先使用
    if (localPdfBlob) {
      pdfBlob = localPdfBlob;
    } 
    // 2. キャッシュからBlobを取得
    else if (paper.id) {
      pdfBlob = getCachedPdfBlob(paper.id);
    }
    
    // PDFが存在する場合、添付ファイルフォルダに保存
    if (pdfBlob) {
      try {
        await savePdfBlobToDirectory(pdfBlob, attachmentsHandle, pdfFileName);
        console.log(`PDFを添付ファイルフォルダに保存しました: ${pdfFileName}`);
      } catch (pdfError) {
        console.error('PDF保存エラー:', pdfError);
        // PDFの保存に失敗してもMarkdownの保存は続行
      }
    }
    
    // Markdown生成（PDFへのリンクを追加）
    let markdown = '';
    if (settings.file_type === 'md') {
      // カスタムMarkdownを生成（PDFリンクを明示的に添付ファイルフォルダに指定）
      markdown = MarkdownExporter.generateFullMarkdown(paper, chapters);
      
      // PDFリンクを追加
      if (pdfBlob) {
        markdown += '\n\n## PDF原文\n\n';
        markdown += `![[添付ファイル/${pdfFileName}]]\n`;
      }
    } else {
      markdown = MarkdownExporter.generateFullMarkdown(paper, chapters);
    }
    
    // Markdownファイルを日付フォルダに書き込み
    const fileHandle = await dateFolderHandle.getFileHandle(fullFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([markdown], { type: settings.file_type === 'md' ? 'text/markdown' : 'text/plain' }));
    await writable.close();
    
    // 結果を更新
    result.exported = true;
    result.export_path = `smart-paper-v2/${today}/${fullFileName}`;
    result.exported_at = new Date();
    
    // エクスポート状態をローカルストレージに保存
    if (paper.id) {
      const exportStatus = JSON.parse(localStorage.getItem('obsidian_export_status') || '{}');
      exportStatus[paper.id] = {
        exported: true,
        export_path: result.export_path,
        exported_at: result.exported_at.toISOString()
      };
      localStorage.setItem('obsidian_export_status', JSON.stringify(exportStatus));
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
    throw error;
  }
};