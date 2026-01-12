import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Button, Slide, useTheme, alpha } from '@mui/material';
import { ArrowClockwise, X } from '@phosphor-icons/react';
import { Job } from '../hooks/useJobs';

interface RefreshNotificationProps {
    /** Which job types trigger this notification */
    watchJobTypes: Job['type'][];
    /** Callback when refresh button is clicked */
    onRefresh: () => void;
    /** Custom message to display */
    message?: string;
}

/**
 * Shows a notification bar when relevant jobs complete, prompting user to refresh.
 * Does NOT auto-refresh to avoid disrupting user's current view.
 */
export const RefreshNotification: React.FC<RefreshNotificationProps> = ({
    watchJobTypes,
    onRefresh,
    message = '有新数据可用'
}) => {
    const theme = useTheme();
    const [show, setShow] = useState(false);
    const seenJobIds = useRef<Set<string>>(new Set());
    const initialLoadDone = useRef(false);

    // Track job completions
    useEffect(() => {
        // Get initial jobs to mark as "seen" (so we don't show notification on page load)
        window.api.getJobs().then((jobs: Job[]) => {
            jobs.forEach(job => {
                if (watchJobTypes.includes(job.type) && job.status === 'completed') {
                    seenJobIds.current.add(job.id);
                }
            });
            initialLoadDone.current = true;
        });

        // Listen for job updates
        const removeListener = window.api.onJobUpdate((jobs: Job[]) => {
            if (!initialLoadDone.current) return;

            let hasNewCompletion = false;
            jobs.forEach(job => {
                if (
                    watchJobTypes.includes(job.type) &&
                    job.status === 'completed' &&
                    !seenJobIds.current.has(job.id)
                ) {
                    seenJobIds.current.add(job.id);
                    hasNewCompletion = true;
                }
            });

            if (hasNewCompletion) {
                setShow(true);
            }
        });

        return removeListener;
    }, [watchJobTypes]);

    const handleRefresh = useCallback(() => {
        setShow(false);
        onRefresh();
    }, [onRefresh]);

    const handleDismiss = useCallback(() => {
        setShow(false);
    }, []);

    if (!show) return null;

    return (
        <Slide direction="down" in={show} mountOnEnter unmountOnExit>
            <Box
                sx={{
                    position: 'absolute',
                    top: 72, // Below navbar
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.primary.main, 0.15)
                        : alpha(theme.palette.primary.main, 0.1),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    backdropFilter: 'blur(8px)',
                    boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
                }}
            >
                <ArrowClockwise
                    size={18}
                    weight="bold"
                    color={theme.palette.primary.main}
                    style={{ animation: 'spin 2s linear infinite' }}
                />
                <Typography variant="body2" fontWeight={500} sx={{ color: theme.palette.text.primary }}>
                    {message}
                </Typography>
                <Button
                    size="small"
                    variant="contained"
                    onClick={handleRefresh}
                    sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 1.5,
                    }}
                >
                    刷新
                </Button>
                <Box
                    component="button"
                    onClick={handleDismiss}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 0.5,
                        ml: 0.5,
                        border: 'none',
                        bgcolor: 'transparent',
                        cursor: 'pointer',
                        borderRadius: 1,
                        color: theme.palette.text.secondary,
                        '&:hover': {
                            bgcolor: alpha(theme.palette.text.primary, 0.1),
                        }
                    }}
                >
                    <X size={14} weight="bold" />
                </Box>
            </Box>
        </Slide>
    );
};

// Add keyframe animation for the icon
const style = document.createElement('style');
style.textContent = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
`;
if (!document.querySelector('style[data-refresh-notification]')) {
    style.setAttribute('data-refresh-notification', 'true');
    document.head.appendChild(style);
}

export default RefreshNotification;
