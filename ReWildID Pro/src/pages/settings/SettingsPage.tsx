import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    Slider,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    Tooltip,
    useTheme,
    alpha,
    TextField,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Checkbox,
    FormControlLabel,
} from '@mui/material';
import { getAgentSettings, saveAgentSettings } from '../../services/agentService';
import { AVAILABLE_MODELS, IMAGE_GENERATION_MODELS, IMAGE_RESOLUTIONS } from '../../types/agent';
import {
    CaretDown,
    GridFour,
    Eye,
    Sparkle,
    Tag,
    Fingerprint,
    ArrowCounterClockwise,
    Image as ImageIcon,
    Cube,
    TextT,
    Drop,
    BoundingBox,
    Lightbulb,
    PaintBrush,
    Check,
    Sun,
    Moon,
    Trash,
    OpenAiLogo,
    Key,
    Warning,
    Cloud,
} from '@phosphor-icons/react';
import StyledSwitch from '../../components/StyledSwitch';
import { resetAllTours } from '../../components/OnboardingTour';
import { useColorMode, COLOR_THEMES, ColorTheme } from '../../features/theme/ThemeContext';

// Settings item interface
interface SettingsItem {
    key: string;
    label: string;
    description?: string;
    icon: JSX.Element;
    section: 'display' | 'visual' | 'tags';
    type: 'switch' | 'slider' | 'toggle';
    options?: string[];
    min?: number;
    max?: number;
    defaultValue?: any;
}

// All settings items configuration
const settingsItems: SettingsItem[] = [
    // Display Settings
    {
        key: 'gridSize',
        label: 'Grid Size',
        description: 'Adjust the size of image thumbnails in the library grid',
        icon: <GridFour size={24} />,
        section: 'display',
        type: 'slider',
        min: 100,
        max: 715,
        defaultValue: 180
    },
    {
        key: 'aspectRatio',
        label: 'Aspect Ratio',
        description: 'Set the aspect ratio for image thumbnails',
        icon: <ImageIcon size={24} />,
        section: 'display',
        type: 'toggle',
        options: ['1/1', '4/3', '16/9', '9/16', '1.618/1', '1/1.618'],
        defaultValue: '1.618/1'
    },
    {
        key: 'showNames',
        label: 'Show File Names',
        description: 'Display file names below image thumbnails',
        icon: <TextT size={24} />,
        section: 'display',
        type: 'switch',
        defaultValue: false
    },
    // Visual Effects
    {
        key: 'useLiquidGlass',
        label: 'Liquid Glass BBox',
        description: 'Use liquid glass effect for detection bounding boxes',
        icon: <Drop size={24} />,
        section: 'visual',
        type: 'switch',
        defaultValue: true
    },
    {
        key: 'useRayTracedGlass',
        label: 'Ray-traced Glass',
        description: 'Enable ray-traced rendering for liquid glass effect (requires Liquid Glass to be enabled)',
        icon: <Cube size={24} />,
        section: 'visual',
        type: 'switch',
        defaultValue: true
    },
    // Tags
    {
        key: 'showSpeciesTags',
        label: 'Show Species Tags',
        description: 'Display species classification tags on image thumbnails',
        icon: <Tag size={24} />,
        section: 'tags',
        type: 'switch',
        defaultValue: true
    },
    {
        key: 'showReidTags',
        label: 'Show Individual Tags',
        description: 'Display re-identification individual name tags on image thumbnails',
        icon: <Fingerprint size={24} />,
        section: 'tags',
        type: 'switch',
        defaultValue: true
    },
    {
        key: 'showBoundingBoxes',
        label: 'Show Bounding Boxes',
        description: 'Display detection bounding boxes when viewing images in full screen',
        icon: <BoundingBox size={24} />,
        section: 'tags',
        type: 'switch',
        defaultValue: true
    },
];

// Settings sections configuration
const sections = [
    {
        id: 'display',
        title: 'Display Settings',
        description: 'Customize how images are displayed in the library',
        icon: <Eye size={20} />
    },
    {
        id: 'visual',
        title: 'Visual Effects',
        description: 'Configure visual effects for detection overlays',
        icon: <Sparkle size={20} />
    },
    {
        id: 'tags',
        title: 'Tag Visibility',
        description: 'Control which tags are shown on image thumbnails',
        icon: <Tag size={20} />
    },
];

