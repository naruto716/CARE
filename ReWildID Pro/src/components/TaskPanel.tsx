import React from 'react';
import { Box, Typography, LinearProgress, IconButton, List, Paper, useTheme, Chip, Button } from '@mui/material';
import { XCircle, DownloadIcon, ScanIcon, IdentificationCardIcon, ImageIcon, ArrowRight, ArrowClockwise } from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useJobs, Job } from '../hooks/useJobs';
import { triggerRefresh } from '../utils/navigationEvents';
import { toast } from 'sonner';

const TaskPanel: React.FC = () => {
    const { jobs, cancelJob, retryJob } = useJobs();
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    // Map job type to target page
    const getTargetPage = (type: Job['type']): { path: string; name: 'library' | 'classification' | 'reid' } | null => {
        switch (type) {
            case 'import':
            case 'thumbnail':
                return { path: '/library', name: 'library' };
            case 'detect':
                return { path: '/classification', name: 'classification' };
            case 'reid':
                return { path: '/reid', name: 'reid' };
            default:
                return null;
        }
    };

    const handleViewResults = (job: Job) => {
        const target = getTargetPage(job.type);
        if (!target) return;

        if (location.pathname === target.path) {
            // Already on the page - just trigger refresh
            triggerRefresh(target.name);
        } else {
            // Navigate to the page (it will load fresh data)
            navigate(target.path);
        }
    };

    const handleRetry = (jobId: string) => {
        retryJob(jobId);
        toast.info('Retrying with cached results', {
            description: 'Previously processed images will be skipped.',
        });
    };

    if (jobs.length === 0) {
        return (
            <Box sx={{ p: 3, textAlign: 'center', opacity: 0.6 }}>
                <Typography variant="body2">无活动任务</Typography>
            </Box>
        );
    }

    const getJobIcon = (type: Job['type']) => {
        const props = { size: 24, weight: 'duotone' as const };
        switch (type) {
            case 'import': return <DownloadIcon {...props} />;
            case 'thumbnail': return <ImageIcon {...props} />;
            case 'detect': return <ScanIcon {...props} />;
            case 'reid': return <IdentificationCardIcon {...props} />;
            default: return <DownloadIcon {...props} />;
        }
    };

    return (
        <List disablePadding sx={{ width: '100%' }}>
            {jobs.map((job) => (
                <Paper
                    key={job.id}
                    elevation={0}
                    sx={{
                        mb: 1,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: theme.palette.background.default,
                        '&:hover': { bgcolor: theme.palette.action.hover }
                    }}
                >
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        {/* Icon - Circular Background */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            flexShrink: 0,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                            color: theme.palette.text.primary
                        }}>
                            {getJobIcon(job.type)}
                        </Box>

                        {/* Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>

                            {/* Header: Title + Badge */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 0.25 }}>
                                <Typography variant="subtitle2" fontWeight="600" sx={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                    {job.type}
                                </Typography>

                                {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                                    <Box>
                                        {job.status === 'completed' && (
                                            <Chip
                                                label="完成"
                                                size="small"
                                                variant="filled"
                                                sx={{
                                                    height: 16,
                                                    fontSize: '0.65rem',
                                                    bgcolor: theme.palette.success.main,
                                                    color: theme.palette.success.contrastText,
                                                    fontWeight: 600
                                                }}
                                            />
                                        )}
                                        {job.status === 'failed' && (
                                            <Chip
                                                label="失败"
                                                size="small"
                                                color="error"
                                                sx={{ height: 16, fontSize: '0.65rem' }}
                                            />
                                        )}
                                        {job.status === 'cancelled' && (
                                            <Chip
                                                label="已取消"
                                                size="small"
                                                sx={{
                                                    height: 16,
                                                    fontSize: '0.65rem',
                                                    bgcolor: theme.palette.warning.main,
                                                    color: theme.palette.warning.contrastText,
                                                    fontWeight: 600
                                                }}
                                            />
                                        )}
                                    </Box>
                                )}
                            </Box>

                            {/* Message */}
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    fontSize: '0.75rem',
                                    mb: job.status === 'running' ? 1 : 0.5,
                                    lineHeight: 1.3,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}
                            >
                                {job.message}
                            </Typography>

                            {/* Footer: Time + (Progress) */}
                            {job.status === 'running' ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                                        {new Date(job.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </Typography>
                                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={job.progress}
                                            sx={{ flexGrow: 1, borderRadius: 1, height: 4 }}
                                        />
                                        <IconButton size="small" onClick={() => cancelJob(job.id)} sx={{ p: 0, color: 'text.secondary' }}>
                                            <XCircle size={14} />
                                        </IconButton>
                                    </Box>
                                </Box>
                            ) : (
                                <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                        {new Date(job.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </Typography>
                                    {job.status === 'completed' && getTargetPage(job.type) && (
                                        <Button
                                            size="small"
                                            onClick={() => handleViewResults(job)}
                                            endIcon={<ArrowRight size={14} />}
                                            sx={{
                                                fontSize: '0.7rem',
                                                textTransform: 'none',
                                                py: 0,
                                                px: 1,
                                                minHeight: 'auto',
                                                color: theme.palette.primary.main,
                                                '&:hover': {
                                                    bgcolor: 'transparent',
                                                    textDecoration: 'underline'
                                                }
                                            }}
                                        >
                                            查看
                                        </Button>
                                    )}
                                    {(job.status === 'failed' || job.status === 'cancelled') &&
                                        (job.type === 'detect' || job.type === 'reid' || job.type === 'import') && (
                                            <Button
                                                size="small"
                                                onClick={() => handleRetry(job.id)}
                                                startIcon={<ArrowClockwise size={14} />}
                                                sx={{
                                                    fontSize: '0.7rem',
                                                    textTransform: 'none',
                                                    py: 0,
                                                    px: 1,
                                                    minHeight: 'auto',
                                                    color: theme.palette.warning.main,
                                                    '&:hover': {
                                                        bgcolor: 'transparent',
                                                        textDecoration: 'underline'
                                                    }
                                                }}
                                            >
                                                重试
                                            </Button>
                                        )}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Paper>
            ))}
        </List>
    );
};

export default TaskPanel;
