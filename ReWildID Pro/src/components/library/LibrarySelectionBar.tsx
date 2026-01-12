import React, { useState } from 'react';
import { Box, IconButton, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import { X, Trash, Sparkle, DownloadSimple } from '@phosphor-icons/react';
import { AnalyseMenu } from './AnalyseMenu';

interface LibrarySelectionBarProps {
    selectedCount: number;
    onClose: () => void;
    onDelete: () => void;
    onClassify: () => void;
    onReID: (species: string) => void;
    onSave: () => void;
    leftSidebarOpen?: boolean;
    rightSidebarOpen?: boolean;
    availableSpecies?: string[];
}

export const LibrarySelectionBar: React.FC<LibrarySelectionBarProps> = ({
    selectedCount,
    onClose,
    onDelete,
    onClassify,
    onReID,
    onSave,
    leftSidebarOpen = false,
    rightSidebarOpen = false,
    availableSpecies = []
}) => {
    const theme = useTheme();
    const [analyseMenuOpen, setAnalyseMenuOpen] = useState(false);

    // Calculate center offset based on sidebar states
    // Left Sidebar: 212px, Right Sidebar: 212px
    const leftWidth = leftSidebarOpen ? 212 : 0;
    const rightWidth = rightSidebarOpen ? 212 : 0;
    const offset = (leftWidth - rightWidth) / 2;

    return (
        <>
            <Box sx={{
                position: 'fixed',
                bottom: 32,
                left: '50%',
                transform: `translateX(calc(-50% + ${offset}px))`,
                zIndex: 1200,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                pl: 1.5,
                pr: 2,
                py: 1,
                borderRadius: '999px',
                bgcolor: theme.palette.mode === 'light' ? alpha('#FFFFFF', 0.25) : alpha(theme.palette.background.paper, 0.45),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${theme.palette.divider}`,
                transition: theme.transitions.create('transform', {
                    duration: theme.transitions.duration.enteringScreen,
                    easing: theme.transitions.easing.easeOut
                })
            }}>
                <Tooltip title="退出选择模式">
                    <IconButton onClick={onClose} size="small" sx={{ color: theme.palette.text.secondary }}>
                        <X weight="bold" />
                    </IconButton>
                </Tooltip>

                <Typography variant="body2" fontWeight={600} sx={{ mx: 1, minWidth: '80px', textAlign: 'center' }}>
                    {selectedCount} 已选择
                </Typography>

                <Box sx={{ height: '20px', width: '1px', bgcolor: theme.palette.divider, mx: 0.5 }} />

                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="保存选中项">
                        <IconButton onClick={onSave} size="small" sx={{ '&:hover': { color: theme.palette.primary.main } }}>
                            <DownloadSimple />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="删除选中项">
                        <IconButton onClick={onDelete} size="small" sx={{ '&:hover': { color: theme.palette.error.main } }}>
                            <Trash />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="分析">
                        <IconButton onClick={() => setAnalyseMenuOpen(true)} size="small" color="primary">
                            <Sparkle weight="fill" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <AnalyseMenu
                open={analyseMenuOpen}
                onClose={() => setAnalyseMenuOpen(false)}
                onClassify={onClassify}
                onReID={onReID}
                availableSpecies={availableSpecies}
                selectedCount={selectedCount}
            />
        </>
    );
};
