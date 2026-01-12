import React, { useState } from 'react';
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    IconButton,
    alpha,
    useTheme,
    Button,
    Divider,
    Autocomplete,
    TextField
} from '@mui/material';
import { X, Sparkle, Fingerprint } from '@phosphor-icons/react';
import { ACTIVE_SPECIES, FUTURE_SPECIES, DEFAULT_SPECIES } from '../../constants/species';

interface AnalyseMenuProps {
    open: boolean;
    onClose: () => void;
    onClassify?: () => void;
    onReID: (species: string) => void;
    availableSpecies?: string[]; // Optional - will use static list if not provided
    selectedCount: number;
    reidOnly?: boolean; // If true, skip to species selection directly
    title?: string; // Custom title
}

export const AnalyseMenu: React.FC<AnalyseMenuProps> = ({
    open,
    onClose,
    onClassify,
    onReID,
    availableSpecies: _availableSpecies, // Reserved for future dynamic species list
    selectedCount,
    reidOnly = false,
    title = 'Analyse'
}) => {
    const theme = useTheme();
    const [selectedSpecies, setSelectedSpecies] = useState<string>(DEFAULT_SPECIES);
    const [showReIDOptions, setShowReIDOptions] = useState(reidOnly);

    // Group species: active ones first, then future ones (greyed out)
    const speciesOptions = [
        ...ACTIVE_SPECIES.map(s => ({ species: s, group: 'Available', disabled: false })),
        ...FUTURE_SPECIES.map(s => ({ species: s, group: 'Coming Soon', disabled: true }))
    ];

    const handleClassify = () => {
        if (onClassify) onClassify();
        onClose();
    };

    const handleReID = () => {
        if (selectedSpecies) {
            onReID(selectedSpecies);
            onClose();
            setShowReIDOptions(false);
            setSelectedSpecies(DEFAULT_SPECIES);
        }
    };

    const handleClose = () => {
        onClose();
        setShowReIDOptions(reidOnly); // Reset to initial state
        setSelectedSpecies(DEFAULT_SPECIES);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: theme.palette.mode === 'light'
                        ? alpha('#FFFFFF', 0.85)
                        : alpha(theme.palette.background.paper, 0.85),
                    backdropFilter: 'blur(20px)',
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                    boxShadow: theme.palette.mode === 'light'
                        ? '0 8px 32px rgba(0, 0, 0, 0.12)'
                        : '0 8px 32px rgba(0, 0, 0, 0.4)',
                    overflow: 'hidden'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {reidOnly ? <Fingerprint size={24} weight="duotone" /> : <Sparkle size={24} weight="duotone" />}
                    <Typography variant="h6" fontWeight={600}>
                        {title}
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <X />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    {selectedCount} 张图片已选择
                </Typography>

                {!showReIDOptions ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* Classification Option */}
                        <Box
                            onClick={handleClassify}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 2,
                                borderRadius: 2,
                                cursor: 'pointer',
                                bgcolor: theme.palette.mode === 'light'
                                    ? alpha('#000000', 0.04)
                                    : alpha('#FFFFFF', 0.06),
                                border: `1px solid ${theme.palette.divider}`,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'light'
                                        ? alpha('#000000', 0.08)
                                        : alpha('#FFFFFF', 0.10),
                                    transform: 'translateY(-1px)',
                                    boxShadow: theme.palette.mode === 'light'
                                        ? '0 4px 12px rgba(0, 0, 0, 0.1)'
                                        : '0 4px 12px rgba(0, 0, 0, 0.3)'
                                }
                            }}
                        >
                            <Box sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: theme.palette.mode === 'light'
                                    ? alpha('#000000', 0.08)
                                    : alpha('#FFFFFF', 0.12),
                                color: theme.palette.text.primary
                            }}>
                                <Sparkle size={24} weight="fill" />
                            </Box>
                            <Box>
                                <Typography fontWeight={600}>分类</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    在图片中检测和分类动物
                                </Typography>
                            </Box>
                        </Box>

                        {/* Re-identification Option */}
                        <Box
                            onClick={() => setShowReIDOptions(true)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 2,
                                borderRadius: 2,
                                cursor: 'pointer',
                                bgcolor: theme.palette.mode === 'light'
                                    ? alpha('#000000', 0.04)
                                    : alpha('#FFFFFF', 0.06),
                                border: `1px solid ${theme.palette.divider}`,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'light'
                                        ? alpha('#000000', 0.08)
                                        : alpha('#FFFFFF', 0.10),
                                    transform: 'translateY(-1px)',
                                    boxShadow: theme.palette.mode === 'light'
                                        ? '0 4px 12px rgba(0, 0, 0, 0.1)'
                                        : '0 4px 12px rgba(0, 0, 0, 0.3)'
                                }
                            }}
                        >
                            <Box sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: theme.palette.mode === 'light'
                                    ? alpha('#000000', 0.08)
                                    : alpha('#FFFFFF', 0.12),
                                color: theme.palette.text.primary
                            }}>
                                <Fingerprint size={24} weight="fill" />
                            </Box>
                            <Box>
                                <Typography fontWeight={600}>个体鉴别</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    跨图片匹配个体
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                            <Fingerprint size={20} weight="fill" color={theme.palette.text.primary} />
                            <Typography fontWeight={600}>个体鉴别</Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            选择物种以识别个体
                        </Typography>

                        <Autocomplete
                            fullWidth
                            size="small"
                            options={speciesOptions}
                            groupBy={(option) => option.group}
                            getOptionLabel={(option) => option.species.charAt(0).toUpperCase() + option.species.slice(1)}
                            getOptionDisabled={(option) => option.disabled}
                            value={speciesOptions.find(o => o.species === selectedSpecies) || null}
                            onChange={(_, newValue) => setSelectedSpecies(newValue?.species || '')}
                            isOptionEqualToValue={(option, value) => option.species === value.species}
                            noOptionsText="没有可用的物种"
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="物种"
                                    placeholder="输入搜索..."
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: theme.palette.divider
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: theme.palette.text.secondary
                                            }
                                        }
                                    }}
                                />
                            )}
                            renderGroup={(params) => (
                                <li key={params.key}>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            display: 'block',
                                            px: 1.5,
                                            pt: 1.5,
                                            pb: 0.5,
                                            color: 'text.secondary',
                                        }}
                                    >
                                        {params.group}
                                    </Typography>
                                    <ul style={{ padding: 0 }}>{params.children}</ul>
                                </li>
                            )}
                            slotProps={{
                                paper: {
                                    sx: {
                                        borderRadius: 2,
                                        mt: 0.5,
                                        bgcolor: theme.palette.mode === 'light'
                                            ? 'rgba(255, 255, 255, 0.95)'
                                            : 'rgba(40, 40, 40, 0.95)',
                                        backdropFilter: 'blur(10px)',
                                        boxShadow: theme.palette.mode === 'light'
                                            ? '0 4px 20px rgba(0, 0, 0, 0.15)'
                                            : '0 4px 20px rgba(0, 0, 0, 0.4)',
                                        border: `1px solid ${theme.palette.divider}`,
                                        '& .MuiAutocomplete-option': {
                                            borderRadius: 1,
                                            mx: 0.5,
                                            my: 0.25,
                                            '&:hover': {
                                                bgcolor: theme.palette.mode === 'light'
                                                    ? alpha('#000000', 0.06)
                                                    : alpha('#FFFFFF', 0.08)
                                            },
                                            '&[aria-selected="true"]': {
                                                bgcolor: theme.palette.mode === 'light'
                                                    ? alpha('#000000', 0.08)
                                                    : alpha('#FFFFFF', 0.12),
                                                '&:hover': {
                                                    bgcolor: theme.palette.mode === 'light'
                                                        ? alpha('#000000', 0.10)
                                                        : alpha('#FFFFFF', 0.15)
                                                }
                                            },
                                            '&.Mui-disabled': {
                                                opacity: 1,
                                                color: theme.palette.text.disabled
                                            }
                                        }
                                    }
                                }
                            }}
                        />

                        <Divider sx={{ my: 1 }} />

                        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                            {!reidOnly && (
                                <Button
                                    variant="text"
                                    onClick={() => setShowReIDOptions(false)}
                                    sx={{
                                        borderRadius: 2,
                                        color: theme.palette.text.secondary
                                    }}
                                >
                                    返回
                                </Button>
                            )}
                            <Button
                                variant="contained"
                                onClick={handleReID}
                                disabled={!selectedSpecies}
                                startIcon={<Fingerprint size={18} />}
                                sx={{
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    bgcolor: theme.palette.mode === 'light' ? '#000000' : '#FFFFFF',
                                    color: theme.palette.mode === 'light' ? '#FFFFFF' : '#000000',
                                    '&:hover': {
                                        bgcolor: theme.palette.mode === 'light' ? '#333333' : '#E0E0E0'
                                    },
                                    '&.Mui-disabled': {
                                        bgcolor: theme.palette.mode === 'light'
                                            ? alpha('#000000', 0.3)
                                            : alpha('#FFFFFF', 0.3),
                                        color: theme.palette.mode === 'light'
                                            ? alpha('#FFFFFF', 0.5)
                                            : alpha('#000000', 0.5)
                                    }
                                }}
                            >
                                开始个体鉴别
                            </Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};
