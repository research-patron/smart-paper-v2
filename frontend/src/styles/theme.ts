// ~/Desktop/smart-paper-v2/frontend/src/styles/theme.ts
import { createTheme } from '@mui/material/styles';
import { alpha } from '@mui/material';

// SANGOテーマ風のカラーパレット
// 基本色: #f8c677 (オレンジ系)
const theme = createTheme({
  palette: {
    primary: {
      main: '#f8c677', // メインカラーを指定の色に
      light: '#ffda9e', // 明るめの派生色
      dark: '#d3964d', // 暗めの派生色
      contrastText: '#fff', // 主要テキスト色を白に
    },
    secondary: {
      main: '#e98a4d', // 補色としてより濃いオレンジ系
      light: '#ffba7a',
      dark: '#b45c24',
      contrastText: '#fff',
    },
    error: {
      main: '#ef5350',
      light: '#ffcdd2',
      dark: '#c62828',
      contrastText: '#fff',
    },
    warning: {
      main: '#ff9800',
      light: '#ffe0b2',
      dark: '#e65100',
      contrastText: '#fff',
    },
    info: {
      main: '#29b6f6',
      light: '#b3e5fc',
      dark: '#0288d1',
      contrastText: '#fff',
    },
    success: {
      main: '#66bb6a',
      light: '#c8e6c9',
      dark: '#2e7d32',
      contrastText: '#fff',
    },
    background: {
      default: '#f9f9f9', // ライトグレーの背景
      paper: '#ffffff',
    },
    text: {
      primary: '#333333', // やや暗めの黒に変更
      secondary: '#666666', // セカンダリテキストも調整
    },
    divider: alpha('#f8c677', 0.15), // メインカラーをベースにした区切り線
  },
  typography: {
    fontFamily: [
      '"Hiragino Sans"',
      '"Hiragino Kaku Gothic ProN"',
      '"Noto Sans JP"',
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
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: '#333333',
      letterSpacing: '-0.01em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      color: '#333333',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 700,
      color: '#333333',
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#333333',
      letterSpacing: '-0.01em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#333333',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontSize: '1.15rem',
      fontWeight: 600,
      color: '#333333',
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      color: '#333333',
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#555555',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.7,
      color: '#333333',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#555555',
    },
    button: {
      textTransform: 'none', // ボタンのテキスト変換を無効化
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
    caption: {
      fontSize: '0.8rem',
      color: '#666666',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f9f9f9',
          color: '#333333',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 50, // SANGOスタイルの丸いボタン
          padding: '8px 16px',
          fontWeight: 600,
        },
        contained: {
          boxShadow: '0 4px 10px rgba(248, 198, 119, 0.3)',
          '&:hover': {
            boxShadow: '0 6px 15px rgba(248, 198, 119, 0.4)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
            backgroundColor: alpha('#f8c677', 0.08),
          },
        },
        text: {
          '&:hover': {
            backgroundColor: alpha('#f8c677', 0.08),
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16, // SANGOスタイルの丸みを帯びたカード
        },
        elevation1: {
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
        },
        elevation2: {
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.06)',
        },
        elevation3: {
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.07)',
        },
        elevation4: {
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
        },
        elevation6: {
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.09)',
        },
        elevation8: {
          boxShadow: '0 14px 30px rgba(0, 0, 0, 0.1)',
        },
        elevation12: {
          boxShadow: '0 16px 35px rgba(0, 0, 0, 0.12)',
        },
        elevation16: {
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        },
        elevation24: {
          boxShadow: '0 24px 45px rgba(0, 0, 0, 0.18)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.09)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 24,
          '&:last-child': {
            paddingBottom: 24,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 50, // 完全な丸みのチップ
          fontWeight: 600,
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          },
        },
        filled: {
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha('#f8c677', 0.15),
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            transition: 'all 0.2s ease',
            '&.Mui-focused': {
              boxShadow: `0 0 0 2px ${alpha('#f8c677', 0.3)}`,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#f8c677',
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#f8c677', 0.3),
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          height: 8,
          backgroundColor: alpha('#f8c677', 0.15),
        },
        bar: {
          borderRadius: 12,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: '#f8c677',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
        },
        colorPrimary: {
          backgroundColor: '#ffffff',
          color: '#333333',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          padding: '0 24px',
          '@media (min-width: 600px)': {
            padding: '0 24px',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '24px 24px 12px 24px',
          fontSize: '1.25rem',
          fontWeight: 600,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '12px 24px 24px 24px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '8px 24px 24px 24px',
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          padding: '8px 0',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&:hover': {
            backgroundColor: alpha('#f8c677', 0.08),
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&:hover': {
            backgroundColor: alpha('#f8c677', 0.08),
          },
          '&.Mui-selected': {
            backgroundColor: alpha('#f8c677', 0.15),
            '&:hover': {
              backgroundColor: alpha('#f8c677', 0.2),
            },
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          overflow: 'visible',
        },
        indicator: {
          height: 3,
          borderRadius: 1.5,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: '8px 8px 0 0',
          transition: 'all 0.2s ease',
          '&.Mui-selected': {
            color: '#f8c677',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        },
        standardSuccess: {
          backgroundColor: alpha('#66bb6a', 0.1),
          color: '#2e7d32',
        },
        standardError: {
          backgroundColor: alpha('#ef5350', 0.1),
          color: '#c62828',
        },
        standardInfo: {
          backgroundColor: alpha('#29b6f6', 0.1),
          color: '#0288d1',
        },
        standardWarning: {
          backgroundColor: alpha('#ff9800', 0.1),
          color: '#e65100',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: alpha('#f8c677', 0.12),
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(33, 33, 33, 0.9)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.75rem',
        },
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 2px 4px rgba(0, 0, 0, 0.05)',
    '0 4px 6px rgba(0, 0, 0, 0.06)',
    '0 6px 8px rgba(0, 0, 0, 0.07)',
    '0 8px 12px rgba(0, 0, 0, 0.08)',
    '0 10px 14px rgba(0, 0, 0, 0.09)',
    '0 12px 16px rgba(0, 0, 0, 0.1)',
    '0 14px 18px rgba(0, 0, 0, 0.11)',
    '0 16px 20px rgba(0, 0, 0, 0.12)',
    '0 18px 22px rgba(0, 0, 0, 0.13)',
    '0 20px 24px rgba(0, 0, 0, 0.14)',
    '0 22px 26px rgba(0, 0, 0, 0.15)',
    '0 24px 28px rgba(0, 0, 0, 0.16)',
    '0 26px 30px rgba(0, 0, 0, 0.17)',
    '0 28px 32px rgba(0, 0, 0, 0.18)',
    '0 30px 34px rgba(0, 0, 0, 0.19)',
    '0 32px 36px rgba(0, 0, 0, 0.2)',
    '0 34px 38px rgba(0, 0, 0, 0.21)',
    '0 36px 40px rgba(0, 0, 0, 0.22)',
    '0 38px 42px rgba(0, 0, 0, 0.23)',
    '0 40px 44px rgba(0, 0, 0, 0.24)',
    '0 42px 46px rgba(0, 0, 0, 0.25)',
    '0 44px 48px rgba(0, 0, 0, 0.26)',
    '0 46px 50px rgba(0, 0, 0, 0.27)',
    '0 48px 52px rgba(0, 0, 0, 0.28)',
  ],
});

export default theme;