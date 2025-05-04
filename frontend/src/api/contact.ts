// frontend/src/api/contact.ts
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
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
    
    // ドキュメントID生成（user-id_date形式）
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const docId = `${userId || 'anonymous'}_${date}`;
    
    // 問い合わせIDを生成（user-id_date形式）
    const inquiryId = `${userId || 'anonymous'}_${date}`;
    
    // inquiries/service/items/{inquiryId}へのリファレンス
    const inquiryRef = doc(db, 'inquiries', 'service', 'items', inquiryId);
    
    // サービス問い合わせを追加
    await setDoc(inquiryRef, {
      ...inquiry,
      user_id: userId,  // 認証されていなくてもnullとして保存
      type: 'inquiry',
      status: 'new',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    
    // メール通知のドキュメントを作成
    await addDoc(collection(db, 'mail'), {
      to: 'smart-paper-v2@student-subscription.com',
      message: {
        subject: `【Smart Paper v2】問い合わせ: ${inquiry.subject}`,
        html: `
          <h2>Smart Paper v2へのお問い合わせ</h2>
          <p><strong>カテゴリ:</strong> ${inquiry.category}</p>
          <p><strong>件名:</strong> ${inquiry.subject}</p>
          <p><strong>メッセージ:</strong></p>
          <p>${inquiry.message.replace(/\n/g, '<br>')}</p>
          <p><strong>ユーザーメールアドレス:</strong> ${inquiry.email}</p>
          <p><strong>ユーザーID:</strong> ${userId || 'anonymous'}</p>
        `
      },
      replyTo: inquiry.email  // 返信先を設定
    });
    
    // デバッグ
    console.log('Inquiry submitted successfully to inquiries/service/items collection and email notification created');
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
    
    // ドキュメントID生成（user-id_date形式）
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const docId = `${userId || 'anonymous'}_${date}`;
    
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
    
    // 問題報告IDを生成（user-id_date形式）
    const reportId = `${userId || 'anonymous'}_${date}`;
    
    // inquiries/pdf/items/{reportId}へのリファレンス
    const reportRef = doc(db, 'inquiries', 'pdf', 'items', reportId);
    
    // 問題報告を追加
    await setDoc(reportRef, reportData);
    
    // メール通知のドキュメントを作成
    await addDoc(collection(db, 'mail'), {
      to: 'smart-paper-v2@student-subscription.com',
      message: {
        subject: `【Smart Paper】問題報告: ${report.paper_id ? `論文ID: ${report.paper_id}` : 'その他の問題'}`,
        html: `
          <h2>Smart Paperへの問題報告</h2>
          <p><strong>カテゴリ:</strong> ${report.category}</p>
          <p><strong>説明:</strong></p>
          <p>${report.description.replace(/\n/g, '<br>')}</p>
          ${report.steps_to_reproduce ? `<p><strong>再現手順:</strong></p><p>${report.steps_to_reproduce.replace(/\n/g, '<br>')}</p>` : ''}
          ${report.paper_id ? `<p><strong>論文ID:</strong> ${report.paper_id}</p>` : ''}
          <p><strong>管理者との共有:</strong> ${report.share_with_admin ? '許可' : '許可なし'}</p>
          <p><strong>ユーザーID:</strong> ${userId || 'anonymous'}</p>
          <p><em>このメールはFirebase Extensionsによって自動送信されています。</em></p>
        `
      }
    });
    
    console.log('Problem report submitted with ID:', reportId);
    
    // 論文共有の処理（share_with_adminがtrueかつpaper_idがある場合）
    if (report.share_with_admin && report.paper_id && userId) {
      try {
        // 論文ドキュメントを更新して管理者と共有
        await sharePaperWithAdmin(report.paper_id, reportId);
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
    // 管理者のメールアドレス (自動転送設定済み)
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