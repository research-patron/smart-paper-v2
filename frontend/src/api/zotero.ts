import { Paper } from './papers';

// Zotero Web APIのベースURL
const ZOTERO_API_URL = 'https://api.zotero.org';

// Zotero ConnectorのベースURL
const ZOTERO_CONNECTOR_URL = 'http://127.0.0.1:23119';

/**
 * DOIを使ってZoteroに論文を追加するためのURLを生成する
 * @param doi 論文のDOI
 * @returns Zotero Translatorを使ってDOIから論文を取得するためのURL
 */
export const generateZoteroTranslatorUrl = (doi: string): string => {
  // DOIのURLを生成 (例: https://doi.org/10.1038/nature12373)
  const doiUrl = `https://doi.org/${encodeURIComponent(doi)}`;
  
  // Zotero TranslatorのURLを生成
  // これはZotero Connectorを使用している場合、自動的にZoteroが開いて論文を追加する
  return `${ZOTERO_CONNECTOR_URL}/connector/save?uri=${encodeURIComponent(doiUrl)}`;
};

/**
 * DOIを使ってZoteroアクションを実行する
 * @param doi 論文のDOI
 * @returns 成功した場合はtrue、失敗した場合はfalse
 */
export const addToZoteroByDOI = async (doi: string): Promise<boolean> => {
  try {
    // ZoteroコネクタのURLを生成
    const url = generateZoteroTranslatorUrl(doi);
    
    // 新しいタブでZotero Connector URLを開く (現在のページは保持)
    window.open(url, '_blank');
    
    return true;
  } catch (error) {
    console.error('Failed to add to Zotero:', error);
    return false;
  }
};

/**
 * Zotero Connectorが利用可能かどうかを確認する
 * より信頼性の高いWeb Extension Content Script APIを使用して検出
 * @returns Zotero Connectorが利用可能な場合はtrue
 */
export const checkZoteroConnector = async (): Promise<boolean> => {
  try {
    // Zotero Connector拡張機能が利用できるかどうかをチェック
    // まず標準的なZotero Object APIをチェック
    if (typeof window !== 'undefined' && 'Zotero' in window) {
      console.log('Zotero Connector detected via window.Zotero');
      return true;
    }

    // Chrome/Firefox Content Scriptを経由したZotero Connectorをチェック
    const pingPromise = new Promise<boolean>((resolve) => {
      // カスタムイベントを作成してZotero Connectorをチェック
      const event = new CustomEvent('zotero-connector-ping');
      
      // レスポンスをリッスン (タイムアウト付き)
      const timeout = setTimeout(() => {
        document.removeEventListener('zotero-connector-response', listener);
        resolve(false);
      }, 500);
      
      const listener = (e: Event) => {
        clearTimeout(timeout);
        document.removeEventListener('zotero-connector-response', listener);
        resolve(true);
      };
      
      document.addEventListener('zotero-connector-response', listener);
      document.dispatchEvent(event);
    });

    // WebSocket経由でZotero Standalone (Connector)をチェック
    // タイムアウトが短いため、先にチェック
    const socketPromise = new Promise<boolean>((resolve) => {
      try {
        const socket = new WebSocket(`ws://127.0.0.1:23119/connector/`);
        
        socket.onopen = () => {
          socket.close();
          resolve(true);
        };
        
        socket.onerror = () => {
          resolve(false);
        };
      } catch (error) {
        resolve(false);
      }
    });

    // HTTP経由でのダイレクトチェック (最も信頼性が高い)
    const httpPromise = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // キャッシュ回避のためタイムスタンプパラメータを追加
      img.src = `${ZOTERO_CONNECTOR_URL}/connector/ping?t=${new Date().getTime()}`;
    });

    // 最初に解決されたPromiseを使用
    return await Promise.race([pingPromise, socketPromise, httpPromise]);
  } catch (error) {
    console.error('Error checking Zotero Connector:', error);
    return false;
  }
};

/**
 * アイテムタイプのリスト
 * Zoteroの主要なアイテムタイプのリスト
 */
export const ZOTERO_ITEM_TYPES = [
  { value: 'journalArticle', label: 'ジャーナル論文' },
  { value: 'book', label: '書籍' },
  { value: 'bookSection', label: '書籍の章' },
  { value: 'conferencePaper', label: '学会論文' },
  { value: 'report', label: 'レポート' },
  { value: 'thesis', label: '論文（学位論文）' },
  { value: 'webpage', label: 'Webページ' },
  { value: 'document', label: '文書' },
  { value: 'preprint', label: 'プレプリント' },
];

/**
 * 論文のメタデータをZotero互換のフォーマットに変換する
 * @param paper 論文データ
 * @param itemType Zoteroのアイテムタイプ
 * @returns Zotero互換のメタデータ
 */
