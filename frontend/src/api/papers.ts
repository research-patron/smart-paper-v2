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
  import { db, storage } from './firebase';
  
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
  }
  
  export interface Paper {
    id: string;
    user_id: string;
    file_path: string;
    cache_id: string | null;
    status: 'pending' | 'metadata_extracted' | 'processing' | 'completed' | 'error';
    uploaded_at: Timestamp;
    completed_at: Timestamp | null;
    metadata: PaperMetadata | null;
    chapters: Chapter[] | null;
    summary: string | null;
    translated_text: string | null;
    translated_text_path: string | null;
    related_papers: RelatedPaper[] | null;
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
      
      // 2. PDFファイルをCloud Functionsにアップロード
      const formData = new FormData();
      formData.append('file', file);
      
      // Firebase Cloud Functionsのエンドポイント
      const response = await fetch('https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/process_pdf', {
        method: 'POST',
        body: formData,
        // 認証情報を含めるため
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '論文のアップロードに失敗しました');
      }
      
      const data = await response.json();
      return data.paper_id;
    } catch (error) {
      console.error('PDF upload error:', error);
      throw error;
    }
  };
  
  // ユーザーの論文一覧を取得
  export const getUserPapers = async (userId: string): Promise<Paper[]> => {
    try {
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
          cache_id: data.cache_id,
          status: data.status,
          uploaded_at: data.uploaded_at,
          completed_at: data.completed_at,
          metadata: data.metadata,
          chapters: data.chapters,
          summary: data.summary,
          translated_text: data.translated_text,
          translated_text_path: data.translated_text_path,
          related_papers: data.related_papers
        });
      });
      
      return papers;
    } catch (error) {
      console.error('Get user papers error:', error);
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
          cache_id: data.cache_id,
          status: data.status,
          uploaded_at: data.uploaded_at,
          completed_at: data.completed_at,
          metadata: data.metadata,
          chapters: data.chapters,
          summary: data.summary,
          translated_text: data.translated_text,
          translated_text_path: data.translated_text_path,
          related_papers: data.related_papers
        };
      } else {
        throw new Error('論文が見つかりません');
      }
    } catch (error) {
      console.error('Get paper error:', error);
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
          original_text: data.original_text,
          translated_text: data.translated_text,
          start_page: data.start_page,
          end_page: data.end_page
        });
      });
      
      return chapters;
    } catch (error) {
      console.error('Get translated chapters error:', error);
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
          cache_id: data.cache_id,
          status: data.status,
          uploaded_at: data.uploaded_at,
          completed_at: data.completed_at,
          metadata: data.metadata,
          chapters: data.chapters,
          summary: data.summary,
          translated_text: data.translated_text,
          translated_text_path: data.translated_text_path,
          related_papers: data.related_papers
        });
      }
    });
    
    return unsubscribe;
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
        const fileRef = ref(storage, paperData.file_path.replace('gs://', ''));
        await deleteObject(fileRef);
      }
      
      if (paperData.translated_text_path) {
        const translatedTextRef = ref(storage, paperData.translated_text_path.replace('gs://', ''));
        await deleteObject(translatedTextRef);
      }
      
      // 3. translated_chaptersサブコレクションを削除
      const chaptersSnapshot = await getDocs(collection(db, `papers/${paperId}/translated_chapters`));
      const deleteChapterPromises = chaptersSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteChapterPromises);
      
      // 4. 論文ドキュメントを削除
      await deleteDoc(paperRef);
    } catch (error) {
      console.error('Delete paper error:', error);
      throw error;
    }
  };