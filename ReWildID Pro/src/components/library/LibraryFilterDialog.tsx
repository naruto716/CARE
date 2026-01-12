import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    Button,
    Box,
    Typography,
    List,
    ListItemButton,
    ListItemText,
    Checkbox,
    useTheme,
    IconButton,
    alpha,
    Link,
    Autocomplete,
    TextField,
    Chip,
    Slider
} from '@mui/material';
import { X, CheckCircle, Circle } from '@phosphor-icons/react';
import { DateSection } from '../../types/library';

export interface LibraryFilter {
    date: string | null;
    groupIds: Set<number> | null; // null means all
    species?: string[];
    minConfidence?: number;
}

interface LibraryFilterDialogProps {
    open: boolean;
    onClose: () => void;
    dateSections: DateSection[];
    currentFilter: LibraryFilter | null;
    onApply: (filter: LibraryFilter | null) => void;
    availableSpecies?: string[];
}

export const LibraryFilterDialog: React.FC<LibraryFilterDialogProps> = ({
    open,
    onClose,
    dateSections,
    currentFilter,
    onApply,
    availableSpecies
}) => {
    const theme = useTheme();

    // Local state for the dialog
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number> | null>(null);
    const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
    const [minConfidence, setMinConfidence] = useState<number>(0);

    // Initialize state when opening
    useEffect(() => {
        if (open) {
            if (currentFilter && currentFilter.date) {
                setSelectedDate(currentFilter.date);
                setSelectedGroupIds(currentFilter.groupIds ? new Set(currentFilter.groupIds) : null);
                setSelectedSpecies(currentFilter.species || []);
                setMinConfidence(currentFilter.minConfidence || 0);
            } else {
                setSelectedDate(null);
                setSelectedGroupIds(new Set());
                setSelectedSpecies([]);
                setMinConfidence(0);
            }
        }
    }, [open, currentFilter, dateSections]);

    // When date changes, reset groups to "none" (empty set)
    const handleDateClick = (date: string) => {
        if (date !== selectedDate) {
            setSelectedDate(date);
            setSelectedGroupIds(new Set());
        }
    };

    // Get groups for current selected date
    const currentGroups = useMemo(() => {
        if (!selectedDate) return [];
        const section = dateSections.find(s => s.date === selectedDate);
        return section ? section.groups : [];
    }, [selectedDate, dateSections]);

    // Helpers for group selection
    const isGroupSelected = (id: number) => {
        if (selectedGroupIds === null) return true;
        return selectedGroupIds.has(id);
    };

    const handleGroupToggle = (id: number) => {
        let newSet: Set<number>;
        if (selectedGroupIds === null) {
            newSet = new Set(currentGroups.map(g => g.id));
            newSet.delete(id);
            setSelectedGroupIds(newSet);
        } else {
            newSet = new Set(selectedGroupIds);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }

            if (currentGroups.length > 0 && currentGroups.every(g => newSet.has(g.id))) {
                setSelectedGroupIds(null);
            } else {
                setSelectedGroupIds(newSet);
            }
        }
    };

    const handleSelectAllToggle = () => {
        if (selectedGroupIds === null) {
            setSelectedGroupIds(new Set());
        } else {
            setSelectedGroupIds(null);
        }
    };

    const handleApply = () => {
        onApply({
            date: selectedDate,
            groupIds: selectedGroupIds,
            species: selectedSpecies.length > 0 ? selectedSpecies : undefined,
            minConfidence: minConfidence > 0 ? minConfidence : undefined
        });
        onClose();
    };

    const handleClear = () => {
        onApply(null);
        onClose();
    };

    const formatDate = (dateStr: string) => {
        if (dateStr.length !== 8) return dateStr;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const isAllGroupsSelected = selectedGroupIds === null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    height: '650px',
                    bgcolor: theme.palette.background.paper,
                    backgroundImage: 'none',
                    boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)',
                    border: `1px solid ${theme.palette.divider}`,
                    overflow: 'hidden'
                }
            }}
            BackdropProps={{
                sx: { backdropFilter: 'blur(4px)', bgcolor: 'rgba(0,0,0,0.5)' }
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <Box sx={{
                    p: 3,
                    pb: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Box>
                        <Typography variant="h5" fontWeight="700" sx={{ lineHeight: 1.2 }}>筛选图库</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>选择日期和组来筛选您的视图（旧版支持）</Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary', bgcolor: theme.palette.action.hover }}><X /></IconButton>
                </Box>

                {/* Content Body */}
                <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', mt: 1, gap: 2, px: 3 }}>
                    {/* Dates Sidebar */}
                    <Box sx={{
                        width: '32%',
                        display: 'flex',
                        flexDirection: 'column',
                        bgcolor: alpha(theme.palette.background.default, 0.5),
                        borderRadius: 4,
                        overflow: 'hidden',
                        mb: 2
                    }}>
                        <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ p: 2, pb: 1, display: 'block', letterSpacing: 1 }}>
                            日期
                        </Typography>
                        <List disablePadding sx={{ overflowY: 'auto', flex: 1, px: 1, pb: 1 }}>
                            {dateSections.map(section => {
                                const isSelected = section.date === selectedDate;
                                return (
                                    <ListItemButton
                                        key={section.date}
                                        selected={isSelected}
                                        onClick={() => handleDateClick(section.date)}
                                        sx={{
                                            borderRadius: 3,
                                            mb: 0.5,
                                            py: 1.5,
                                            px: 2,
                                            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                            color: isSelected ? 'primary.main' : 'text.primary',
                                            transition: 'all 0.2s',
                                            '&.Mui-selected': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                                            },
                                            '&:hover': {
                                                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : theme.palette.action.hover,
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography variant="body1" fontWeight={isSelected ? 500 : 400}>
                                                    {formatDate(section.date)}
                                                </Typography>
                                                {isSelected && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />}
                                            </Box>
                                            <Typography variant="caption" color={isSelected ? alpha(theme.palette.primary.main, 0.8) : "text.secondary"}>
                                                {section.groups.reduce((acc, g) => acc + g.images.length, 0)} 张图片
                                            </Typography>
                                        </Box>
                                    </ListItemButton>
                                );
                            })}
                        </List>
                    </Box>

                    {/* Groups List */}
                    <Box sx={{ width: '68%', display: 'flex', flexDirection: 'column', pb: 2 }}>
                        {/* Groups Header */}
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            minHeight: '40px',
                            mb: 1,
                            px: 1
                        }}>
                            <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ letterSpacing: 1 }}>
                                组
                            </Typography>

                            {selectedDate && (
                                <Link
                                    component="button"
                                    variant="caption"
                                    fontWeight="600"
                                    onClick={handleSelectAllToggle}
                                    underline="hover"
                                    sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                >
                                    {isAllGroupsSelected ? "取消全选" : "全选"}
                                </Link>
                            )}
                        </Box>

                        <Box sx={{ flex: 1, overflowY: 'auto', borderRadius: 4 }}>
                            {!selectedDate ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                                    <Typography variant="body1" fontWeight="500">未选择日期</Typography>
                                    <Typography variant="caption">从左侧选择日期以查看组</Typography>
                                </Box>
                            ) : currentGroups.length === 0 ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                                    <Typography variant="body2">此日期没有可用的组</Typography>
                                </Box>
                            ) : (
                                <List disablePadding sx={{ p: 1 }}>
                                    {currentGroups.map(group => {
                                        const isSelected = isGroupSelected(group.id);
                                        return (
                                            <ListItemButton
                                                key={group.id}
                                                onClick={() => handleGroupToggle(group.id)}
                                                disableRipple
                                                sx={{
                                                    borderRadius: 3,
                                                    mb: 0.5,
                                                    py: 1.5,
                                                    px: 2,
                                                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                                                    transition: 'all 0.1s ease-in-out',
                                                    '&:hover': {
                                                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.action.hover
                                                    }
                                                }}
                                            >
                                                <Checkbox
                                                    icon={<Circle size={20} weight="regular" color={theme.palette.text.secondary} />}
                                                    checkedIcon={<CheckCircle size={20} weight="fill" color={theme.palette.primary.main} />}
                                                    edge="start"
                                                    checked={isSelected}
                                                    tabIndex={-1}
                                                    disableRipple
                                                    size="small"
                                                    sx={{ mr: 1.5, p: 0 }}
                                                />
                                                <ListItemText
                                                    primary={group.name}
                                                    secondary={`${group.images.length} 张图片`}
                                                    primaryTypographyProps={{ fontWeight: 400, fontSize: '0.95rem', color: isSelected ? 'primary.main' : 'text.primary' }}
                                                    secondaryTypographyProps={{ fontSize: '0.8rem' }}
                                                />
                                            </ListItemButton>
                                        );
                                    })}
                                </List>
                            )}
                        </Box>

                        {/* Species - Only for detection page */}
                        {availableSpecies && (
                            <Box sx={{ mt: 3, px: 1 }}>
                                <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ mb: 1.5, display: 'block', letterSpacing: 1 }}>
                                    物种
                                </Typography>
                                <Autocomplete
                                    multiple
                                    size="small"
                                    options={availableSpecies}
                                    value={selectedSpecies}
                                    onChange={(_, newValue) => setSelectedSpecies(newValue)}
                                    renderInput={(params) => (
                                        <TextField {...params} placeholder="选择物种..." size="small" />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => {
                                            const { key, ...tagProps } = getTagProps({ index });
                                            return <Chip key={key} label={option} size="small" {...tagProps} />;
                                        })
                                    }
                                />
                            </Box>
                        )}

                        {/* Confidence - Only for detection page */}
                        {availableSpecies && (
                            <Box sx={{ mt: 3, px: 1 }}>
                                <Typography variant="caption" fontWeight="700" color="text.secondary" sx={{ mb: 1, display: 'block', letterSpacing: 1 }}>
                                    最低置信度: {Math.round(minConfidence * 100)}%
                                </Typography>
                                <Slider
                                    value={minConfidence}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    onChange={(_: Event, val: number | number[]) => setMinConfidence(val as number)}
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(val: number) => `${Math.round(val * 100)}%`}
                                />
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* Footer */}
                <Box sx={{
                    p: 3,
                    pt: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                }}>
                    <Button
                        onClick={handleClear}
                        color="error"
                        sx={{ textTransform: 'none', borderRadius: 2, px: 2, fontWeight: 600 }}
                    >
                        重置
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button
                            onClick={onClose}
                            color="inherit"
                            sx={{ textTransform: 'none', borderRadius: 2, px: 2, fontWeight: 600, color: 'text.secondary' }}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleApply}
                            variant="contained"
                            color="primary"
                            disableElevation
                            sx={{ textTransform: 'none', borderRadius: 2, px: 4, fontWeight: 600 }}
                        >
                            应用筛选
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
};
