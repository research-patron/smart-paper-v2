import { Paper } from './papers';

// Obsidian関連の型定義
export interface ObsidianSettings {
  vault_path: string;
  file_name_format: string;
  created_at: Date;
  updated_at: Date;
}

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
 * Obsidianがインストールされているか確認
 * (完全に信頼性の高い方法ではありませんが、URI schemeの処理確認として使用可能)
 * @returns 確認結果のメッセージ
 */
export const checkObsidianInstallation = async (): Promise<boolean> => {
  try {
    // iframe を使用してobsidian://プロトコルを検出する試み
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // タイムアウト設定（ユーザーがダイアログを閉じない場合に備えて）
    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 1000);
    });
    
    // obsidianプロトコルを開こうとする
    const checkProtocol = new Promise<boolean>((resolve) => {
      iframe.onload = () => resolve(true);
      iframe.onerror = () => resolve(false);
      // 空のVaultを開こうとする（単にプロトコルハンドラーのチェック）
      iframe.src = 'obsidian://open';
    });
    
    // タイムアウトか応答のどちらか早い方を待つ
    const result = await Promise.race([checkProtocol, timeout]);
    document.body.removeChild(iframe);
    
    return result;
  } catch (e) {
    console.error('Error checking Obsidian installation:', e);
    return false;
  }
};