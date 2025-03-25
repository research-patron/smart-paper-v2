// ~/Desktop/smart-paper-v2/frontend/src/api/contact.ts
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { getCurrentUserToken } from './papers';

// 問い合わせのインターフェース
export interface Inquiry {
  user_id: string | null;
  category: string;
  subject: string;
  message: string;
  email: string;
}

// 問題報告のインターフェース
export interface ProblemReport {
  user_id: string | null;
  category: string;
  paper_id?: string;
  description: string;
  steps_to_reproduce?: string;
  share_with_admin: boolean;
}

// Cloud Functions APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://us-central1-smart-paper-v2.cloudfunctions.net';

// お問い合わせを送信
export const submitInquiry = async (inquiry: Inquiry): Promise<void> => {
  try {
    // ユーザーIDを設定（認証されている場合）
    const currentUser = auth.currentUser;
    const userId = currentUser ? currentUser.uid : null;
    
    // Firestoreに保存
    await addDoc(collection(db, 'inquiries'), {
      ...inquiry,
      user_id: userId,  // 認証されていなくてもnullとして保存
      type: 'inquiry',
      status: 'new',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    
    // デバッグ
    console.log('Inquiry submitted successfully');
  } catch (error) {
    console.error('Failed to submit inquiry:', error);
    throw error;
  }
};

// 問題報告を送信
export const submitProblemReport = async (report: ProblemReport): Promise<void> => {
  try {
    // ユーザーIDを設定（認証されている場合）
    const currentUser = auth.currentUser;
    const userId = currentUser ? currentUser.uid : null;
    
    // 基本情報
    const reportData = {
      ...report,
      user_id: userId,  // 認証されていなくてもnullとして保存
      type: 'problem_report',
      status: 'new',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      paper_shared: false  // 初期値はfalse
    };
    
    // Firestoreに保存
    const reportRef = await addDoc(collection(db, 'inquiries'), reportData);
    
    console.log('Problem report submitted with ID:', reportRef.id);
    
    // 論文共有の処理（share_with_adminがtrueかつpaper_idがある場合）
    if (report.share_with_admin && report.paper_id && userId) {
      try {
        // 論文ドキュメントを更新して管理者と共有
        await sharePaperWithAdmin(report.paper_id, reportRef.id);
        console.log('Paper shared with admin successfully');
      } catch (shareError) {
        console.error('Failed to share paper with admin, but problem report was submitted:', shareError);
        // 問題報告は送信されたのでエラーとはしない
      }
    }
  } catch (error) {
    console.error('Failed to submit problem report:', error);
    throw error;
  }
};

// 論文を管理者と共有
export const sharePaperWithAdmin = async (paperId: string, reportId: string): Promise<void> => {
  try {
    // 管理者のメールアドレス
    const adminEmail = 's.kosei0626@gmail.com';
    
    // 認証トークンを取得（通常は認証済みと想定）
    const token = await getCurrentUserToken();
    if (!token) {
      throw new Error('論文を共有するには認証が必要です');
    }
    
    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    // Cloud Functions APIを呼び出す
    const response = await fetch(`${API_BASE_URL}/share_paper_with_admin`, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify({ 
        paper_id: paperId,
        admin_email: adminEmail,
        report_id: reportId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '論文の共有に失敗しました');
    }
    
    console.log(`Paper ${paperId} shared with admin ${adminEmail}`);
    
  } catch (error) {
    console.error('Failed to share paper with admin:', error);
    throw error;
  }
};