// Theme swatch component
const ThemeSwatch: React.FC<{
    themeOption: ColorTheme;
    isSelected: boolean;
    onClick: () => void;
}> = ({ themeOption, isSelected, onClick }) => {
    const muiTheme = useTheme();

    return (
        <Tooltip title={`${themeOption.name} (${themeOption.mode === 'dark' ? 'Dark' : 'Light'})`}>
            <Box
                onClick={onClick}
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 2,
                    background: themeOption.previewGradient,
                    cursor: 'pointer',
                    position: 'relative',
                    border: isSelected
                        ? `3px solid ${muiTheme.palette.primary.main}`
                        : `2px solid ${alpha(muiTheme.palette.divider, 0.3)}`,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    '&:hover': {
                        transform: 'scale(1.05)',
                        borderColor: muiTheme.palette.primary.main,
                    },
                }}
            >
                {/* Mode indicator */}
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        backgroundColor: themeOption.mode === 'dark'
                            ? 'rgba(0,0,0,0.7)'
                            : 'rgba(255,255,255,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${themeOption.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                >
                    {themeOption.mode === 'dark' ? (
                        <Moon size={10} weight="fill" color="#fff" />
                    ) : (
                        <Sun size={10} weight="fill" color="#000" />
                    )}
                </Box>

                {/* Selected checkmark */}
                {isSelected && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                    >
                        <Check size={12} weight="bold" color="#000" />
                    </Box>
                )}
            </Box>
        </Tooltip>
    );
};

