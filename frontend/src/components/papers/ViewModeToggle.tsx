import React from 'react';
import {
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';

export type ViewMode = 'hierarchy' | 'grid';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  mode,
  onChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: ViewMode | null,
  ) => {
    if (newMode !== null) {
      onChange(newMode);
    }
  };

  const buttons = [
    {
      value: 'hierarchy',
      icon: <ViewListIcon />,
      tooltip: '階層表示',
    },
    {
      value: 'grid',
      icon: <ViewModuleIcon />,
      tooltip: 'カード表示',
    },
  ];

  return (
    <Box sx={{ mb: 2 }}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleChange}
        size={isMobile ? 'small' : 'medium'}
        aria-label="論文の表示モード"
      >
        {buttons.map(({ value, icon, tooltip }) => (
          <Tooltip key={value} title={tooltip} placement="top">
            <ToggleButton
              value={value}
              aria-label={tooltip}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                },
              }}
            >
              {icon}
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export default ViewModeToggle;
