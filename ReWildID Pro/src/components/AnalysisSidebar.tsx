import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, IconButton, TextField, Collapse, Chip, alpha, useTheme, Table, TableBody, TableRow, TableCell
} from '@mui/material';
import {
    CaretDown, CaretRight, Tag, BoundingBox, Fingerprint, Trash, Plus, Check
} from '@phosphor-icons/react';
import { translateSpecies } from '../constants/species';

interface DetectionResult {
    id: number;
    label: string;
    confidence: number;
    detection_confidence: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface ReidResult {
    runId: number;
    runName: string;
    species: string;
    individualId: number;
    individualName: string;
    individualDisplayName: string;
    individualColor: string;
    detectionId: number;
}

interface AnalysisSidebarProps {
    imageId?: number;
    isOpen: boolean;
}

interface CollapsibleSectionProps {
    title: string;
    icon: React.ReactNode;
    defaultExpanded?: boolean;
    badge?: number;
    children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    icon,
    defaultExpanded = true,
    badge,
    children
}) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <Box>
            <Box
                onClick={() => setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1.5,
                    px: 2,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'background-color 0.15s',
                    '&:hover': {
                        bgcolor: alpha(theme.palette.text.primary, 0.03)
                    }
                }}
            >
                <Box sx={{ color: theme.palette.text.secondary, display: 'flex' }}>
                    {expanded ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
                </Box>
                <Box sx={{ color: theme.palette.primary.main, display: 'flex' }}>
                    {icon}
                </Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
                    {title}
                </Typography>
                {badge !== undefined && badge > 0 && (
                    <Chip
                        label={badge}
                        size="small"
                        sx={{
                            height: 20,
                            minWidth: 20,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: alpha(theme.palette.primary.main, 0.15),
                            color: theme.palette.primary.main
                        }}
                    />
                )}
            </Box>
            <Collapse in={expanded}>
                <Box sx={{ px: 2, pb: 2 }}>
                    {children}
                </Box>
            </Collapse>
        </Box>
    );
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

