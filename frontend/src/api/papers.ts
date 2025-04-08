// ~/Desktop/smart-paper-v2/frontend/src/api/papers.ts
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  onSnapshot
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { getIdToken } from 'firebase/auth';
import { db, storage, auth } from './firebase';

// 論文のメタデータ型定義
export interface Author {
  name: string;
  affiliation?: string;
}

export interface Chapter {
  chapter_number: number;
  title: string;
  start_page: number;
  end_page: number;
}

export interface PaperMetadata {
  title: string;
  authors: Author[];
  year: number;
  journal: string;
  doi: string;
  keywords: string[];
  abstract: string;
}

export interface RelatedPaper {
  title: string;
  doi: string;
  year?: number;
  authors?: string[];
  citation_count?: number;
  relatedness_score?: number;
}

// Obsidian連携状態の型定義
export interface ObsidianState {
  exported: boolean;
  export_path?: string;
  exported_at?: Timestamp;
  error?: string;
  updated_at?: Timestamp;
}

export interface Paper {
  id: string;
  user_id: string;
  file_path: string;
  status: 'pending' | 'metadata_extracted' | 'processing' | 'completed' | 'error' | 'reported' | 'problem';
  uploaded_at: Timestamp;
  completed_at: Timestamp | null;
  metadata: PaperMetadata | null;
  chapters: Chapter[] | null;
  summary: string | null;
  required_knowledge?: string | null;
  translated_text: string | null;
  translated_text_path: string | null;
  related_papers?: RelatedPaper[] | null; // Made optional
  error_message?: string;
  progress?: number; 
  obsidian?: ObsidianState;
  reported_at?: Timestamp; // 問題報告された日時
  report_id?: string;      // 問題報告のドキュメントID
}

// Cloud Functionsへのリクエスト型
export interface TranslationRequest {
  paper_id: string;
  chapter_info?: {
    chapter_number: number;
    title: string;
    start_page: number;
    end_page: number;
  };
  metadata?: {
    chapters: Chapter[];
  };
}

export interface TranslatedChapter {
  id: string;
  chapter_number: number;
  title: string;
  original_text: string;
  translated_text: string;
  start_page: number;
  end_page: number;
}

// Cloud Functions APIのベースURL
// 本番環境では環境変数から取得するなど、適切に設定する
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://us-central1-smart-paper-v2.cloudfunctions.net';

// 現在の認証ユーザーからIDトークンを取得
export const getCurrentUserToken = async (): Promise<string | null> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }
    
    const token = await getIdToken(currentUser, true);
    return token;
  } catch (error) {
    return null;
  }
};