const SettingsPage: React.FC = () => {
    const theme = useTheme();
    const { colorTheme, setColorTheme } = useColorMode();
    const hasGradient = colorTheme.gradient !== 'none' || !!colorTheme.special || !!colorTheme.image;

    // AI Agent settings
    const [aiApiKey, setAiApiKey] = useState(() => getAgentSettings().apiKey);
    const [aiModel, setAiModel] = useState(() => getAgentSettings().model);
    const [aiEnabled, setAiEnabled] = useState(() => getAgentSettings().enabled);
    const [showApiKey, setShowApiKey] = useState(false);
    // Image generation settings
    const [imageGenModel, setImageGenModel] = useState(() => getAgentSettings().imageGenerationModel || 'gemini-2.5-flash-image');
    const [imageResolution, setImageResolution] = useState(() => getAgentSettings().imageResolution || '1K');

    // Privacy agreement dialog state
    const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
    const [privacyAgreed, setPrivacyAgreed] = useState(false);

    // AWS Settings
    const [awsAccessKey, setAwsAccessKey] = useState('');
    const [awsSecretKey, setAwsSecretKey] = useState('');
    const [awsRegion, setAwsRegion] = useState('ap-southeast-2');
    const [awsBucket, setAwsBucket] = useState('fish-reid-images');
    const [showAwsSecretKey, setShowAwsSecretKey] = useState(false);

    // Load AWS settings on mount
    useEffect(() => {
        (window as any).api.getAWSSettings().then((settings: any) => {
            if (settings) {
                setAwsAccessKey(settings.accessKeyId || '');
                setAwsSecretKey(settings.secretAccessKey || '');
                setAwsRegion(settings.region || 'ap-southeast-2');
                setAwsBucket(settings.bucket || 'fish-reid-images');
            }
        });
    }, []);

    const saveAWSSetting = (key: string, value: string) => {
        (window as any).api.saveAWSSettings({ [key]: value });
    };

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newKey = e.target.value;
        setAiApiKey(newKey);
        saveAgentSettings({ apiKey: newKey });
    };

    const handleModelChange = (modelId: string) => {
        setAiModel(modelId);
        saveAgentSettings({ model: modelId });
    };

    const handleImageGenModelChange = (modelId: string) => {
        setImageGenModel(modelId);
        saveAgentSettings({ imageGenerationModel: modelId });
        // Reset resolution to 1K if switching to non-Pro model
        if (!modelId.includes('pro') && imageResolution !== '1K') {
            setImageResolution('1K');
            saveAgentSettings({ imageResolution: '1K' });
        }
    };

    const handleImageResolutionChange = (resolution: string) => {
        setImageResolution(resolution);
        saveAgentSettings({ imageResolution: resolution });
    };

    const handleAiToggle = (checked: boolean) => {
        if (checked) {
            setPrivacyDialogOpen(true);
            setPrivacyAgreed(false);
        } else {
            setAiEnabled(false);
            saveAgentSettings({ enabled: false });
            window.dispatchEvent(new Event('agentSettingsChanged'));
        }
    };

    const handlePrivacyConfirm = () => {
        if (privacyAgreed) {
            setAiEnabled(true);
            saveAgentSettings({ enabled: true, hasAgreedToTerms: true });
            setPrivacyDialogOpen(false);
            window.dispatchEvent(new Event('agentSettingsChanged'));
        }
    };

    const handlePrivacyCancel = () => {
        setPrivacyDialogOpen(false);
        setPrivacyAgreed(false);
    };

    // Load all settings from localStorage
    const [settings, setSettings] = useState<Record<string, any>>(() => {
        const initial: Record<string, any> = {};
        settingsItems.forEach(item => {
            const storageKey = `mediaExplorer_${item.key}`;
            const saved = localStorage.getItem(storageKey);
            if (saved !== null) {
                if (item.type === 'switch') {
                    initial[item.key] = saved === 'true';
                } else if (item.type === 'slider') {
                    initial[item.key] = parseInt(saved, 10);
                } else {
                    initial[item.key] = saved;
                }
            } else {
                initial[item.key] = item.defaultValue;
            }
        });
        return initial;
    });

    // Persist settings to localStorage
    useEffect(() => {
        Object.entries(settings).forEach(([key, value]) => {
            localStorage.setItem(`mediaExplorer_${key}`, value.toString());
        });
    }, [settings]);

    // Update a single setting
    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // Reset a single setting to default
    const resetSetting = (key: string) => {
        const item = settingsItems.find(i => i.key === key);
        if (item) {
            updateSetting(key, item.defaultValue);
        }
    };

    // Render a setting row based on its type
    const renderSettingRow = (item: SettingsItem) => {
        const value = settings[item.key];
        const isDisabled = item.key === 'useRayTracedGlass' && !settings['useLiquidGlass'];

        return (
            <TableRow key={item.key} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell sx={{ width: 50, pr: 1, borderBottom: 'none', opacity: isDisabled ? 0.5 : 1 }}>
                    {React.cloneElement(item.icon, { color: theme.palette.text.secondary })}
                </TableCell>
                <TableCell sx={{ borderBottom: 'none', opacity: isDisabled ? 0.5 : 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                        {item.label}
                    </Typography>
                    {item.description && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                            {item.description}
                        </Typography>
                    )}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none', minWidth: item.type === 'toggle' ? 280 : 120 }}>
                    {item.type === 'switch' && (
                        <StyledSwitch
                            checked={Boolean(value)}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting(item.key, e.target.checked)}
                            disabled={isDisabled}
                            inputProps={{ 'aria-label': `${item.label} toggle` }}
                        />
                    )}
                    {item.type === 'slider' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Slider
                                size="small"
                                value={value}
                                min={item.min}
                                max={item.max}
                                onChange={(_: Event, newValue: number | number[]) => updateSetting(item.key, newValue as number)}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(v: number) => `${v}px`}
                                sx={{ width: 150 }}
                            />
                            <Tooltip title="Reset to Default">
                                <IconButton size="small" onClick={() => resetSetting(item.key)}>
                                    <ArrowCounterClockwise size={14} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}
                    {item.type === 'toggle' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ToggleButtonGroup
                                value={value}
                                exclusive
                                onChange={(_: React.MouseEvent<HTMLElement>, newValue: string | null) => newValue && updateSetting(item.key, newValue)}
                                size="small"
                            >
                                {item.options?.map(opt => (
                                    <ToggleButton
                                        key={opt}
                                        value={opt}
                                        sx={{
                                            py: 0.5,
                                            px: 1.5,
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        {opt === '1.618/1' || opt === '1/1.618' ? 'Φ' : opt.replace('/', ':')}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                            <Tooltip title="Reset to Default">
                                <IconButton size="small" onClick={() => resetSetting(item.key)}>
                                    <ArrowCounterClockwise size={14} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}
                </TableCell>
            </TableRow>
        );
    };

    return (<>
        <Box sx={{ pt: '80px', minHeight: '100vh' }}>
            <Container maxWidth="md" sx={{ pb: 4 }}>
                {/* Page Title */}
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
                    Settings
                </Typography>

                {/* Theme Section */}
                <Accordion
                    defaultExpanded
                    disableGutters
                    square
                    elevation={0}
                    sx={{
                        mb: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2.5,
                        '&:before': { display: 'none' },
                        overflow: 'hidden',
                        bgcolor: hasGradient
                            ? (theme.palette.mode === 'dark' ? 'rgba(30, 30, 36, 0.75)' : 'rgba(247, 249, 251, 0.75)')
                            : 'background.paper',
                        backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                        WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    }}
                >
                    <AccordionSummary
                        expandIcon={<CaretDown size={20} />}
                        sx={{
                            px: 2,
                            minHeight: '56px',
                            '& .MuiAccordionSummary-content': {
                                my: '12px'
                            },
                            '&.Mui-expanded': {
                                minHeight: '56px',
                                borderBottom: `1px solid ${theme.palette.divider}`
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', pr: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PaintBrush size={20} />
                                <Typography variant="h6" fontWeight="600">
                                    Theme
                                </Typography>
                            </Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ mt: 0, lineHeight: 1.3, ml: 3.5 }}
                            >
                                Choose a color theme for the application
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2, px: 2, pb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {COLOR_THEMES.map((themeOption) => (
                                <Box key={themeOption.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                    <ThemeSwatch
                                        themeOption={themeOption}
                                        isSelected={colorTheme.id === themeOption.id}
                                        onClick={() => setColorTheme(themeOption.id)}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                        {themeOption.name}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* AI Agent Settings */}
                <Accordion
                    defaultExpanded
                    disableGutters
                    square
                    elevation={0}
                    sx={{
                        mb: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2.5,
                        '&:before': { display: 'none' },
                        overflow: 'hidden',
                        bgcolor: hasGradient
                            ? (theme.palette.mode === 'dark' ? 'rgba(30, 30, 36, 0.75)' : 'rgba(247, 249, 251, 0.75)')
                            : 'background.paper',
                        backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                        WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    }}
                >
                    <AccordionSummary
                        expandIcon={<CaretDown size={20} />}
                        sx={{
                            px: 2,
                            minHeight: '56px',
                            '& .MuiAccordionSummary-content': {
                                my: '12px'
                            },
                            '&.Mui-expanded': {
                                minHeight: '56px',
                                borderBottom: `1px solid ${theme.palette.divider}`
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', pr: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <OpenAiLogo size={20} />
                                <Typography variant="h6" fontWeight="600">
                                    AI Agent (Experimental)
                                </Typography>
                            </Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ mt: 0, lineHeight: 1.3, ml: 3.5 }}
                            >
                                Configure your Google AI Studio API key for the AI agent
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2, px: 2, pb: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* Enable/Disable Toggle */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                                <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                        Enable AI Agent
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {aiEnabled ? 'AI Agent is visible in the sidebar' : 'AI Agent is hidden from the sidebar'}
                                    </Typography>
                                </Box>
                                <StyledSwitch
                                    checked={aiEnabled}
                                    onChange={(e) => handleAiToggle(e.target.checked)}
                                />
                            </Box>
                            {/* API Key and Model Selection - only show when enabled */}
                            {aiEnabled && (
                                <>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                        <Key size={24} style={{ marginTop: 8 }} color={theme.palette.text.secondary} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                                                Google AI Studio API Key
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                Get your API key from{' '}
                                                <a
                                                    href="https://aistudio.google.com/app/api-keys"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: theme.palette.primary.main }}
                                                >
                                                    aistudio.google.com
                                                </a>
                                            </Typography>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                type={showApiKey ? 'text' : 'password'}
                                                value={aiApiKey}
                                                onChange={handleApiKeyChange}
                                                placeholder="AIza..."
                                                InputProps={{
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setShowApiKey(!showApiKey)}
                                                                edge="end"
                                                            >
                                                                <Eye size={18} weight={showApiKey ? 'fill' : 'regular'} />
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                    }
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                    {/* Model Selection */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mt: 1 }}>
                                        <OpenAiLogo size={24} style={{ marginTop: 8 }} color={theme.palette.text.secondary} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                                                AI Model
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                Select the Gemini model to use for the AI agent
                                            </Typography>
                                            <ToggleButtonGroup
                                                value={aiModel}
                                                exclusive
                                                onChange={(_, newValue: string | null) => newValue && handleModelChange(newValue)}
                                                size="small"
                                                sx={{ flexWrap: 'wrap' }}
                                            >
                                                {AVAILABLE_MODELS.map(model => (
                                                    <ToggleButton
                                                        key={model.id}
                                                        value={model.id}
                                                        sx={{
                                                            py: 0.75,
                                                            px: 2,
                                                            fontSize: '0.8rem',
                                                            textTransform: 'none',
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                            <Typography variant="body2" fontWeight={500}>{model.name}</Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                                {model.description}
                                                            </Typography>
                                                        </Box>
                                                    </ToggleButton>
                                                ))}
                                            </ToggleButtonGroup>
                                        </Box>
                                    </Box>

                                    {/* Image Generation Model Selection */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                                        <ImageIcon size={24} style={{ marginTop: 8 }} color={theme.palette.text.secondary} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                                                Image Generation Model
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                                Model used for generating and editing images
                                            </Typography>
                                            <ToggleButtonGroup
                                                value={imageGenModel}
                                                exclusive
                                                onChange={(_, newValue: string | null) => newValue && handleImageGenModelChange(newValue)}
                                                size="small"
                                                sx={{ flexWrap: 'wrap' }}
                                            >
                                                {IMAGE_GENERATION_MODELS.map(model => (
                                                    <ToggleButton
                                                        key={model.id}
                                                        value={model.id}
                                                        sx={{
                                                            py: 0.75,
                                                            px: 2,
                                                            fontSize: '0.8rem',
                                                            textTransform: 'none',
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                            <Typography variant="body2" fontWeight={500}>{model.name}</Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                                {model.description}
                                                            </Typography>
                                                        </Box>
                                                    </ToggleButton>
                                                ))}
                                            </ToggleButtonGroup>
                                        </Box>
                                    </Box>

                                    {/* Image Resolution Selection (only for Pro model) */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mt: 1 }}>
                                        <Box sx={{ width: 24 }} /> {/* Spacer for alignment */}
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5, opacity: imageGenModel.includes('pro') ? 1 : 0.5 }}>
                                                Output Resolution
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, opacity: imageGenModel.includes('pro') ? 1 : 0.5 }}>
                                                {imageGenModel.includes('pro') ? 'Higher resolutions take longer to generate' : 'Only available with Nano Banana Pro'}
                                            </Typography>
                                            <ToggleButtonGroup
                                                value={imageResolution}
                                                exclusive
                                                onChange={(_, newValue: string | null) => newValue && handleImageResolutionChange(newValue)}
                                                size="small"
                                                disabled={!imageGenModel.includes('pro')}
                                            >
                                                {IMAGE_RESOLUTIONS.map(res => (
                                                    <ToggleButton
                                                        key={res.id}
                                                        value={res.id}
                                                        disabled={!imageGenModel.includes('pro') && res.id !== '1K'}
                                                        sx={{
                                                            py: 0.5,
                                                            px: 2,
                                                            fontSize: '0.8rem',
                                                            textTransform: 'none',
                                                        }}
                                                    >
                                                        {res.name}
                                                    </ToggleButton>
                                                ))}
                                            </ToggleButtonGroup>
                                        </Box>
                                    </Box>
                                </>
                            )}
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* AWS Cloud Storage Settings */}
                <Accordion
                    disableGutters
                    square
                    elevation={0}
                    sx={{
                        mb: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2.5,
                        '&:before': { display: 'none' },
                        overflow: 'hidden',
                        bgcolor: hasGradient
                            ? (theme.palette.mode === 'dark' ? 'rgba(30, 30, 36, 0.75)' : 'rgba(247, 249, 251, 0.75)')
                            : 'background.paper',
                        backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                        WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    }}
                >
                    <AccordionSummary
                        expandIcon={<CaretDown size={20} />}
                        sx={{
                            px: 2,
                            minHeight: '56px',
                            '& .MuiAccordionSummary-content': {
                                my: '12px'
                            },
                            '&.Mui-expanded': {
                                minHeight: '56px',
                                borderBottom: `1px solid ${theme.palette.divider}`
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', pr: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Cloud size={20} />
                                <Typography variant="h6" fontWeight="600">
                                    AWS Cloud Storage
                                </Typography>
                            </Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ mt: 0, lineHeight: 1.3, ml: 3.5 }}
                            >
                                Configure S3 bucket for image uploads (optional - falls back to system credentials)
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2, px: 2, pb: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* Access Key ID */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Key size={24} style={{ marginTop: 8 }} color={theme.palette.text.secondary} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                                        Access Key ID
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                        Leave empty to use system credentials
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        value={awsAccessKey}
                                        onChange={(e) => {
                                            setAwsAccessKey(e.target.value);
                                            saveAWSSetting('accessKeyId', e.target.value);
                                        }}
                                        placeholder="AKIAIOSFODNN7EXAMPLE"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2,
                                            }
                                        }}
                                    />
                                </Box>
                            </Box>
                            {/* Secret Access Key */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ width: 24 }} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                                        Secret Access Key
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type={showAwsSecretKey ? 'text' : 'password'}
                                        value={awsSecretKey}
                                        onChange={(e) => {
                                            setAwsSecretKey(e.target.value);
                                            saveAWSSetting('secretAccessKey', e.target.value);
                                        }}
                                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setShowAwsSecretKey(!showAwsSecretKey)}
                                                        edge="end"
                                                    >
                                                        <Eye size={18} weight={showAwsSecretKey ? 'fill' : 'regular'} />
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2,
                                            }
                                        }}
                                    />
                                </Box>
                            </Box>
                            {/* Region */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ width: 24 }} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                                        Region
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        value={awsRegion}
                                        onChange={(e) => {
                                            setAwsRegion(e.target.value);
                                            saveAWSSetting('region', e.target.value);
                                        }}
                                        placeholder="ap-southeast-2"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2,
                                            }
                                        }}
                                    />
                                </Box>
                            </Box>
                            {/* Bucket */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ width: 24 }} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                                        S3 Bucket
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        value={awsBucket}
                                        onChange={(e) => {
                                            setAwsBucket(e.target.value);
                                            saveAWSSetting('bucket', e.target.value);
                                        }}
                                        placeholder="my-bucket-name"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2,
                                            }
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                {/* Settings Sections */}
                {sections.map(({ id, title, description }) => (
                    <Accordion
                        key={id}
                        defaultExpanded
                        disableGutters
                        square
                        elevation={0}
                        sx={{
                            mb: 2,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2.5,
                            '&:before': { display: 'none' },
                            overflow: 'hidden',
                            bgcolor: hasGradient
                                ? (theme.palette.mode === 'dark' ? 'rgba(30, 30, 36, 0.75)' : 'rgba(247, 249, 251, 0.75)')
                                : 'background.paper',
                            backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                            WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<CaretDown size={20} />}
                            sx={{
                                px: 2,
                                minHeight: '56px',
                                '& .MuiAccordionSummary-content': {
                                    my: '12px'
                                },
                                '&.Mui-expanded': {
                                    minHeight: '56px',
                                    borderBottom: `1px solid ${theme.palette.divider}`
                                }
                            }}
                        >
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', pr: 1 }}>
                                <Typography variant="h6" fontWeight="600">
                                    {title}
                                </Typography>
                                {description && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ mt: 0, lineHeight: 1.3 }}
                                    >
                                        {description}
                                    </Typography>
                                )}
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 1, px: 2, pb: 2 }}>
                            <TableContainer>
                                <Table>
                                    <TableBody>
                                        {settingsItems
                                            .filter(item => item.section === id)
                                            .map(renderSettingRow)}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </AccordionDetails>
                    </Accordion>
                ))}

                {/* Reset Onboarding Tours */}
                <Box
                    sx={{
                        mt: 3,
                        p: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: hasGradient
                            ? (theme.palette.mode === 'dark' ? 'rgba(30, 30, 36, 0.75)' : 'rgba(247, 249, 251, 0.75)')
                            : 'transparent',
                        backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                        WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Lightbulb size={24} />
                        <Box>
                            <Typography variant="body1" fontWeight={500}>Reset Guided Tours</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Show the onboarding walkthrough again for all pages
                            </Typography>
                        </Box>
                    </Box>
                    <Tooltip title="Reset Tours">
                        <IconButton
                            onClick={() => {
                                resetAllTours();
                                alert('Tours have been reset! You will see them again when visiting each page.');
                            }}
                            sx={{
                                bgcolor: theme.palette.action.hover,
                                '&:hover': { bgcolor: theme.palette.action.selected }
                            }}
                        >
                            <ArrowCounterClockwise size={20} />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Clear Embeddings Cache */}
                <Box
                    sx={{
                        mt: 2,
                        p: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: hasGradient
                            ? (theme.palette.mode === 'dark' ? 'rgba(30, 30, 36, 0.75)' : 'rgba(247, 249, 251, 0.75)')
                            : 'transparent',
                        backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                        WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Cube size={24} />
                        <Box>
                            <Typography variant="body1" fontWeight={500}>Clear Embeddings Cache</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Remove cached AI embeddings to free disk space. Classification and Re-ID will take longer after clearing.
                            </Typography>
                        </Box>
                    </Box>
                    <Tooltip title="Clear Cache">
                        <IconButton
                            onClick={async () => {
                                if (confirm('Are you sure you want to clear all cached embeddings? This cannot be undone and Classification/Re-ID jobs will take longer.')) {
                                    const result = await window.api.clearEmbeddingsCache();
                                    if (result.ok) {
                                        alert(`Cleared ${result.count} cached embeddings.`);
                                    } else {
                                        alert('Failed to clear cache: ' + result.error);
                                    }
                                }
                            }}
                            sx={{
                                bgcolor: theme.palette.action.hover,
                                '&:hover': { bgcolor: theme.palette.error.main, color: 'white' }
                            }}
                        >
                            <Trash size={20} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Container>
        </Box>

        {/* Privacy Agreement Dialog */}
        <Dialog open={privacyDialogOpen} onClose={handlePrivacyCancel} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning size={24} color={theme.palette.warning.main} />
                AI Agent Data Privacy Notice
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        By enabling the AI Agent, you acknowledge and agree to the following:
                    </Typography>

                    <Box sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), p: 2, borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                            ⚠️ Data Privacy
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Your data (including image metadata and database information) may be sent to Google's servers for processing by Gemini AI models. Google may use this data according to their privacy policy. Later we might introduce NZ hosted AI models, but Gemini will be used during development.
                        </Typography>
                    </Box>

                    <Box sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), p: 2, borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                            🤖 AI Limitations
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            AI responses may contain errors or inaccuracies. Always verify AI-generated outputs before relying on them for important decisions.
                        </Typography>
                    </Box>

                    <Box sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), p: 2, borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                            📋 Disclaimer
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            The AI models are developed by Google. We are not responsible for any data privacy issues, AI errors, or consequences arising from the use of the AI Agent feature. This is an experimental feature, please do not use it if you are not comfortable with the risks involved, and by proceeding, you acknowledge and accept all risks (including data privacy issues) associated with the use of this feature.
                        </Typography>
                    </Box>

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={privacyAgreed}
                                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                                color="primary"
                            />
                        }
                        label={
                            <Typography variant="body2" fontWeight="medium">
                                I understand and agree to the above terms (In particular, data privacy and AI risks. Do not use this feature if you have any concerns.)
                            </Typography>
                        }
                        sx={{ mt: 1 }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handlePrivacyCancel} color="inherit">
                    Cancel
                </Button>
                <Button
                    onClick={handlePrivacyConfirm}
                    variant="contained"
                    disabled={!privacyAgreed}
                >
                    Enable AI Agent
                </Button>
            </DialogActions>
        </Dialog>
    </>);
};

export default SettingsPage;