const AnalysisSidebar: React.FC<AnalysisSidebarProps> = ({
    imageId,
    isOpen
}) => {
    const theme = useTheme();

    // Metadata state
    const [metadata, setMetadata] = useState<Record<string, string>>({});
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Detection and ReID state (fetched from DB)
    const [detections, setDetections] = useState<DetectionResult[]>([]);
    const [reidResults, setReidResults] = useState<ReidResult[]>([]);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

    // For adding new metadata row
    const [editingNewRow, setEditingNewRow] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    // Track pending changes for debounce
    const pendingMetadata = useRef<Record<string, string> | null>(null);
    const debouncedMetadata = useDebounce(metadata, 500);

    // Load metadata and analysis data when image changes
    useEffect(() => {
        if (isOpen && imageId) {
            // Load metadata
            setIsLoadingMetadata(true);
            setSaveStatus('idle');
            window.api.getImageMetadata(imageId).then(result => {
                if (result.ok && result.metadata) {
                    setMetadata(result.metadata);
                } else {
                    setMetadata({});
                }
                setIsLoadingMetadata(false);
            });

            // Load detections and ReID from DB
            setIsLoadingAnalysis(true);
            Promise.all([
                window.api.getLatestDetectionsForImages([imageId]),
                window.api.getReidResultsForImage(imageId)
            ]).then(([detectionsResult, reidResult]) => {
                if (detectionsResult.ok && detectionsResult.detections) {
                    setDetections(detectionsResult.detections);
                } else {
                    setDetections([]);
                }
                if (reidResult.ok && reidResult.results) {
                    setReidResults(reidResult.results);
                } else {
                    setReidResults([]);
                }
                setIsLoadingAnalysis(false);
            });
        } else {
            setMetadata({});
            setDetections([]);
            setReidResults([]);
        }
        setEditingNewRow(false);
        setNewKey('');
        setNewValue('');
    }, [isOpen, imageId]);

    // Save metadata when debounced value changes
    useEffect(() => {
        if (!imageId || pendingMetadata.current === null) return;

        const save = async () => {
            setSaveStatus('saving');
            await window.api.updateImageMetadata(imageId, debouncedMetadata);
            setSaveStatus('saved');
            pendingMetadata.current = null;

            // Reset to idle after 2 seconds
            setTimeout(() => setSaveStatus('idle'), 2000);
        };

        save();
    }, [debouncedMetadata, imageId]);

    // Update a metadata value with debounce tracking
    const updateMetadataValue = useCallback((key: string, value: string) => {
        const updated = { ...metadata, [key]: value };
        pendingMetadata.current = updated;
        setMetadata(updated);
    }, [metadata]);

    // Update key name (creates new entry, deletes old)
    const updateMetadataKey = useCallback((oldKey: string, newKeyName: string) => {
        if (oldKey === newKeyName || !newKeyName.trim()) return;
        const updated = { ...metadata };
        const value = updated[oldKey];
        delete updated[oldKey];
        updated[newKeyName.trim()] = value;
        pendingMetadata.current = updated;
        setMetadata(updated);
    }, [metadata]);

    // Delete a metadata entry
    const deleteMetadataEntry = useCallback((key: string) => {
        const updated = { ...metadata };
        delete updated[key];
        pendingMetadata.current = updated;
        setMetadata(updated);
    }, [metadata]);

    // Add a new metadata entry (both key and value together)
    const addMetadataEntry = useCallback(() => {
        if (!newKey.trim()) return;
        const updated = { ...metadata, [newKey.trim()]: newValue };
        pendingMetadata.current = updated;
        setMetadata(updated);
        setNewKey('');
        setNewValue('');
        setEditingNewRow(false);
    }, [metadata, newKey, newValue]);

    if (!isOpen) return null;

    return (
        <Box sx={{
            width: 320,
            height: '100%',
            borderLeft: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <Box sx={{
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Typography variant="subtitle1" fontWeight={600}>
                    分析
                </Typography>
                {/* Save status indicator */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    opacity: saveStatus === 'idle' ? 0 : 1,
                    transition: 'opacity 0.2s'
                }}>
                    {saveStatus === 'saved' && (
                        <>
                            <Check size={14} weight="bold" color={theme.palette.success.main} />
                            <Typography variant="caption" color="success.main">
                                已保存
                            </Typography>
                        </>
                    )}
                    {saveStatus === 'saving' && (
                        <Typography variant="caption" color="text.secondary">
                            正在保存...
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Scrollable content */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {/* Metadata Section - Table Based */}
                <CollapsibleSection
                    title="元数据"
                    icon={<Tag size={16} weight="duotone" />}
                    badge={Object.keys(metadata).length}
                >
                    {isLoadingMetadata ? (
                        <Typography variant="body2" color="text.secondary">加载中...</Typography>
                    ) : (
                        <Box>
                            <Table size="small" sx={{
                                '& .MuiTableCell-root': {
                                    py: 0.75,
                                    px: 1,
                                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`
                                }
                            }}>
                                <TableBody>
                                    {Object.entries(metadata).map(([key, value]) => (
                                        <TableRow key={key} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                                            <TableCell sx={{ width: '35%', fontWeight: 500, fontSize: '0.8rem' }}>
                                                <TextField
                                                    size="small"
                                                    variant="standard"
                                                    fullWidth
                                                    defaultValue={key}
                                                    onBlur={(e) => updateMetadataKey(key, e.target.value)}
                                                    InputProps={{
                                                        disableUnderline: true,
                                                        sx: { fontSize: '0.8rem', fontWeight: 500 }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>
                                                <TextField
                                                    size="small"
                                                    variant="standard"
                                                    fullWidth
                                                    value={value}
                                                    onChange={(e) => updateMetadataValue(key, e.target.value)}
                                                    InputProps={{
                                                        disableUnderline: true,
                                                        sx: { fontSize: '0.8rem' }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ width: 32, p: 0 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => deleteMetadataEntry(key)}
                                                    sx={{
                                                        opacity: 0.5,
                                                        '&:hover': { opacity: 1, color: theme.palette.error.main }
                                                    }}
                                                >
                                                    <Trash size={14} />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {/* New row input */}
                                    {editingNewRow && (
                                        <TableRow>
                                            <TableCell sx={{ width: '35%' }}>
                                                <TextField
                                                    size="small"
                                                    variant="standard"
                                                    fullWidth
                                                    placeholder="键"
                                                    value={newKey}
                                                    onChange={(e) => setNewKey(e.target.value)}
                                                    autoFocus
                                                    InputProps={{
                                                        disableUnderline: true,
                                                        sx: { fontSize: '0.8rem' }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') addMetadataEntry();
                                                        if (e.key === 'Escape') {
                                                            setEditingNewRow(false);
                                                            setNewKey('');
                                                            setNewValue('');
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    size="small"
                                                    variant="standard"
                                                    fullWidth
                                                    placeholder="值"
                                                    value={newValue}
                                                    onChange={(e) => setNewValue(e.target.value)}
                                                    InputProps={{
                                                        disableUnderline: true,
                                                        sx: { fontSize: '0.8rem' }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') addMetadataEntry();
                                                        if (e.key === 'Escape') {
                                                            setEditingNewRow(false);
                                                            setNewKey('');
                                                            setNewValue('');
                                                        }
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ width: 32, p: 0 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={addMetadataEntry}
                                                    disabled={!newKey.trim()}
                                                    sx={{ color: theme.palette.primary.main }}
                                                >
                                                    <Check size={14} weight="bold" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>

                            {/* Add button */}
                            {!editingNewRow && (
                                <Box sx={{ mt: 1.5 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setEditingNewRow(true)}
                                        sx={{
                                            border: `1px dashed ${alpha(theme.palette.text.primary, 0.2)}`,
                                            borderRadius: 1,
                                            px: 1.5,
                                            py: 0.25,
                                            color: theme.palette.text.secondary,
                                            '&:hover': {
                                                borderColor: theme.palette.primary.main,
                                                color: theme.palette.primary.main,
                                                bgcolor: alpha(theme.palette.primary.main, 0.05)
                                            }
                                        }}
                                    >
                                        <Plus size={12} />
                                        <Typography variant="caption" sx={{ ml: 0.5, fontSize: '0.7rem' }}>添加</Typography>
                                    </IconButton>
                                </Box>
                            )}
                        </Box>
                    )}
                </CollapsibleSection>

                {/* Detections Section - Species classification */}
                {(detections.length > 0 || isLoadingAnalysis) && (
                    <CollapsibleSection
                        title="检测"
                        icon={<BoundingBox size={16} weight="duotone" />}
                        badge={detections.length}
                    >
                        {isLoadingAnalysis ? (
                            <Typography variant="body2" color="text.secondary">加载中...</Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {detections.map((det) => (
                                    <Box
                                        key={det.id}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 2,
                                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                                            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {translateSpecies(det.label)}
                                            </Typography>
                                            <Chip
                                                label={`${(det.confidence * 100).toFixed(1)}%`}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    fontFamily: 'monospace',
                                                    bgcolor: alpha(theme.palette.info.main, 0.15),
                                                    color: theme.palette.info.main
                                                }}
                                            />
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            检测置信度: {(det.detection_confidence * 100).toFixed(1)}%
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </CollapsibleSection>
                )}

                {/* Re-Identification Section - Individual matching (NO confidence) */}
                {(reidResults.length > 0 || isLoadingAnalysis) && (
                    <CollapsibleSection
                        title="个体鉴别"
                        icon={<Fingerprint size={16} weight="duotone" />}
                        badge={reidResults.length}
                    >
                        {isLoadingAnalysis ? (
                            <Typography variant="body2" color="text.secondary">加载中...</Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {reidResults.map((reid, idx) => (
                                    <Box
                                        key={`${reid.individualId}-${idx}`}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 2,
                                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                                            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                            <Box sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                bgcolor: reid.individualColor,
                                                flexShrink: 0
                                            }} />
                                            <Typography variant="body2" fontWeight={600}>
                                                {reid.individualDisplayName}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            物种: {translateSpecies(reid.species)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            运行: {reid.runName}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </CollapsibleSection>
                )}
            </Box>
        </Box>
    );
};

export default AnalysisSidebar;
