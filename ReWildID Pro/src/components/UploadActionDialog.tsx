import React, { useState, useEffect } from 'react';
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    IconButton,
    alpha,
    useTheme,
    Divider,
    Autocomplete,
    TextField,
    Button
} from '@mui/material';
import { X, Sparkle, Fingerprint, FolderOpen, CaretRight, Images } from '@phosphor-icons/react';
import { ACTIVE_SPECIES, FUTURE_SPECIES, DEFAULT_SPECIES } from '../constants/species';

interface UploadActionDialogProps {
    open: boolean;
    onClose: () => void;
    filePaths: string[];
    onConfirm: (action: 'library' | 'classify' | 'reid', groupName?: string, species?: string) => void;
}

type ActionType = 'library' | 'classify' | 'reid';

export const UploadActionDialog: React.FC<UploadActionDialogProps> = ({
    open,
    onClose,
    filePaths,
    onConfirm
}) => {
    const theme = useTheme();
    const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
    const [selectedSpecies, setSelectedSpecies] = useState<string>(DEFAULT_SPECIES);
    const [groupName, setGroupName] = useState<string>('');
    const [isChecking, setIsChecking] = useState(true);

    // Always suggest a group name - from folder name or parent folder
    useEffect(() => {
        if (open && filePaths.length > 0) {
            setIsChecking(true);
            Promise.all(filePaths.map(path => window.api.checkIsDirectory(path)))
                .then(results => {
                    const allDirs = results.every(isDir => isDir);
                    const firstPath = filePaths[0];
                    const parts = firstPath.split(/[/\\]/);

                    if (allDirs) {
                        // For folders, use the folder name itself
                        const folderName = parts[parts.length - 1] || 'Untitled';
                        setGroupName(folderName);
                    } else {
                        // For loose files, use parent folder name
                        const parentFolder = parts[parts.length - 2] || 'Untitled';
                        setGroupName(parentFolder);
                    }
                    setIsChecking(false);
                })
                .catch(() => {
                    setGroupName('Untitled');
                    setIsChecking(false);
                });
        }
    }, [open, filePaths]);

    // Group species options
    const speciesOptions = [
        ...ACTIVE_SPECIES.map(s => ({ species: s, group: 'Available', disabled: false })),
        ...FUTURE_SPECIES.map(s => ({ species: s, group: 'Coming Soon', disabled: true }))
    ];

    const handleClose = () => {
        onClose();
        setSelectedAction(null);
        setSelectedSpecies(DEFAULT_SPECIES);
        setGroupName('');
    };

    const handleActionSelect = (action: ActionType) => {
        if (action === 'reid') {
            // ReID needs species selection - go to second step
            setSelectedAction('reid');
        } else {
            // Library and Classify can submit directly
            onConfirm(action, groupName.trim() || undefined);
            handleClose();
        }
    };

    const handleSubmit = () => {
        if (selectedAction === 'reid') {
            onConfirm('reid', groupName.trim() || undefined, selectedSpecies);
        }
        handleClose();
    };

    const getActionIcon = (action: ActionType) => {
        switch (action) {
            case 'library': return <FolderOpen size={24} weight="fill" />;
            case 'classify': return <Sparkle size={24} weight="fill" />;
            case 'reid': return <Fingerprint size={24} weight="fill" />;
        }
    };

    const getActionTitle = (action: ActionType) => {
        switch (action) {
            case 'library': return '添加到图库';
            case 'classify': return '上传并分类';
            case 'reid': return '上传并鉴别';
        }
    };

    const ActionOption = ({ action, title, description }: { action: ActionType; title: string; description: string }) => (
        <Box
            onClick={() => handleActionSelect(action)}
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
                {getActionIcon(action)}
            </Box>
            <Box sx={{ flex: 1 }}>
                <Typography fontWeight={600}>{title}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {description}
                </Typography>
            </Box>
            <CaretRight size={20} color={theme.palette.text.secondary} />
        </Box>
    );

    // Loading state
    if (isChecking) {
        return (
            <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
                <DialogContent sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">准备上传...</Typography>
                </DialogContent>
            </Dialog>
        );
    }

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
                    <Images size={24} weight="duotone" />
                    <Typography variant="h6" fontWeight={600}>
                        {selectedAction ? getActionTitle(selectedAction) : '上传图片'}
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <X />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {filePaths.length} 项已准备好上传
                </Typography>

                {!selectedAction ? (
                    // Step 1: Group name + Choose action
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Group Name Input - always show */}
                        <TextField
                            fullWidth
                            size="small"
                            label="组名"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="输入该组的名称"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                }
                            }}
                        />

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <ActionOption
                                action="library"
                                title="添加到图库"
                                description="上传而不运行AI分析"
                            />
                            <ActionOption
                                action="classify"
                                title="上传并分类"
                                description="在图片中检测和分类动物"
                            />
                            <ActionOption
                                action="reid"
                                title="上传并鉴别"
                                description="跨图片匹配个体"
                            />
                        </Box>
                    </Box>
                ) : (
                    // Step 2: Species selection (only for ReID)
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                                        border: `1px solid ${theme.palette.divider}`,
                                        '& .MuiAutocomplete-option': {
                                            borderRadius: 1,
                                            mx: 0.5,
                                            my: 0.25,
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
                            <Button
                                variant="text"
                                onClick={() => setSelectedAction(null)}
                                sx={{
                                    borderRadius: 2,
                                    color: theme.palette.text.secondary
                                }}
                            >
                                返回
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSubmit}
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
                                上传并鉴别
                            </Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};
