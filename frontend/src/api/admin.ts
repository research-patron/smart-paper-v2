// ~/Desktop/smart-paper-v2/frontend/src/api/admin.ts
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  getDoc,
  doc,
  collectionGroup
} from 'firebase/firestore';
import { db } from './firebase';
import { Paper, getCurrentUserToken } from './papers';

// Cloud Functions APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://us-central1-smart-paper-v2.cloudfunctions.net';

// 管理者が全ての論文を取得
export const getAdminPapers = async (): Promise<Paper[]> => {
  try {
    // 認証トークンを取得（管理者権限が必要）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }

    // トークンの有効性を確認してから、コレクショングループクエリを実行
    await new Promise(resolve => setTimeout(resolve, 500)); // トークンが設定されるのを待つ
    
    // コレクショングループクエリで論文の一覧を取得
    const paperQuery = query(
      collectionGroup(db, 'papers'),
      orderBy('uploaded_at', 'desc')
    );
    
    const snapshot = await getDocs(paperQuery);
    
    // 結果を変換
    const papers: Paper[] = [];
    snapshot.forEach(doc => {
      const paper = {
        id: doc.id,
        ...doc.data()
      } as Paper;
      papers.push(paper);
    });
    
    return papers;
  } catch (error) {
    console.error('Failed to get admin papers:', error);
    throw error;
  }
};

// 問題報告された論文を取得
export const getReportedPapers = async (): Promise<Paper[]> => {
  try {
    // 認証トークンを取得（管理者権限が必要）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }

    // トークンの有効性を確認してから、コレクショングループクエリを実行
    await new Promise(resolve => setTimeout(resolve, 500)); // トークンが設定されるのを待つ
    
    // コレクショングループクエリで問題のある論文の一覧を取得
    const paperQuery = query(
      collectionGroup(db, 'papers'),
      where('status', 'in', ['reported', 'problem']),
      orderBy('reported_at', 'desc')
    );
    
    const snapshot = await getDocs(paperQuery);
    
    // 結果を変換
    const papers: Paper[] = [];
    snapshot.forEach(doc => {
      const paper = {
        id: doc.id,
        ...doc.data()
      } as Paper;
      papers.push(paper);
    });
    
    return papers;
  } catch (error) {
    console.error('Failed to get reported papers:', error);
    throw error;
  }
};

// 問題報告の詳細を取得
export const getReportDetail = async (reportId: string): Promise<any> => {
  try {
    // 認証トークンを取得（管理者権限が必要）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    // 問題報告コレクションから取得を試みる - 修正したパス
    const pdfItemsCollection = collection(db, 'inquiries', 'pdf', 'items');
    const reportQuery = query(pdfItemsCollection, where('__name__', '==', reportId));
    
    const reportSnap = await getDocs(reportQuery);
    
    if (!reportSnap.empty) {
      const doc = reportSnap.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    
    // 見つからない場合はエラー
    throw new Error('問題報告が見つかりません');
  } catch (error) {
    console.error('Failed to get report detail:', error);
    throw error;
  }
};

// 全ての問題報告を取得
export const getAllReports = async (): Promise<any[]> => {
  try {
    // 認証トークンを取得（管理者権限が必要）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    // PDF問題報告の取得 - 修正したパス
    const pdfItemsCollection = collection(db, 'inquiries', 'pdf', 'items');
    const pdfReportsQuery = query(
      pdfItemsCollection,
      orderBy('created_at', 'desc')
    );
    
    const pdfSnapshot = await getDocs(pdfReportsQuery);
    
    // 結果を変換
    const reports: any[] = [];
    pdfSnapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data(),
        type: 'pdf'
      });
    });
    
    return reports;
  } catch (error) {
    console.error('Failed to get all reports:', error);
    throw error;
  }
};

// 全てのサービス問い合わせを取得
export const getAllInquiries = async (): Promise<any[]> => {
  try {
    // 認証トークンを取得（管理者権限が必要）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    // サービス問い合わせの取得 - 修正したパス
    const serviceItemsCollection = collection(db, 'inquiries', 'service', 'items');
    const serviceInquiriesQuery = query(
      serviceItemsCollection,
      orderBy('created_at', 'desc')
    );
    
    const serviceSnapshot = await getDocs(serviceInquiriesQuery);
    
    // 結果を変換
    const inquiries: any[] = [];
    serviceSnapshot.forEach(doc => {
      inquiries.push({
        id: doc.id,
        ...doc.data(),
        type: 'service'
      });
    });
    
    return inquiries;
  } catch (error) {
    console.error('Failed to get all inquiries:', error);
    throw error;
  }
};

