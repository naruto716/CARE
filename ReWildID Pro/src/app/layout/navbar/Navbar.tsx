import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Box, IconButton, Tooltip, Badge, InputBase } from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import {
    Sidebar,
    ListChecks,
    CaretLeft,
    CaretRight,
    X,
    Minus,
    CornersOut,
    CornersIn,
    OpenAiLogo,
} from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import Breadcrumb from '../../../components/Breadcrumb';
import { useColorMode } from '../../../features/theme/ThemeContext';
import { useJobs } from '../../../hooks/useJobs';
import { getAgentSettings } from '../../../services/agentService';

interface NavbarProps {
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    agentIconShow: boolean;
}

export const NAVBAR_HEIGHT = 68;

const isElectron = () => {
    return !!(
        (window as any).process?.versions?.electron ||
        window.navigator.userAgent.toLowerCase().includes('electron') ||
        (window as any).windowControls
    );
};

export default function Navbar({
    toggleLeftSidebar,
    toggleRightSidebar,
    leftSidebarOpen,
    rightSidebarOpen,
}: NavbarProps) {
    const muiTheme = useMuiTheme();
    const { colorTheme } = useColorMode();
    const isDarkMode = muiTheme.palette.mode === 'dark';
    const location = useLocation();
    const navigate = useNavigate();
    const isMdUp = useMediaQuery(muiTheme.breakpoints.up('md'));
    const [isMaximized, setIsMaximized] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);

    const { jobs } = useJobs();
    const activeJobsCount = jobs.filter(j => ['pending', 'running'].includes(j.status)).length;

    const hasGradient = colorTheme.gradient !== 'none' || !!colorTheme.special || !!colorTheme.image;

    // Ask AI search bar state
    const [aiQuery, setAiQuery] = useState('');
    const isLgUp = useMediaQuery(muiTheme.breakpoints.up('lg'));
    const agentEnabled = getAgentSettings().enabled;

    useEffect(() => {
        // Function to update navigation state based on history
        const updateNavigationState = () => {
            const state = window.history.state;
            // React Router uses 'idx' in history state to track position
            const idx = state?.idx ?? 0;

            setCanGoBack(idx > 0);
            setCanGoForward(idx < window.history.length - 1);
        };

        // Update on mount and location change
        updateNavigationState();
    }, [location]);

    const inElectron = isElectron();
    const windowControls = inElectron ? (window as any).windowControls : null;

    useEffect(() => {
        const checkMaximizeState = async () => {
            if (windowControls) {
                const maximized = await windowControls.isMaximized();
                setIsMaximized(maximized);
            }
        };

        checkMaximizeState();

        if (windowControls?.onStateChange) {
            windowControls.onStateChange((isMaximized: boolean) => {
                setIsMaximized(isMaximized);
            });
        }

        const handleResize = () => {
            checkMaximizeState();
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (windowControls?.removeStateChangeListener) {
                windowControls.removeStateChangeListener();
            }
        };
    }, [windowControls]);

    const handleMinimize = () => {
        if (windowControls) windowControls.minimize();
    };

    const handleMaximize = async () => {
        if (windowControls) {
            try {
                await windowControls.maximize();
                setTimeout(async () => {
                    const maximized = await windowControls.isMaximized();
                    setIsMaximized(maximized);
                }, 200);
            } catch (error) {
                console.error('Error in handleMaximize:', error);
            }
        }
    };

    const handleClose = () => {
        if (windowControls) windowControls.close();
    };

    // Ask AI handlers
    const handleAskAI = () => {
        if (aiQuery.trim()) {
            navigate('/agent', { state: { initialMessage: aiQuery.trim() } });
            setAiQuery('');
        }
    };

    const handleAIInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAskAI();
        }
    };

    let customBreadcrumbItems;
    if (location.pathname === '/') {
        customBreadcrumbItems = undefined;
    } else if (location.pathname.match(/^\/reid\/run\/\d+\/individual\/\d+$/)) {
        const individualName = (location.state as any)?.individual?.display_name || `Individual ${location.pathname.split('/').pop()}`;
        customBreadcrumbItems = [
            { label: '个体鉴别', path: '/reid' },
            { label: individualName, path: location.pathname }
        ];
    } else {
        customBreadcrumbItems = undefined;
    }

    const leftSidebarWidth = leftSidebarOpen ? 212 : 0;
    const rightSidebarWidth = rightSidebarOpen ? 212 : 0;

    // Background styling based on gradient theme
    const getBackgroundStyle = () => {
        if (hasGradient) {
            return {
                backgroundColor: isDarkMode
                    ? 'rgba(0, 0, 0, 0.4)'
                    : 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            };
        }
        return {
            backgroundColor: isDarkMode
                ? 'rgba(18, 18, 18, 0.8)'
                : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
        };
    };

    return (
        <AppBar
            position="fixed"
            color="default"
            sx={{
                boxShadow: 'none',
                borderBottom: hasGradient
                    ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    : `1px solid ${muiTheme.palette.divider}`,
                ...getBackgroundStyle(),
                ...(inElectron && {
                    WebkitAppRegion: 'drag',
                    userSelect: 'none',
                    cursor: 'default',
                }),
                left: { xs: 0, md: leftSidebarWidth },
                right: { xs: 0, md: rightSidebarWidth },
                width: {
                    xs: '100%',
                    md: `calc(100% - ${leftSidebarWidth}px - ${rightSidebarWidth}px)`
                },
                transition: (theme: any) => theme.transitions.create(['width', 'left', 'right', 'background-color'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                }),
            }}
        >
            <Toolbar
                sx={{
                    display: 'flex',
                    width: '100%',
                    padding: { xs: '8px 8px', sm: '14px 28px' },
                    height: `${NAVBAR_HEIGHT}px`,
                    minHeight: `${NAVBAR_HEIGHT}px`,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    gap: { xs: 1, sm: 0 },
                    ...(inElectron && { WebkitAppRegion: 'drag' }),
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: '4px', sm: '8px' },
                        minWidth: 0,
                        flex: 1,
                        overflow: 'hidden',
                        ...(inElectron && { WebkitAppRegion: 'no-drag' }),
                    }}
                >
                    <IconButton
                        color="inherit"
                        aria-label="toggle sidebar"
                        onClick={toggleLeftSidebar}
                        sx={{ padding: 1, fontSize: { xs: 20, sm: 24 } }}
                    >
                        <Sidebar size={24} />
                    </IconButton>

                    <Tooltip title="后退">
                        <span>
                            <IconButton
                                color="inherit"
                                aria-label="go back"
                                onClick={() => navigate(-1)}
                                disabled={!canGoBack}
                                sx={{
                                    padding: 1,
                                    fontSize: { xs: 20, sm: 24 },
                                    opacity: canGoBack ? 1 : 0.3
                                }}
                            >
                                <CaretLeft size={24} />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Tooltip title="前进">
                        <span>
                            <IconButton
                                color="inherit"
                                aria-label="go forward"
                                onClick={() => navigate(1)}
                                disabled={!canGoForward}
                                sx={{
                                    padding: 1,
                                    fontSize: { xs: 20, sm: 24 },
                                    opacity: canGoForward ? 1 : 0.3
                                }}
                            >
                                <CaretRight size={24} />
                            </IconButton>
                        </span>
                    </Tooltip>

                    {isMdUp && (
                        <Breadcrumb customItems={customBreadcrumbItems} />
                    )}

                    {inElectron && (
                        <Box
                            sx={{
                                flexGrow: 1,
                                height: '100%',
                                minHeight: '40px',
                                WebkitAppRegion: 'drag',
                                cursor: 'default',
                                userSelect: 'none',
                                backgroundColor: 'transparent',
                                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' }
                            }}
                            title="Drag to move window"
                        />
                    )}
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: '4px', sm: '8px' },
                        minWidth: 0,
                        flexShrink: 0,
                        ...(inElectron && { WebkitAppRegion: 'no-drag' }),
                    }}
                >
                    {/*                     <Tooltip title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
                        <IconButton
                            color="inherit"
                            onClick={toggleColorMode}
                            sx={{ padding: 1 }}
                        >
                            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
                        </IconButton>
                    </Tooltip> */}

                    {/* Ask AI input (only visible on lg+ screens when agent is enabled and not on agent page) */}
                    {isLgUp && agentEnabled && !location.pathname.startsWith('/agent') && (
                        <Box
                            sx={{
                                display: 'flex',
                                width: '220px',
                                padding: '4px 8px',
                                alignItems: 'center',
                                gap: '8px',
                                borderRadius: '8px',
                                backgroundColor: isDarkMode
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                flexShrink: 1,
                                mr: 1,
                                transition: muiTheme.transitions.create(['width', 'opacity'], {
                                    easing: muiTheme.transitions.easing.sharp,
                                    duration: muiTheme.transitions.duration.shorter,
                                }),
                            }}
                        >
                            <OpenAiLogo size={16} color={muiTheme.palette.text.secondary} />
                            <InputBase
                                placeholder="询问AI..."
                                inputProps={{ 'aria-label': 'ask ai' }}
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                onKeyDown={handleAIInputKeyDown}
                                sx={{
                                    fontSize: '14px',
                                    color: muiTheme.palette.text.primary,
                                    width: '100%',
                                    '& input': {
                                        padding: '2px 0',
                                    }
                                }}
                            />
                        </Box>
                    )}

                    <Tooltip title="任务">
                        <IconButton
                            color="inherit"
                            onClick={toggleRightSidebar}
                            sx={{ padding: 1 }}
                        >
                            <Badge
                                badgeContent={activeJobsCount}
                                color="error"
                                max={99}
                                invisible={activeJobsCount === 0}
                                sx={{
                                    '& .MuiBadge-badge': {
                                        bgcolor: isDarkMode ? 'white' : 'black',
                                        color: isDarkMode ? 'black' : 'white',
                                        fontWeight: 'bold',
                                        fontSize: '0.65rem',
                                        height: 18,
                                        minWidth: 18,
                                    }
                                }}
                            >
                                <ListChecks size={24} />
                            </Badge>
                        </IconButton>
                    </Tooltip>
                    {inElectron && (
                        <Box sx={{ display: 'flex', gap: 0.5, ml: 1, WebkitAppRegion: 'no-drag' }}>
                            <Tooltip title="最小化">
                                <IconButton
                                    color="inherit"
                                    onClick={handleMinimize}
                                    sx={{ padding: 1, WebkitAppRegion: 'no-drag', '&:hover': { backgroundColor: muiTheme.palette.action.hover } }}
                                >
                                    <Minus size={18} />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={isMaximized ? '还原' : '最大化'}>
                                <IconButton
                                    color="inherit"
                                    onClick={handleMaximize}
                                    sx={{ padding: 1, WebkitAppRegion: 'no-drag', '&:hover': { backgroundColor: muiTheme.palette.action.hover } }}
                                >
                                    {isMaximized ? <CornersIn size={18} /> : <CornersOut size={18} />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="关闭">
                                <IconButton
                                    color="inherit"
                                    onClick={handleClose}
                                    sx={{ padding: 1, WebkitAppRegion: 'no-drag', '&:hover': { backgroundColor: muiTheme.palette.error.main, color: muiTheme.palette.error.contrastText } }}
                                >
                                    <X size={18} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
}