// 日付フォーマット関数
export const formatDate = (timestamp: any): string => {
  if (!timestamp) return '不明';
  
  try {
    // Firestoreのタイムスタンプからのミリ秒値
    let date: Date;
    
    if (timestamp.toDate) {
      // Firestore Timestamp
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      // seconds, nanoseconds形式
      date = new Date(timestamp.seconds * 1000);
    } else {
      // 通常のDateオブジェクトまたはミリ秒
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '日付エラー';
  }
};

// 翻訳をリクエスト
export const requestTranslation = async (request: TranslationRequest): Promise<void> => {
  try {
    // 認証トークンを取得
    const token = await getCurrentUserToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // トークンがあれば追加
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/translate_paper`, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '翻訳リクエストに失敗しました');
    }
  } catch (error) {
    throw error;
  }
};

// PDFファイルをアップロード
export const uploadPDF = async (file: File, userId: string): Promise<string> => {
  try {
    // 1. PDFファイルのバリデーション
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('PDFファイルのみアップロード可能です');
    }
    
    if (file.size > 20 * 1024 * 1024) {
      throw new Error('ファイルサイズは20MB以下にしてください');
    }
    
    // 追加: 翻訳制限のチェック
    // ユーザーのデータをFirestoreから取得
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('ユーザー情報の取得に失敗しました');
    }
    
    const userData = userDoc.data();
    
    // 翻訳期間のチェック
    const now = new Date();
    let needsNewPeriod = false;
    
    if (!userData.translation_period_start || !userData.translation_period_end) {
      // 翻訳期間が設定されていない場合は新しい期間を設定
      needsNewPeriod = true;
    } else {
      // 翻訳期間が終了しているかチェック
      const periodEnd = userData.translation_period_end.toDate();
      if (now > periodEnd) {
        // 期間が終了している場合は新しい期間を設定
        needsNewPeriod = true;
      }
    }
    
    // 無料会員の場合は翻訳数をチェック
    if (userData.subscription_status === 'free' && !needsNewPeriod) {
      const translationCount = userData.translation_count || 0;
      
      // 月3件の上限に達している場合はエラー
      if (translationCount >= 3) {
        throw new Error('月間翻訳数の上限（3件）に達しました。プレミアムプランにアップグレードすると無制限に翻訳できます。');
      }
    }
    
    // 2. PDFファイルをCloud Functionsにアップロード
    const formData = new FormData();
    formData.append('file', file);
    
    // 認証トークンを取得
    const token = await getCurrentUserToken();
    const headers: HeadersInit = {};
    
    // トークンがあれば追加
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Firebase Cloud Functionsのエンドポイント
    const response = await fetch(`${API_BASE_URL}/process_pdf`, {
      method: 'POST',
      headers,
      body: formData,
      mode: 'cors'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '論文のアップロードに失敗しました');
    }
    
    const data = await response.json();
    
    // 3. バックグラウンド処理を開始
    await startPaperProcessing(data.paper_id);
    
    return data.paper_id;
  } catch (error) {
    console.error('PDF upload error:', error);
    throw error;
  }
};

// バックグラウンド処理を開始
export const startPaperProcessing = async (paperId: string): Promise<void> => {
  try {
    // 認証トークンを取得
    const token = await getCurrentUserToken();
    const headers: HeadersInit = { 
      'Content-Type': 'application/json' 
    };
    
    // トークンがあれば追加
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/process_pdf_background`, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify({ paper_id: paperId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      // エラーをスローせず、処理を続行（Firestoreで状態を監視するため）
    }
  } catch (error) {
    // エラーをスローせず、処理を続行（Firestoreで状態を監視するため）
  }
};

// ユーザーの論文一覧を取得
export const getUserPapers = async (userId: string): Promise<Paper[]> => {
  try {
    // リクエストのデバッグログを追加
    
    const q = query(
      collection(db, 'papers'),
      where('user_id', '==', userId),
      orderBy('uploaded_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const papers: Paper[] = [];
    
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      papers.push({
        id: doc.id,
        user_id: data.user_id,
        file_path: data.file_path,
        status: data.status,
        uploaded_at: data.uploaded_at,
        completed_at: data.completed_at,
        metadata: data.metadata,
        chapters: data.chapters,
        summary: data.summary,
        required_knowledge: data.required_knowledge,
        translated_text: data.translated_text,
        translated_text_path: data.translated_text_path,
        related_papers: data.related_papers,
        progress: data.progress,
        error_message: data.error_message,
        obsidian: data.obsidian, // Obsidian連携状態を追加
        reported_at: data.reported_at, // 問題報告日時
        report_id: data.report_id // 問題報告ID
      });
    });
    
    
    return papers;
  } catch (error) {
    throw error;
  }
};

// 論文の詳細を取得
export const getPaper = async (paperId: string): Promise<Paper> => {
  try {
    const docRef = doc(db, 'papers', paperId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        user_id: data.user_id,
        file_path: data.file_path,
        status: data.status,
        uploaded_at: data.uploaded_at,
        completed_at: data.completed_at,
        metadata: data.metadata,
        chapters: data.chapters,
        summary: data.summary,
        required_knowledge: data.required_knowledge,
        translated_text: data.translated_text,
        translated_text_path: data.translated_text_path,
        related_papers: data.related_papers,
        progress: data.progress,
        error_message: data.error_message,
        obsidian: data.obsidian, // Obsidian連携状態を追加
        reported_at: data.reported_at, // 問題報告日時
        report_id: data.report_id // 問題報告ID
      };
    } else {
      throw new Error('論文が見つかりません');
    }
  } catch (error) {
    throw error;
  }
};

// 論文の翻訳テキストを取得 (StorageからURLを取得する場合)
export const getPaperTranslatedText = async (paper: Paper): Promise<string> => {
  try {
    // すでにFirestoreに翻訳テキストが保存されている場合はそれを返す
    if (paper.translated_text) {
      return paper.translated_text;
    }

    // StorageにURLがある場合は取得
    if (paper.translated_text_path) {
      // 認証トークンを取得
      const token = await getCurrentUserToken();
      const headers: HeadersInit = { 
        'Content-Type': 'application/json' 
      };
      
      // トークンがあれば追加
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // 署名付きURLを取得するCloud Function APIを呼び出す
      const response = await fetch(`${API_BASE_URL}/get_signed_url`, {
        method: 'POST',
        headers,
        mode: 'cors',
        body: JSON.stringify({ filePath: paper.translated_text_path }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '翻訳テキストの取得に失敗しました');
      }

      const data = await response.json();
      const signedUrl = data.url;

      // 署名付きURLからテキストを取得
      const textResponse = await fetch(signedUrl);
      if (!textResponse.ok) {
        throw new Error('翻訳テキストの取得に失敗しました');
      }

      return await textResponse.text();
    }

    throw new Error('翻訳テキストがありません');
  } catch (error) {
    throw error;
  }
};

// 論文のPDF URLを取得
export const getPaperPdfUrl = async (paper: Paper): Promise<string> => {
  try {
    if (!paper.file_path) {
      throw new Error('PDFファイルのパスがありません');
    }

    // 認証トークンを取得
    const token = await getCurrentUserToken();
    const headers: HeadersInit = { 
      'Content-Type': 'application/json' 
    };
    
    // トークンがあれば追加
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 署名付きURLを取得するCloud Function APIを呼び出す
    const response = await fetch(`${API_BASE_URL}/get_signed_url`, {
      method: 'POST',
      headers,
      mode: 'cors', 
      body: JSON.stringify({ filePath: paper.file_path }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'PDFファイルの取得に失敗しました');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    throw error;
  }
};

// 論文の翻訳された章を取得
export const getTranslatedChapters = async (paperId: string): Promise<TranslatedChapter[]> => {
  try {
    const q = query(
      collection(db, `papers/${paperId}/translated_chapters`),
      orderBy('chapter_number', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const chapters: TranslatedChapter[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      chapters.push({
        id: doc.id,
        chapter_number: data.chapter_number,
        title: data.title,
        original_text: data.original_text || '',
        translated_text: data.translated_text,
        start_page: data.start_page,
        end_page: data.end_page
      });
    });
    
    return chapters;
  } catch (error) {
    throw error;
  }
};

// 論文の進捗状況をリアルタイムで監視
export const watchPaperStatus = (
  paperId: string,
  callback: (paper: Paper) => void
): (() => void) => {
  const unsubscribe = onSnapshot(doc(db, 'papers', paperId), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      callback({
        id: doc.id,
        user_id: data.user_id,
        file_path: data.file_path,
        status: data.status,
        uploaded_at: data.uploaded_at,
        completed_at: data.completed_at,
        metadata: data.metadata,
        chapters: data.chapters,
        summary: data.summary,
        required_knowledge: data.required_knowledge, // 必要な知識フィールドを追加
        translated_text: data.translated_text,
        translated_text_path: data.translated_text_path,
        related_papers: data.related_papers,
        progress: data.progress, // 進捗フィールドを追加
        error_message: data.error_message, // エラーメッセージも追加
        obsidian: data.obsidian, // Obsidian連携状態を追加
        reported_at: data.reported_at, // 問題報告日時
        report_id: data.report_id // 問題報告ID
      });
    }
  }, (error) => {
  });
  
  return unsubscribe;
};

// 論文のObsidian連携状態を更新
export const updatePaperObsidianState = async (paperId: string, obsidianState: Partial<ObsidianState>): Promise<void> => {
  try {
    const paperRef = doc(db, 'papers', paperId);
    
    await updateDoc(paperRef, {
      obsidian: {
        ...obsidianState,
        updated_at: Timestamp.now()
      }
    });
  } catch (error) {
    throw error;
  }
};

// 論文を削除（サブスクリプションによる制限内の場合のみ）
export const deletePaper = async (paperId: string): Promise<void> => {
  try {
    // 1. 論文のドキュメントを取得
    const paperRef = doc(db, 'papers', paperId);
    const paperSnap = await getDoc(paperRef);
    
    if (!paperSnap.exists()) {
      throw new Error('論文が見つかりません');
    }
    
    const paperData = paperSnap.data();
    
    // 2. Storage上のファイルを削除
    if (paperData.file_path) {
      // ファイルパスからバケット名とオブジェクト名を抽出
      const filePathMatch = paperData.file_path.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (filePathMatch) {
        const bucketName = filePathMatch[1];
        const objectName = filePathMatch[2];
        const fileRef = ref(storage, objectName);
        await deleteObject(fileRef);
      }
    }
    
    if (paperData.translated_text_path) {
      // 翻訳テキストファイルのパスからバケット名とオブジェクト名を抽出
      const textPathMatch = paperData.translated_text_path.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (textPathMatch) {
        const bucketName = textPathMatch[1];
        const objectName = textPathMatch[2];
        const translatedTextRef = ref(storage, objectName);
        await deleteObject(translatedTextRef);
      }
    }
    
    // 3. translated_chaptersサブコレクションを削除
    const chaptersSnapshot = await getDocs(collection(db, `papers/${paperId}/translated_chapters`));
    const deleteChapterPromises = chaptersSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deleteChapterPromises);
    
    // 4. 論文ドキュメントを削除
    await deleteDoc(paperRef);
  } catch (error) {
    throw error;
  }
};