export const convertToZoteroFormat = (paper: Paper, itemType: string = 'journalArticle') => {
  if (!paper.metadata) {
    return null;
  }
  
  const { metadata } = paper;
  
  // ベースとなるZoteroアイテムデータ
  const zoteroItem: any = {
    itemType,
    title: metadata.title || '',
    creators: [],
    date: metadata.year ? metadata.year.toString() : '',
    DOI: metadata.doi || '',
    tags: metadata.keywords ? metadata.keywords.map(keyword => ({ tag: keyword })) : [],
    abstractNote: metadata.abstract || '',
  };
  
  // アイテムタイプに応じたフィールドを設定
  if (itemType === 'journalArticle') {
    zoteroItem.publicationTitle = metadata.journal || '';
  } else if (itemType === 'conferencePaper') {
    zoteroItem.conferenceName = metadata.journal || '';
  } else if (itemType === 'book' || itemType === 'bookSection') {
    zoteroItem.publisher = metadata.journal || '';
  }
  
  // 著者情報を追加
  if (metadata.authors && metadata.authors.length > 0) {
    metadata.authors.forEach(author => {
      // 著者名を姓と名に分割
      const nameParts = author.name.split(' ');
      let lastName = '';
      let firstName = '';
      
      if (nameParts.length === 1) {
        lastName = nameParts[0];
      } else if (nameParts.length === 2) {
        // 単純に最初の部分を名、最後の部分を姓と仮定
        firstName = nameParts[0];
        lastName = nameParts[1];
      } else {
        // 3つ以上の部分がある場合、最後の部分を姓、それ以外を名とする
        lastName = nameParts.pop() || '';
        firstName = nameParts.join(' ');
      }
      
      zoteroItem.creators.push({
        creatorType: 'author',
        lastName,
        firstName,
      });
    });
  }
  
  return zoteroItem;
};

/**
 * Zotero Web Connector の存在を確認する
 * @returns Zotero Connectorがインストールされている場合はtrue
 * 
 * 注: 現代のブラウザではセキュリティ上の理由からprotocolハンドラの検出が
 * 制限されているため、checkZoteroConnector()を使用することを推奨
 */
export const isZoteroConnectorInstalled = async (): Promise<boolean> => {
  // まず標準的な検出方法を試す
  const connectorDetected = await checkZoteroConnector();
  if (connectorDetected) {
    return true;
  }
  
  // 拡張機能がブラウザに存在するかをチェック (Chrome/Firefox固有のAPIの場合)
  // GoogleのNative Messaging APIを試行
  if (typeof window !== 'undefined' && 'chrome' in window && 
      // @ts-ignore - chromiumベースのブラウザでのみ存在する型
      window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
    try {
      // Zotero Connector拡張機能IDの最初の部分
      // chromeでは 'ekhagklcjbdpajgpjgmbionohlpdbjgc'
      return new Promise(resolve => {
        try {
          // @ts-ignore - chromiumベースのブラウザAPI
          window.chrome.runtime.sendMessage('ekhagklcjbdpajgpjgmbionohlpdbjgc', {action: 'ping'}, (response: any) => {
            // @ts-ignore - chromiumベースのブラウザAPI
            if (window.chrome.runtime.lastError) {
              // エラーがあっても表示しない（エラーは通常の拡張が見つからない状態）
              resolve(false);
            } else {
              resolve(true);
            }
          });
          
          // タイムアウト処理
          setTimeout(() => resolve(false), 300);
        } catch (e) {
          resolve(false);
        }
      });
    } catch (e) {
      console.log('Chrome extension detection error:', e);
    }
  }
  
  // 従来のプロトコルハンドラ検出は最新ブラウザではほぼ動作しないため、
  // 代わりに直接接続チェックを再試行
  return await checkZoteroConnector();
};

/**
 * Zotero Connectorをインストールするためのリンクを取得する
 * @returns Zotero Connectorのダウンロードリンク
 */
export const getZoteroConnectorDownloadLink = (): string => {
  // ブラウザを検出
  const isChrome = navigator.userAgent.indexOf('Chrome') > -1;
  const isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
  const isEdge = navigator.userAgent.indexOf('Edg') > -1;
  const isSafari = navigator.userAgent.indexOf('Safari') > -1 && !isChrome && !isEdge;
  
  // ブラウザに応じたダウンロードリンクを返す
  if (isFirefox) {
    return 'https://www.zotero.org/download/connector/firefox';
  } else if (isChrome || isEdge) {
    return 'https://chrome.google.com/webstore/detail/zotero-connector/ekhagklcjbdpajgpjgmbionohlpdbjgc';
  } else if (isSafari) {
    return 'https://www.zotero.org/download/connector/safari';
  } else {
    // デフォルトはZoteroのダウンロードページ
    return 'https://www.zotero.org/download/connector';
  }
};

/**
 * DOIが有効かどうかをチェックする
 * @param doi DOI文字列
 * @returns 有効な場合はtrue
 */
export const isValidDOI = (doi: string): boolean => {
  // DOIの基本的な形式チェック (10.xxxx/yyyy形式)
  const doiRegex = /^10\.\d{4,}\/[-._;()/:a-zA-Z0-9]+$/;
  return doiRegex.test(doi);
};