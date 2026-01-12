import {
    Avatar,
    Box,
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    House,
    Images,
    Sparkle,
    Fingerprint,
    Gear,
    OpenAiLogo,
} from '@phosphor-icons/react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import StoatIconWhiteBg from '../../../assets/stoat_icon_white_bg_v3.png';
import StoatIconDarkBg from '../../../assets/stoat_icon_dark_bg_v3.png';
import { useColorMode } from '../../../features/theme/ThemeContext';
import { getAgentSettings } from '../../../services/agentService';

interface LeftSidebarProps {
    open: boolean;
    onClose: () => void;
}

const DRAWER_WIDTH = 212;

const isElectron = () => {
    return !!(
        (window as any).process?.versions?.electron ||
        window.navigator.userAgent.toLowerCase().includes('electron') ||
        (window as any).windowControls
    );
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ open, onClose }) => {
    const theme = useTheme();
    const { colorTheme } = useColorMode();
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const hasGradient = colorTheme.gradient !== 'none' || !!colorTheme.special || !!colorTheme.image;

    const allNavItems = [
        { key: 'dashboard', label: '仪表板', path: '/', icon: <House weight="regular" size={20} /> },
        { key: 'library', label: '图库', path: '/library', icon: <Images weight="regular" size={20} /> },
        { key: 'classification', label: '分类', path: '/classification', icon: <Sparkle weight="regular" size={20} /> },
        { key: 'reid', label: '个体鉴别', path: '/reid', icon: <Fingerprint weight="regular" size={20} /> },
        { key: 'agent', label: 'AI助手', path: '/agent', icon: <OpenAiLogo weight="regular" size={20} /> },
        { key: 'settings', label: '设置', path: '/settings', icon: <Gear weight="regular" size={20} /> },
    ];

    // Track AI Agent enabled state with live updates
    const [agentEnabled, setAgentEnabled] = React.useState(() => getAgentSettings().enabled);

    React.useEffect(() => {
        const handleSettingsChange = () => {
            setAgentEnabled(getAgentSettings().enabled);
        };

        // Listen for custom event dispatched when settings change
        window.addEventListener('agentSettingsChanged', handleSettingsChange);
        return () => window.removeEventListener('agentSettingsChanged', handleSettingsChange);
    }, []);

    const navItems = allNavItems.filter(item => item.key !== 'agent' || agentEnabled);

    const isActivePath = (path: string) => {
        if (path === '/') return location.pathname === path;
        return location.pathname.startsWith(path);
    };

    const handleNavigate = (path: string) => {
        navigate(path);
        if (isMobile) onClose();
    };

    // Background styles based on gradient theme
    const getBackgroundStyle = () => {
        if (hasGradient) {
            return {
                bgcolor: theme.palette.mode === 'dark'
                    ? 'rgba(0, 0, 0, 0.4)'
                    : 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            };
        }
        return {
            bgcolor: theme.palette.mode === 'light' ? '#F9F9F9' : theme.palette.background.paper,
        };
    };

    return (
        <Drawer
            variant={isMobile ? 'temporary' : 'persistent'}
            open={open}
            onClose={onClose}
            sx={{
                ...(isElectron() && { WebkitUserSelect: 'none' }),
                width: open ? DRAWER_WIDTH : 0,
                flexShrink: 0,
                overflowX: 'hidden',
                '& .MuiDrawer-paper': {
                    width: DRAWER_WIDTH,
                    boxSizing: 'border-box',
                    borderRight: isMobile ? 'none' : '1px solid',
                    borderColor: hasGradient
                        ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
                        : 'divider',
                    ...getBackgroundStyle(),
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    gap: '8px',
                    transition: theme.transitions.create(['width', 'background-color'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                },
                transition: theme.transitions.create('width', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                }),
            }}
            ModalProps={{ keepMounted: true }}
        >
            <Box
                onClick={() => navigate('/')}
                sx={{
                    // ...(isElectron() && { WebkitAppRegion: 'no-drag' }),
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '12px',
                    mb: 2,
                    gap: '8px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    textDecoration: 'none',
                    '&:hover': {
                        bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.04),
                    }
                }}
            >
                <Avatar
                    src={theme.palette.mode === 'dark' ? StoatIconWhiteBg : StoatIconDarkBg}
                    alt="RewildID"
                    sx={{ width: 36, height: 36, bgcolor: 'transparent', borderRadius: '8px' }}
                />
                <Box sx={{ ml: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontFamily: 'Outfit, sans-serif',
                            fontWeight: 700,
                            lineHeight: 1.2,
                            background: theme.palette.mode === 'dark'
                                ? 'linear-gradient(90deg, #FFFFFF 0%, #A0A0A0 100%)'
                                : 'linear-gradient(90deg, #1C1C1C 0%, #4A4A4A 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em'
                        }}
                    >
                        鱼类识别
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            fontFamily: 'Inter, sans-serif',
                            color: theme.palette.text.secondary,
                            fontSize: '10px',
                            fontWeight: 500,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}
                    >
                        开发演示版本
                    </Typography>
                </Box>
            </Box>

            <List sx={{ width: '100%', p: 0 }}>
                {navItems.map((item) => {
                    const isActive = isActivePath(item.path);

                    return (
                        <Box key={item.key} sx={{ position: 'relative' }}>
                            <ListItemButton
                                data-tour={`nav-${item.key}`}
                                selected={isActive}
                                onClick={() => handleNavigate(item.path)}
                                sx={{
                                    // ...(isElectron() && { WebkitAppRegion: 'no-drag' }),
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px',
                                    borderRadius: '12px',
                                    mb: 0.5,
                                    '&.Mui-selected': {
                                        bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.08) : alpha(theme.palette.common.black, 0.05),
                                        color: theme.palette.text.primary,
                                        fontWeight: 500,
                                        '&:hover': {
                                            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.12) : alpha(theme.palette.common.black, 0.08),
                                        }
                                    },
                                    '&:hover': {
                                        bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.04),
                                        '&:hover .sidebar-item-menu-button': { opacity: 1 },
                                    },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                                    <ListItemIcon sx={{ minWidth: 36, color: isActive ? theme.palette.text.primary : theme.palette.text.secondary, overflow: 'visible' }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.label}
                                        primaryTypographyProps={{
                                            fontFamily: 'Inter, sans-serif',
                                            fontSize: '14px',
                                            fontWeight: isActive ? 500 : 400,
                                            lineHeight: '20px',
                                            letterSpacing: '0px',
                                            sx: { fontFeatureSettings: "'ss01' on, 'cv01' on" },
                                            color: isActive ? theme.palette.text.primary : theme.palette.text.secondary
                                        }}
                                    />
                                </Box>
                            </ListItemButton>
                        </Box>
                    );
                })}
            </List>

            <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: theme.palette.mode === 'dark' ? 'white' : '#1C1C1C', opacity: 0.7, fontSize: '16px' }}>

                </Typography>
            </Box>

        </Drawer>
    );
};

export default LeftSidebar;
