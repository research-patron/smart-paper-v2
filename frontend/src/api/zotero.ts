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
    
    // iframe内で開いてZotero Connectorを起動するか、新しいタブで開く
    window.location.href = url;
    
    return true;
  } catch (error) {
    console.error('Failed to add to Zotero:', error);
    return false;
  }
};

/**
 * Zotero Connectorが利用可能かどうかを確認する
 * @returns Zotero Connectorが利用可能な場合はtrue
 */
export const checkZoteroConnector = async (): Promise<boolean> => {
  try {
    // Zotero Connector APIのpingエンドポイントにリクエストを送信
    const response = await fetch(`${ZOTERO_CONNECTOR_URL}/connector/ping`, {
      method: 'GET',
      mode: 'no-cors' // CORSエラーを回避するためにno-corsモードを使用
    });
    
    // no-corsモードではレスポンスの内容を読み取れないため、
    // エラーが発生しなければZotero Connectorが利用可能と判断する
    return true;
  } catch (error) {
    console.error('Zotero Connector not available:', error);
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
 */
export const isZoteroConnectorInstalled = (): Promise<boolean> => {
  return new Promise(resolve => {
    // iframeを使用してzotero://プロトコルを検出する試み
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // タイムアウト設定
    const timeout = setTimeout(() => {
      document.body.removeChild(iframe);
      resolve(false);
    }, 1000);
    
    // エラーハンドラを設定
    iframe.onerror = () => {
      clearTimeout(timeout);
      document.body.removeChild(iframe);
      resolve(true); // エラーが発生した場合はProtocolハンドラが存在する可能性がある
    };
    
    // ロードハンドラを設定
    iframe.onload = () => {
      clearTimeout(timeout);
      document.body.removeChild(iframe);
      resolve(false); // 正常にロードされた場合はProtocolハンドラが存在しない
    };
    
    // Zoteroプロトコルを使用してテスト
    iframe.src = 'zotero://';
  });
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