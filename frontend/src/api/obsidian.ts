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
  folder_path: 'smart-paper-v2', // 修正: 日付を含めない
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
 * 文字列が日付形式（YYYY-MM-DD）かどうかをチェック
 * @param str チェックする文字列
 * @returns 日付形式ならtrue、そうでなければfalse
 */
export const isDateString = (str: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
};

/**
 * フォルダパスから日付フォルダを取り除く
 * @param path フォルダパス
 * @returns 日付フォルダを取り除いたパス
 */
export const removeDateFolderFromPath = (path: string): string => {
  // パスをセグメントに分割
  const segments = path.split('/').filter(s => s);
  
  // 各セグメントをチェックし、日付形式のセグメントを取り除く
  const filteredSegments = segments.filter(segment => !isDateString(segment));
  
  // フィルタリングされたセグメントを結合して返す
  return filteredSegments.join('/');
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
 * 単一のディレクトリを作成または取得
 * @param parentHandle 親ディレクトリハンドル
 * @param folderName 作成するフォルダ名
 * @returns 作成または取得したディレクトリハンドル
 */
export const createOrGetDirectory = async (
  parentHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<FileSystemDirectoryHandle> => {
  try {
    // フォルダが存在するか確認
    try {
      return await parentHandle.getDirectoryHandle(folderName);
    } catch (e) {
      // 存在しない場合は作成
      console.log(`Creating directory: ${folderName}`);
      return await parentHandle.getDirectoryHandle(folderName, { create: true });
    }
  } catch (error) {
    console.error(`Error creating/getting directory: ${folderName}`, error);
    throw new Error(`Failed to create/get directory: ${folderName}`);
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
 * ダウンロードしたMarkdownファイルをObsidianで開く
 * この関数は直接Obsidianアプリを開きます - 使用時に注意
 * @param vaultName Obsidianのvault名
 * @param filePath ファイルパス
 */
export const openInObsidian = (vaultName: string, filePath: string): void => {
  const uri = generateObsidianURI(vaultName, filePath);
  window.location.href = uri;
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
 * PDFファイル名用のフォーマットを適用して生成する
 * @param paper 論文データ
 * @returns 「著者名(刊行年)_論文タイトル.pdf」形式のファイル名
 */
export const formatPdfFileName = (paper: Paper): string => {
  if (!paper.metadata) {
    // メタデータがない場合は現在の日時をファイル名にする
    return `paper_${new Date().toISOString().slice(0, 10)}.pdf`;
  }
  
  // 著者名（最初の著者のみ）- 省略形（例：O Kehinde）も保持
  let authorName = 'unknown';
  if (paper.metadata.authors && paper.metadata.authors.length > 0) {
    // 著者名全体を使用（省略形も保持）
    authorName = paper.metadata.authors[0].name;
    // 特殊文字を除去
    authorName = authorName.replace(/[<>:"/\\|?*]/g, '');
    // スペースをアンダースコアに置換（ファイル名の見やすさのため）
    authorName = authorName.replace(/\s+/g, '_');
    // ファイル名として適切な長さに切り詰める（必要に応じて）
    if (authorName.length > 30) {
      authorName = authorName.substring(0, 30);
    }
  }
  
  // 出版年
  const year = paper.metadata.year || 'yyyy';
  
  // 論文タイトル
  let title = 'untitled';
  if (paper.metadata.title) {
    // タイトルから特殊文字を除去し、短く切り詰める
    title = paper.metadata.title
      .replace(/[<>:"/\\|?*]/g, '')  // ファイル名に使えない文字を除去
      .replace(/\s+/g, '_')           // スペースをアンダースコアに置換
      .substring(0, 50);              // 長すぎる場合は切り詰め
  }
  
  // 「著者名(刊行年)_論文タイトル.pdf」形式のファイル名を生成
  return `${authorName}(${year})_${title}.pdf`;
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
 * 指定されたフォルダパスが存在するか確認する関数
 * @param rootHandle ルートディレクトリハンドル
 * @param folderPath フォルダパス
 * @returns 存在する場合はそのディレクトリハンドル、存在しない場合はnull
 */
export const checkFolderExists = async (
  rootHandle: FileSystemDirectoryHandle,
  folderPath: string
): Promise<FileSystemDirectoryHandle | null> => {
  if (!folderPath) return null;
  
  const folders = folderPath.split('/').filter(f => f);
  let currentHandle = rootHandle;
  
  try {
    for (const folderName of folders) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(folderName);
      } catch (e) {
        // フォルダが存在しない場合
        console.error(`Folder does not exist: ${folderName} in path ${folderPath}`);
        return null;
      }
    }
    
    return currentHandle;
  } catch (error) {
    console.error(`Error checking folder existence: ${folderPath}`, error);
    return null;
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

    // ===== 大幅修正: フォルダ階層の作成部分 =====

    // 1. ベースフォルダパスの決定 (日付フォルダを含まないパス)
    let baseFolderPath = settings.folder_path || 'smart-paper-v2';
    
    // 2. 日付フォルダの除去 (既に含まれている場合)
    baseFolderPath = removeDateFolderFromPath(baseFolderPath);
    if (!baseFolderPath) baseFolderPath = 'smart-paper-v2';
    
    console.log(`Using cleaned base folder path: ${baseFolderPath}`);
    
    // 3. 一つずつフォルダを作成/取得
    const folderSegments = baseFolderPath.split('/').filter(segment => segment.trim() !== '');
    
    // まずベースフォルダを作成
    let currentDir = vaultHandle;
    for (const segment of folderSegments) {
      currentDir = await createOrGetDirectory(currentDir, segment);
    }
    
    // 4. 現在の日付フォルダを作成/取得
    const now = new Date();
    const dateFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    console.log(`Creating/getting date folder: ${dateFolder}`);
    const dateFolderHandle = await createOrGetDirectory(currentDir, dateFolder);
    
    // 5. 添付ファイルフォルダの処理 (必要な場合)
    let attachmentsHandle: FileSystemDirectoryHandle | null = null;
    let pdfFileName = '';
    
    if (settings.include_pdf) {
      try {
        // 添付ファイルフォルダの作成/取得
        attachmentsHandle = await createOrGetDirectory(dateFolderHandle, '添付ファイル');
        
        // PDFファイル名の生成
        pdfFileName = formatPdfFileName(paper);
        
        // PDFデータの取得とファイル保存
        let pdfBlob: Blob | null = localPdfBlob || null;
        if (!pdfBlob && paper.id) {
          pdfBlob = getCachedPdfBlob(paper.id);
        }
        
        if (pdfBlob && attachmentsHandle) {
          await savePdfBlobToDirectory(pdfBlob, attachmentsHandle, pdfFileName);
          console.log(`PDFを添付ファイルフォルダに保存しました: ${pdfFileName}`);
        }
      } catch (error) {
        console.error('PDF保存エラー:', error);
        // PDFの保存に失敗してもMarkdownの保存は続行
      }
    }
    
    // 6. Markdownの生成と保存
    let markdown = '';
    if (settings.file_type === 'md') {
      markdown = MarkdownExporter.generateFullMarkdown(paper, chapters);
      
      if (settings.include_pdf && pdfFileName) {
        markdown += '\n\n## PDF原文\n\n';
        markdown += `![[添付ファイル/${pdfFileName}]]\n`;
      }
    } else {
      markdown = MarkdownExporter.generateFullMarkdown(paper, chapters);
    }
    
    // Markdownファイルの書き込み
    try {
      const fileHandle = await dateFolderHandle.getFileHandle(fullFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(new Blob([markdown], { type: settings.file_type === 'md' ? 'text/markdown' : 'text/plain' }));
      await writable.close();
      console.log(`Markdown file written successfully: ${fullFileName}`);
    } catch (error) {
      console.error(`Failed to write file: ${fullFileName}`, error);
      throw new Error(`ファイル「${fullFileName}」の書き込みに失敗しました`);
    }
    
    // 結果情報の設定
    result.exported = true;
    result.export_path = `${baseFolderPath}/${dateFolder}/${fullFileName}`;
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
    
    // 修正: 自動開く機能を削除
    // 以前は下記の設定があった場合に自動的にObsidianアプリを開いていたが、
    // ユーザーエクスペリエンス向上のため機能を削除
    /*
    if (settings.open_after_export && settings.vault_name) {
      setTimeout(() => {
        openInObsidian(settings.vault_name, result.export_path || '');
      }, 500);
    }
    */
    
    return result;
  } catch (error) {
    console.error('Error exporting to Obsidian:', error);
    throw error;
  }
};