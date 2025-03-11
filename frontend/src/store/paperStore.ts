// ~/Desktop/smart-paper-v2/frontend/src/store/paperStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  Paper, 
  TranslatedChapter, 
  getUserPapers, 
  getPaper, 
  getTranslatedChapters,
  watchPaperStatus,
  deletePaper,
  startPaperProcessing
} from '../api/papers';

interface PaperState {
  // ユーザーの論文一覧
  papers: Paper[];
  loading: boolean;
  error: string | null;
  
  // 現在選択されている論文
  currentPaper: Paper | null;
  currentPaperChapters: TranslatedChapter[];
  currentPaperLoading: boolean;
  currentPaperError: string | null;
  
  // 翻訳・要約がまだ完了していない論文の監視状態
  watchingPapers: Set<string>;
  unwatchCallbacks: Map<string, () => void>;
  
  // アクション
  fetchUserPapers: (userId: string) => Promise<void>;
  fetchPaper: (paperId: string) => Promise<void>;
  fetchTranslatedChapters: (paperId: string) => Promise<void>;
  watchPaperProgress: (paperId: string) => void;
  unwatchPaperProgress: (paperId: string) => void;
  deletePaper: (paperId: string) => Promise<void>;
  clearCurrentPaper: () => void;
  clearError: () => void;
}

export const usePaperStore = create<PaperState>()(
  devtools(
    (set, get) => ({
      // ユーザーの論文一覧
      papers: [],
      loading: false,
      error: null,
      
      // 現在選択されている論文
      currentPaper: null,
      currentPaperChapters: [],
      currentPaperLoading: false,
      currentPaperError: null,
      
      // 翻訳・要約の進捗監視
      watchingPapers: new Set<string>(),
      unwatchCallbacks: new Map<string, () => void>(),
      
      // ユーザーの論文一覧を取得
      fetchUserPapers: async (userId: string) => {
        try {
          set({ loading: true, error: null });
          const papers = await getUserPapers(userId);
          set({ papers, loading: false });
          
          // 進行中の論文があれば、進捗を監視
          papers.forEach(paper => {
            if (paper.status !== 'completed' && paper.status !== 'error') {
              get().watchPaperProgress(paper.id);
            }
          });
        } catch (error: any) {
          set({ error: error.message, loading: false });
          console.error('Error fetching papers:', error);
        }
      },
      
      // 論文の詳細を取得
      fetchPaper: async (paperId: string) => {
        try {
          set({ currentPaperLoading: true, currentPaperError: null });
          const paper = await getPaper(paperId);
          set({ currentPaper: paper, currentPaperLoading: false });
          
          // 論文が完了していない場合は進捗を監視
          if (paper.status !== 'completed' && paper.status !== 'error') {
            get().watchPaperProgress(paper.id);
          }
          
          // 章の翻訳も取得
          await get().fetchTranslatedChapters(paperId);
          
          // 論文のステータスが processing なら、バックグラウンド処理の開始を確認
          if (paper.status === 'pending' || paper.status === 'metadata_extracted') {
            try {
              // 念のためバックグラウンド処理を開始/再開する
              await startPaperProcessing(paperId);
            } catch (err) {
              console.error('Error starting background processing:', err);
              // エラーは無視して続行
            }
          }
        } catch (error: any) {
          set({ currentPaperError: error.message, currentPaperLoading: false });
          console.error('Error fetching paper:', error);
        }
      },
      
      // 翻訳された章を取得
      fetchTranslatedChapters: async (paperId: string) => {
        try {
          const chapters = await getTranslatedChapters(paperId);
          set({ currentPaperChapters: chapters });
        } catch (error: any) {
          console.error('Error fetching translated chapters:', error);
          // エラーは表示せず、空の配列を設定
          set({ currentPaperChapters: [] });
        }
      },
      
      // 論文の進捗を監視
      watchPaperProgress: (paperId: string) => {
        const { watchingPapers, unwatchCallbacks } = get();
        
        // すでに監視中ならスキップ
        if (watchingPapers.has(paperId)) {
          return;
        }
        
        // 監視開始
        const unsubscribe = watchPaperStatus(paperId, (paper) => {
          // 論文一覧の更新
          set(state => ({
            papers: state.papers.map(p => p.id === paperId ? paper : p)
          }));
          
          // 現在表示中の論文なら、詳細も更新
          if (get().currentPaper?.id === paperId) {
            set({ currentPaper: paper });
            
            // 完了したら翻訳された章も更新
            if (paper.status === 'completed') {
              get().fetchTranslatedChapters(paperId);
            }
          }
          
          // 翻訳完了または失敗したら監視終了
          if (paper.status === 'completed' || paper.status === 'error') {
            get().unwatchPaperProgress(paperId);
          }
        });
        
        // 監視状態を保存
        watchingPapers.add(paperId);
        unwatchCallbacks.set(paperId, unsubscribe);
        
        set({ watchingPapers, unwatchCallbacks });
      },
      
      // 論文の進捗監視を停止
      unwatchPaperProgress: (paperId: string) => {
        const { watchingPapers, unwatchCallbacks } = get();
        
        if (watchingPapers.has(paperId)) {
          const unsubscribe = unwatchCallbacks.get(paperId);
          if (unsubscribe) {
            unsubscribe();
          }
          
          watchingPapers.delete(paperId);
          unwatchCallbacks.delete(paperId);
          
          set({ watchingPapers, unwatchCallbacks });
        }
      },
      
      // 論文を削除
      deletePaper: async (paperId: string) => {
        try {
          set({ loading: true, error: null });
          
          // 監視を停止
          get().unwatchPaperProgress(paperId);
          
          // 削除処理
          await deletePaper(paperId);
          
          // 論文一覧から削除
          set(state => ({
            papers: state.papers.filter(p => p.id !== paperId),
            loading: false
          }));
          
          // 現在表示中の論文なら、クリア
          if (get().currentPaper?.id === paperId) {
            get().clearCurrentPaper();
          }
        } catch (error: any) {
          set({ error: error.message, loading: false });
          console.error('Error deleting paper:', error);
        }
      },
      
      // 現在の論文をクリア
      clearCurrentPaper: () => {
        set({ 
          currentPaper: null, 
          currentPaperChapters: [],
          currentPaperError: null
        });
      },
      
      // エラーをクリア
      clearError: () => {
        set({ error: null, currentPaperError: null });
      }
    })
  )
);