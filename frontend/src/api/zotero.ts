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
    console.log('Checking for Zotero Connector availability...');
    
    // Zotero Connector拡張機能が利用できるかどうかをチェック
    // まず標準的なZotero Object APIをチェック
    if (typeof window !== 'undefined' && 'Zotero' in window) {
      console.log('Zotero Connector detected via window.Zotero');
      return true;
    }

    // 拡張機能がインストールされているかをチェックする追加手段
    if (typeof document !== 'undefined') {
      const zoteroIconElement = document.querySelector('[data-zotero-extension]');
      if (zoteroIconElement) {
        console.log('Zotero Connector detected via DOM element');
        return true;
      }
    }

    // Chrome/Firefox Content Scriptを経由したZotero Connectorをチェック
    const pingPromise = new Promise<boolean>((resolve) => {
      // カスタムイベントを作成してZotero Connectorをチェック
      const event = new CustomEvent('zotero-connector-ping');
      
      // レスポンスをリッスン (タイムアウト付き - 延長して信頼性向上)
      const timeout = setTimeout(() => {
        document.removeEventListener('zotero-connector-response', listener);
        console.log('Zotero Connector event detection timed out');
        resolve(false);
      }, 1000); // 500msから1000msに延長
      
      const listener = (e: Event) => {
        clearTimeout(timeout);
        document.removeEventListener('zotero-connector-response', listener);
        console.log('Zotero Connector detected via event response');
        resolve(true);
      };
      
      document.addEventListener('zotero-connector-response', listener);
      document.dispatchEvent(event);
    });

    // WebSocket経由でZotero Standalone (Connector)をチェック
    const socketPromise = new Promise<boolean>((resolve) => {
      try {
        const socket = new WebSocket(`ws://127.0.0.1:23119/connector/`);
        
        socket.onopen = () => {
          socket.close();
          console.log('Zotero Connector detected via WebSocket');
          resolve(true);
        };
        
        socket.onerror = () => {
          console.log('Zotero Connector WebSocket detection failed');
          resolve(false);
        };
      } catch (error) {
        console.log('Zotero Connector WebSocket detection exception:', error);
        resolve(false);
      }
    });

    // HTTP経由でのダイレクトチェック
    const httpPromise = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => {
        console.log('Zotero Connector detected via HTTP ping');
        resolve(true);
      };
      img.onerror = () => {
        console.log('Zotero Connector HTTP ping detection failed');
        resolve(false);
      };
      // キャッシュ回避のためタイムスタンプパラメータを追加
      img.src = `${ZOTERO_CONNECTOR_URL}/connector/ping?t=${new Date().getTime()}`;
    });

    // Chrome拡張機能の直接検出を試みる (最も信頼性が高い方法の一つ)
    const chromeExtensionPromise = new Promise<boolean>((resolve) => {
      // 型安全にChrome APIを検出
      const windowAny = window as any;
      if (typeof window !== 'undefined' && 'chrome' in window && 
          windowAny.chrome && windowAny.chrome.runtime && windowAny.chrome.runtime.sendMessage) {
        try {
          let hasResponded = false;
          // タイムアウト処理 - 延長して信頼性向上
          const timeout = setTimeout(() => {
            if (!hasResponded) {
              console.log('Chrome extension detection timed out');
              resolve(false);
            }
          }, 1000);
          
          // Chromiumベースのブラウザでのみ存在する型なので型アサーションを使用
          const chrome = (window as any).chrome;
          chrome.runtime.sendMessage('ekhagklcjbdpajgpjgmbionohlpdbjgc', {action: 'ping'}, (response: any) => {
            hasResponded = true;
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              console.log('Chrome extension detection failed with error:', chrome.runtime.lastError);
              resolve(false);
            } else {
              console.log('Chrome extension detected successfully with response:', response);
              resolve(true);
            }
          });
        } catch (e) {
          console.error('Exception during Chrome extension detection:', e);
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });

    // 検出方法の優先順位を変更: Chrome拡張機能 > HTTP > WebSocket > Content Script
    return await Promise.race([chromeExtensionPromise, httpPromise, socketPromise, pingPromise]);
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
  try {
    // 改善された検出方法を使用
    const connectorDetected = await checkZoteroConnector();
    return connectorDetected;
  } catch (error) {
    console.error('Error checking Zotero Connector installation:', error);
    return false;
  }
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
 * Zoteroアプリケーションが起動しているかどうかを確認する
 * @returns Zoteroアプリケーションが起動している可能性が高い場合はtrue
 */
export const isZoteroRunning = async (): Promise<boolean> => {
  try {
    // Zoteroアプリケーションが起動しているかどうかを確認するために
    // WebSocketを使用して接続を試みる
    const socket = new WebSocket(`ws://127.0.0.1:23119/connector/`);
    
    return new Promise<boolean>((resolve) => {
      socket.onopen = () => {
        socket.close();
        resolve(true);
      };
      
      socket.onerror = () => {
        resolve(false);
      };
      
      // タイムアウト処理
      setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) {
          socket.close();
        }
        resolve(false);
      }, 1000);
    });
  } catch (error) {
    console.error('Error checking if Zotero is running:', error);
    return false;
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
