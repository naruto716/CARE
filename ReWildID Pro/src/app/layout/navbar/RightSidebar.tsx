import React from 'react';
import {
    Box,
    Drawer,
    Typography,
    useTheme,
    useMediaQuery,
    IconButton
} from '@mui/material';
import { X } from '@phosphor-icons/react';
import { useColorMode } from '../../../features/theme/ThemeContext';

interface RightSidebarProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children?: React.ReactNode;
}

const DRAWER_WIDTH = 212;

export const RightSidebar: React.FC<RightSidebarProps> = ({
    open,
    onClose,
    title = '',
    children
}) => {
    const theme = useTheme();
    const { colorTheme } = useColorMode();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const hasGradient = colorTheme.gradient !== 'none' || !!colorTheme.special || !!colorTheme.image;

    return (
        <Drawer
            variant={isMobile ? 'temporary' : 'persistent'}
            anchor="right"
            open={open}
            onClose={onClose}
            sx={{
                width: isMobile ? (open ? DRAWER_WIDTH : 0) : (open ? DRAWER_WIDTH : 0),
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: DRAWER_WIDTH,
                    boxSizing: 'border-box',
                    borderLeft: '1px solid',
                    borderColor: hasGradient
                        ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
                        : 'divider',
                    // Background styling - transparent with blur when gradient active
                    backgroundColor: hasGradient
                        ? (theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)')
                        : (theme.palette.mode === 'dark' ? '#121212' : '#F9F9F9'),
                    backdropFilter: hasGradient ? 'blur(20px)' : 'none',
                    WebkitBackdropFilter: hasGradient ? 'blur(20px)' : 'none',
                    transition: theme.transitions.create(['width', 'background-color'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.shorter,
                    }),
                },
            }}
            ModalProps={{
                keepMounted: true,
            }}
        >
            <Box
                sx={{
                    height: '68px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    my: 1, // Add top margin for visual breathing room
                    // No background here - inherit from drawer paper
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {title || '通知'}
                </Typography>

                <IconButton
                    onClick={onClose}
                    size="small"
                    aria-label="Close"
                >
                    <X size={20} />
                </IconButton>
            </Box>
            <Box sx={{
                p: 2,
                height: '100%',
                // No background here - inherit from drawer paper
            }}>
                {children || (
                    <Typography color="text.secondary">
                        无通知。
                    </Typography>
                )}
            </Box>
        </Drawer>
    );
};

export default RightSidebar;
