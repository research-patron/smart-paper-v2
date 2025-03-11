// ~/Desktop/smart-paper-v2/frontend/src/styles/theme.ts
import { createTheme } from '@mui/material/styles';

// アプリケーション全体のテーマ設定を #f8c677 を基調として設定
// テキスト色を白寄りのグレーに統一
const theme = createTheme({
  palette: {
    primary: {
      main: '#f8c677', // メインカラーを指定の色に
      light: '#ffda9e', // 明るめの派生色
      dark: '#d3964d', // 暗めの派生色
      contrastText: '#f5f5f5', // 主要テキスト色を白寄りのグレーに
    },
    secondary: {
      main: '#e98a4d', // 補色としてより濃いオレンジ系
      light: '#ffba7a',
      dark: '#b45c24',
      contrastText: '#f5f5f5', // 主要テキスト色を白寄りのグレーに
    },
    error: {
      main: '#d32f2f',
      contrastText: '#f5f5f5',
    },
    background: {
      default: '#f9f6f1', // 薄いベージュ系の背景
      paper: '#ffffff',
    },
    text: {
      primary: '#555555', // やや軽めの黒に変更
      secondary: '#777777', // セカンダリテキストも軽めに
    },
    divider: 'rgba(248, 198, 119, 0.12)', // メインカラーを基にした薄い区切り線
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
      '"Noto Sans JP"', // 日本語フォントを追加
      '"Noto Sans"',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: '#555555', // 見出しの色も統一
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#555555',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: '#555555',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      color: '#555555',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      color: '#555555',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      color: '#555555',
    },
    button: {
      textTransform: 'none', // ボタンのテキスト変換を無効化
    },
    body1: {
      color: '#555555',
    },
    body2: {
      color: '#666666',
    },
    subtitle1: {
      color: '#555555',
    },
    subtitle2: {
      color: '#666666',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2)',
          },
          color: '#f5f5f5', // ボタンテキストを白寄りのグレーに
        },
        outlined: {
          color: '#555555', // アウトラインボタンのテキスト色
          '&:hover': {
            backgroundColor: 'rgba(248, 198, 119, 0.08)',
          },
        },
        text: {
          color: '#555555', // テキストボタンの色
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          overflow: 'hidden',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: '#f8c677', // ヘッダーの色も統一
          color: '#f5f5f5', // ヘッダーのテキスト色を白寄りのグレーに
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: '#f8c677',
          color: '#f5f5f5',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: 'rgba(248, 198, 119, 0.3)',
        },
        barColorPrimary: {
          backgroundColor: '#f8c677',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: '#666666',
          '&.Mui-selected': {
            color: '#d3964d',
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#d3964d', // リンク色も統一
          '&:hover': {
            color: '#e98a4d',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#555555',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          color: '#555555',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#666666',
        },
      },
    },
  },
});

export default theme;