// Geminiログの詳細を取得する関数を追加
export const getGeminiLogs = async (paperId: string): Promise<any[]> => {
  try {
    // 認証トークンを取得（管理者権限が必要）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    // Geminiログのサブコレクションを取得
    const logsCollection = collection(db, `papers/${paperId}/gemini_logs`);
    const logsQuery = query(
      logsCollection,
      orderBy('timestamp', 'desc')
    );
    
    const logsSnapshot = await getDocs(logsQuery);
    
    // 結果を変換
    const logs: any[] = [];
    logsSnapshot.forEach(doc => {
      logs.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return logs;
  } catch (error) {
    console.error('Failed to get Gemini logs:', error);
    throw error;
  }
};

// 処理時間データを取得
export const getProcessingTime = async (paperId: string): Promise<any> => {
  try {
    // 認証トークンを取得（管理者権限が必要）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('認証が必要です');
    }
    
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    // Cloud Functions APIを呼び出す
    const response = await fetch(`${API_BASE_URL}/get_processing_time`, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify({ paper_id: paperId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '処理時間データの取得に失敗しました');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get processing time data:', error);
    throw error;
  }
};

// 処理時間データをCSVとしてフォーマット - 修正版
export const exportProcessingTimeCSV = (data: any): string => {
  if (!data) return '';
  
  const rows: string[] = [];
  
  // ヘッダー行
  rows.push('Operation,Step,Timestamp,Duration (sec),Details');
  
  // 各操作タイプのデータを追加
  const operations = [
    {key: 'translation', name: 'Translation'},
    {key: 'summary', name: 'Summary'},
    {key: 'metadata', name: 'Metadata Extraction'}
  ];
  
  operations.forEach(op => {
    const opData = data[op.key];
    if (!opData || !opData.steps) return;
    
    opData.steps.forEach((step: any) => {
      // タイムスタンプの適切な変換
      let timestamp = 'N/A';
      if (step.timestamp) {
        // Firestoreのタイムスタンプオブジェクトの場合
        if (step.timestamp.seconds) {
          timestamp = new Date(step.timestamp.seconds * 1000).toISOString();
        } 
        // 既にISOString形式の場合
        else if (typeof step.timestamp === 'string') {
          timestamp = step.timestamp;
        }
      }
      
      // 処理時間の適切な処理（秒単位で統一）
      let duration = '';
      if (step.processing_time_sec !== undefined && step.processing_time_sec !== null) {
        // 数値を秒単位で正確に表示
        duration = step.processing_time_sec.toFixed(3);
      }
      
      // 詳細情報をJSON文字列に変換（カンマを含むのでダブルクォートでエスケープ）
      let details = '';
      if (step.details) {
        try {
          // オブジェクトを文字列化し、ダブルクォートをエスケープ
          details = `"${JSON.stringify(step.details).replace(/"/g, '""')}"`;
        } catch (e) {
          details = `"Error parsing details"`;
        }
      }
      
      rows.push(`${op.name},${step.step_name},${timestamp},${duration},${details}`);
    });
  });
  
  // 章ごとのデータを追加（翻訳処理の内訳として）
  if (data.chapters && data.chapters.length > 0) {
    data.chapters.forEach((chapter: any) => {
      if (!chapter) return;
      
      // 章番号とタイトル
      const chapterNum = chapter.chapter_number || 'unknown';
      const chapterTitle = chapter.title || '';
      
      // タイムスタンプの処理
      let timestamp = 'N/A';
      if (chapter.timestamp) {
        if (chapter.timestamp.seconds) {
          timestamp = new Date(chapter.timestamp.seconds * 1000).toISOString();
        } else if (typeof chapter.timestamp === 'string') {
          timestamp = chapter.timestamp;
        }
      }
      
      // 処理時間の処理（秒単位に統一）
      let duration = '';
      if (chapter.processing_time_sec !== undefined && chapter.processing_time_sec !== null) {
        duration = chapter.processing_time_sec.toFixed(3);
      }
      
      // 章の詳細情報（開始・終了ページを含む）
      const startPage = chapter.start_page !== undefined ? chapter.start_page : 'N/A';
      const endPage = chapter.end_page !== undefined ? chapter.end_page : 'N/A';
      const details = `"Chapter ${chapterNum}: ${chapterTitle} (Pages ${startPage}-${endPage})"`;
      
      rows.push(`Chapter Translation,chapter_${chapterNum},${timestamp},${duration},${details}`);
    });
  }
  
  return rows.join('\n');
};