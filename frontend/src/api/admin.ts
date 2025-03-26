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
