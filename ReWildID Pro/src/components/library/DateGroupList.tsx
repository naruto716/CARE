import { Box, IconButton, Tooltip, Typography, useTheme, Chip, Button } from '@mui/material';
import { AnalyseMenu } from './AnalyseMenu';
import { CaretDown, CaretRight, Check as CheckIcon, DotsThreeVertical, UploadSimple, Images } from '@phosphor-icons/react';
import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { DBImage } from '../../types/electron';
import { DateSection, GroupData } from '../../types/library';
import AiModeButton from '../AiModeButton';
import ImageCard from '../ImageCard';
import { translateSpecies } from '../../constants/species';

export interface DateGroupListHandle {
    scrollToIndex: (index: number) => void;
    scrollToDate: (date: string) => void;
    scrollToGroup: (groupId: number) => void;
}

type SortOption = 'default' | 'species' | 'individual' | 'name';

interface DateGroupListProps {
    dateSections: DateSection[];
    imageUrls: Record<number, string>;
    loadImage: (image: DBImage) => void;
    isSelectionMode: boolean;
    selectedImageIds: Set<number>;
    onToggleSelection: (id: number) => void;
    onSetSelection?: (ids: Set<number>) => void;
    onEnableSelectionMode?: () => void;
    onExitSelectionMode?: () => void;
    allImages?: DBImage[];
    onImageClick: (image: DBImage) => void;
    onMenuOpen: (event: React.MouseEvent<HTMLElement>, groupId: number) => void;
    gridItemSize?: number;
    showNames?: boolean;
    headerContent?: React.ReactNode;
    onActiveItemChange?: (id: string) => void;
    aspectRatio?: string;
    fullImageUrls?: Record<number, string>;
    loadFullImage?: (image: DBImage) => void;
    // AI Analysis support
    aiButtonMode?: 'detect' | 'reid' | 'analyse';
    onReID?: (images: DBImage[], species: string) => void;
    onClassify?: (images: DBImage[]) => void;
    availableSpecies?: string[];
    // Empty state action
    onUpload?: () => void;
    // Sort mode
    sortBy?: SortOption;
    // Scroll state callback
    onScrollStateChange?: (isScrolled: boolean) => void;
    // Tag visibility
    showSpeciesTags?: boolean;
    showReidTags?: boolean;
}

type FlatItem =
    | { type: 'date-header'; date: string; id: string }
    | { type: 'group-header'; group: GroupData; id: string }
    | { type: 'image-row'; images: DBImage[]; groupId: number; id: string }
    | { type: 'sub-header'; label: string; color?: string; count: number; id: string }
    | { type: 'horizontal-row'; images: DBImage[]; groupId: number; id: string };

export const DateGroupList = forwardRef<DateGroupListHandle, DateGroupListProps>((props, ref) => {
    const {
        dateSections,
        imageUrls,
        loadImage,
        isSelectionMode,
        selectedImageIds,
        onToggleSelection,
        onSetSelection,
        onEnableSelectionMode,
        onExitSelectionMode,
        allImages = [],
        onImageClick,
        onMenuOpen,
        gridItemSize = 180,
        showNames = false,
        headerContent,
        onActiveItemChange,
        aspectRatio = '1.618/1',
        fullImageUrls = {},
        loadFullImage,
        aiButtonMode = 'detect',
        onReID,
        onClassify,
        availableSpecies = [],
        onUpload,
        sortBy = 'default',
        onScrollStateChange,
        showSpeciesTags = true,
        showReidTags = true
    } = props;

    const theme = useTheme();
    const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
    const lastScrollState = useRef(false);
    const [containerWidth, setContainerWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Analyse menu state
    const [analyseMenuOpen, setAnalyseMenuOpen] = useState(false);
    const [analyseMenuGroup, setAnalyseMenuGroup] = useState<GroupData | null>(null);

    // Resize Observer to get width
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Calculate columns
    // Account for px: 4 (32px * 2 = 64px) padding on the rows
    const horizontalPadding = 64;
    const availableWidth = containerWidth - horizontalPadding;
    const gap = 16; // 2 * 8px (theme spacing 2)
    const minItemWidth = gridItemSize;

    // Avoid division by zero or negative width
    const columns = availableWidth > 0
        ? Math.max(1, Math.floor((availableWidth + gap) / (minItemWidth + gap)))
        : 0;

    // Calculate actual item width (1fr tracks expand to fill available space)
    const actualItemWidth = columns > 0
        ? (availableWidth - (gap * (columns - 1))) / columns
        : gridItemSize;

    // Flatten Data
    const flatItems = useMemo(() => {
        const items: FlatItem[] = [];
        if (columns === 0) return items;

        dateSections.forEach(section => {
            items.push({ type: 'date-header', date: section.date, id: `date-${section.date}` });

            section.groups.forEach(group => {
                items.push({ type: 'group-header', group, id: `group-${group.id}` });

                if (!collapsedGroups.has(group.id)) {
                    // Check if we need to group by species or individual
                    if (sortBy === 'species' || sortBy === 'individual') {
                        // Group images by species or individual
                        const subGroups = new Map<string, { images: DBImage[]; color?: string }>();

                        group.images.forEach(img => {
                            let key: string;
                            let color: string | undefined;

                            if (sortBy === 'species') {
                                // Use most recent detection batch
                                if (img.detections && img.detections.length > 0) {
                                    const sortedDets = [...img.detections].sort((a, b) => (b.batch_id || 0) - (a.batch_id || 0));
                                    const latestBatchId = sortedDets[0]?.batch_id;
                                    const latestDets = sortedDets.filter(d => d.batch_id === latestBatchId);
                                    const species = latestDets.find(d => d.label && d.label !== 'blank')?.label;
                                    key = species ? translateSpecies(species) : '未分类';
                                } else {
                                    key = '未分类';
                                }
                            } else {
                                // Use most recent ReID run
                                if (img.reidResults && img.reidResults.length > 0) {
                                    const sortedReid = [...img.reidResults].sort((a, b) => (b.runId || 0) - (a.runId || 0));
                                    const latestRunId = sortedReid[0]?.runId;
                                    const latestReid = sortedReid.filter(r => r.runId === latestRunId);
                                    const reid = latestReid[0];
                                    key = reid?.individualDisplayName || '未识别';
                                    color = reid?.individualColor;
                                } else {
                                    key = '未识别';
                                }
                            }

                            if (!subGroups.has(key)) {
                                subGroups.set(key, { images: [], color });
                            }
                            subGroups.get(key)!.images.push(img);
                        });

                        // Sort subGroups: known items first, then unknown
                        const sortedKeys = Array.from(subGroups.keys()).sort((a, b) => {
                            if (a === 'Unclassified' || a === 'Unidentified') return 1;
                            if (b === 'Unclassified' || b === 'Unidentified') return -1;
                            return a.localeCompare(b);
                        });

                        sortedKeys.forEach(key => {
                            const subGroup = subGroups.get(key)!;
                            items.push({
                                type: 'sub-header',
                                label: key,
                                color: subGroup.color,
                                count: subGroup.images.length,
                                id: `group-${group.id}-sub-${key}`
                            });
                            // Chunk images into rows (same as default view)
                            for (let i = 0; i < subGroup.images.length; i += columns) {
                                const rowImages = subGroup.images.slice(i, i + columns);
                                items.push({
                                    type: 'horizontal-row',
                                    images: rowImages,
                                    groupId: group.id,
                                    id: `group-${group.id}-hrow-${key}-${i}`
                                });
                            }
                        });
                    } else {
                        // Default or name sort: chunk images into grid rows
                        const sortedImages = sortBy === 'name'
                            ? [...group.images].sort((a, b) => {
                                const aName = a.original_path.split(/[\\/]/).pop() || '';
                                const bName = b.original_path.split(/[\\/]/).pop() || '';
                                return aName.localeCompare(bName);
                            })
                            : group.images;

                        for (let i = 0; i < sortedImages.length; i += columns) {
                            const rowImages = sortedImages.slice(i, i + columns);
                            items.push({
                                type: 'image-row',
                                images: rowImages,
                                groupId: group.id,
                                id: `group-${group.id}-row-${i}`
                            });
                        }
                    }
                }
            });
        });
        return items;
    }, [dateSections, collapsedGroups, columns, sortBy]);

    // Expose scrollToIndex to parent via ref
    useImperativeHandle(ref, () => ({
        scrollToIndex: (index: number) => {
            virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior: 'smooth' });
        },
        scrollToDate: (date: string) => {
            const index = flatItems.findIndex(item => item.type === 'date-header' && item.date === date);
            if (index !== -1) {
                virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior: 'smooth' });
            }
        },
        scrollToGroup: (groupId: number) => {
            const index = flatItems.findIndex(item => item.type === 'group-header' && item.group.id === groupId);
            if (index !== -1) {
                virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior: 'smooth' });
            }
        }
    }), [flatItems]);

    // Drag Selection State
    const isPointerDownRef = useRef(false);
    const dragStartIdRef = useRef<number | null>(null);
    const initialSelectionRef = useRef<Set<number>>(new Set());
    const isSelectingRef = useRef(true);
    const autoScrollFrameRef = useRef<number | null>(null);

    // Auto Scroll Logic
    const checkAutoScroll = (clientY: number) => {
        if (!virtuosoRef.current || !isPointerDownRef.current) return;

        const viewportHeight = window.innerHeight;
        const scrollZoneHeight = 100; // px from edge to trigger scroll
        const maxScrollSpeed = 15; // px per frame

        if (autoScrollFrameRef.current) {
            cancelAnimationFrame(autoScrollFrameRef.current);
            autoScrollFrameRef.current = null;
        }

        let scrollAmount = 0;
        if (clientY < scrollZoneHeight) {
            // Scroll Up
            // Speed increases as we get closer to the edge
            const factor = 1 - (clientY / scrollZoneHeight);
            scrollAmount = -Math.max(1, factor * maxScrollSpeed);
        } else if (clientY > viewportHeight - scrollZoneHeight) {
            // Scroll Down
            const factor = 1 - ((viewportHeight - clientY) / scrollZoneHeight);
            scrollAmount = Math.max(1, factor * maxScrollSpeed);
        }

        if (scrollAmount !== 0) {
            virtuosoRef.current.scrollBy({ top: scrollAmount, behavior: 'auto' });
            autoScrollFrameRef.current = requestAnimationFrame(() => checkAutoScroll(clientY));
        }
    };

    // ... (Keeping selection logic helpers but adapted) ...

    const startDragSession = (imgId: number) => {
        dragStartIdRef.current = imgId;
        initialSelectionRef.current = new Set(selectedImageIds);
        const wasSelected = initialSelectionRef.current.has(imgId);
        isSelectingRef.current = !wasSelected;

        const newSelection = new Set(initialSelectionRef.current);
        if (isSelectingRef.current) newSelection.add(imgId);
        else newSelection.delete(imgId);

        if (onSetSelection) onSetSelection(newSelection);
        else onToggleSelection(imgId);
    };

    const handleLongPress = (imgId: number) => {
        if (!isSelectionMode && onEnableSelectionMode) {
            onEnableSelectionMode();
            isPointerDownRef.current = true;
            startDragSession(imgId);
        }
    };

    const handlePointerDown = (_e: React.PointerEvent, imgId: number) => {
        if (isSelectionMode) {
            isPointerDownRef.current = true;
            startDragSession(imgId);
        }
    };

    const handlePointerEnter = (imgId: number) => {
        if (isSelectionMode && isPointerDownRef.current && dragStartIdRef.current !== null && onSetSelection && allImages.length > 0) {
            const startIndex = allImages.findIndex(img => img.id === dragStartIdRef.current);
            const currentIndex = allImages.findIndex(img => img.id === imgId);
            if (startIndex === -1 || currentIndex === -1) return;

            const minIndex = Math.min(startIndex, currentIndex);
            const maxIndex = Math.max(startIndex, currentIndex);
            const newSelection = new Set(initialSelectionRef.current);

            for (let i = minIndex; i <= maxIndex; i++) {
                const id = allImages[i].id;
                if (isSelectingRef.current) newSelection.add(id);
                else newSelection.delete(id);
            }
            onSetSelection(newSelection);
        }
    };

    useEffect(() => {
        const handleGlobalPointerMove = (e: PointerEvent) => {
            if (isPointerDownRef.current) {
                checkAutoScroll(e.clientY);
            }
        };

        const handleGlobalPointerUp = () => {
            isPointerDownRef.current = false;
            dragStartIdRef.current = null;
            if (autoScrollFrameRef.current) {
                cancelAnimationFrame(autoScrollFrameRef.current);
                autoScrollFrameRef.current = null;
            }
        };

        window.addEventListener('pointermove', handleGlobalPointerMove);
        window.addEventListener('pointerup', handleGlobalPointerUp);
        return () => {
            window.removeEventListener('pointermove', handleGlobalPointerMove);
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
        };
    }, []);

    // Actions
    const handleSelectGroup = (groupImages: DBImage[]) => {
        if (!onSetSelection) return;
        if (!isSelectionMode && onEnableSelectionMode) onEnableSelectionMode();

        const groupIds = groupImages.map(img => img.id);
        const allSelected = groupIds.every(id => selectedImageIds.has(id));
        const newSelection = new Set(selectedImageIds);

        if (allSelected) groupIds.forEach(id => newSelection.delete(id));
        else groupIds.forEach(id => newSelection.add(id));

        onSetSelection(newSelection);
        if (newSelection.size === 0 && onExitSelectionMode) onExitSelectionMode();
    };

    const toggleGroup = (groupId: number) => {
        const newCollapsed = new Set(collapsedGroups);
        if (newCollapsed.has(groupId)) newCollapsed.delete(groupId);
        else newCollapsed.add(groupId);
        setCollapsedGroups(newCollapsed);
    };

    const handleDetect = async (images: DBImage[]) => {
        const paths = images.map(img => img.original_path);
        const ids = images.map(img => img.id);
        try {
            const response = await window.api.detect(paths, () => { }, ids);
            if (!response.ok) alert('Detection failed: ' + response.error);
        } catch (error) {
            alert('Error triggering detection: ' + error);
        }
    };

    const formatDate = (dateStr: string) => {
        if (dateStr.length !== 8) return dateStr;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Calculate row height for consistent sizing (prevents scroll jumps)
    // Use actualItemWidth (not gridItemSize) since 1fr tracks expand to fill container
    const getRowHeight = useCallback(() => {
        const [w, h] = aspectRatio.split('/').map(Number);
        return actualItemWidth * (h / w) + (showNames ? 40 : 16);
    }, [aspectRatio, actualItemWidth, showNames]);

    // Render Item - fixed heights prevent Virtuoso scroll jumps
    const itemContent = (_: number, item: FlatItem) => {
        if (item.type === 'date-header') {
            return (
                <Box id={item.id} sx={{ height: 56, display: 'flex', alignItems: 'flex-end', px: 4, pb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.875rem' }}>
                        {formatDate(item.date)}
                    </Typography>
                </Box>
            );
        } else if (item.type === 'group-header') {
            const group = item.group;
            const isCollapsed = collapsedGroups.has(group.id);
            const isAllSelected = group.images.every((img: DBImage) => selectedImageIds.has(img.id));

            return (
                <Box id={`group-${group.id}`} sx={{
                    height: 78, // Fixed height prevents scroll jumps (+24 for bottom margin)
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', px: 4, pt: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                        <Box sx={{ position: 'absolute', left: -29, display: 'flex', alignItems: 'center', height: '100%' }}>
                            <IconButton
                                className="collapse-arrow"
                                size="small"
                                onClick={() => toggleGroup(group.id)}
                                sx={{ padding: 0.5, opacity: 1 }}
                            >
                                {isCollapsed ? <CaretRight size={20} /> : <CaretDown size={20} />}
                            </IconButton>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{group.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ bgcolor: theme.palette.action.selected, px: 1, py: 0.5, borderRadius: 1 }}>
                            {group.images.length}
                        </Typography>
                        <Tooltip title="选择组内所有图片">
                            <IconButton
                                className="group-select-button"
                                size="small"
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSelectGroup(group.images); }}
                                sx={{ opacity: 1, color: isAllSelected ? 'primary.main' : 'text.secondary' }}
                            >
                                <CheckIcon size={20} weight={isAllSelected ? "bold" : "regular"} />
                            </IconButton>
                        </Tooltip>
                        <IconButton
                            className="group-menu-button"
                            size="small"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => onMenuOpen(e, group.id)}
                            sx={{ opacity: 1 }}
                        >
                            <DotsThreeVertical size={20} />
                        </IconButton>
                    </Box>
                    {aiButtonMode === 'analyse' ? (
                        <>
                            <AiModeButton
                                data-tour="library-analyse"
                                text={group.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length > 0
                                    ? `分析 (${group.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length})`
                                    : "分析"}
                                onClick={() => {
                                    setAnalyseMenuGroup(group);
                                    setAnalyseMenuOpen(true);
                                }}
                            />
                            {analyseMenuGroup?.id === group.id && analyseMenuGroup && (
                                <AnalyseMenu
                                    open={analyseMenuOpen}
                                    onClose={() => {
                                        setAnalyseMenuOpen(false);
                                        setAnalyseMenuGroup(null);
                                    }}
                                    onClassify={() => {
                                        const groupImages = analyseMenuGroup.images;
                                        const selectedInGroup = groupImages.filter((img: DBImage) => selectedImageIds.has(img.id));
                                        const imagesToProcess = selectedInGroup.length > 0 ? selectedInGroup : groupImages;
                                        if (onClassify) onClassify(imagesToProcess);
                                        setAnalyseMenuOpen(false);
                                        setAnalyseMenuGroup(null);
                                    }}
                                    onReID={(species) => {
                                        const groupImages = analyseMenuGroup.images;
                                        const selectedInGroup = groupImages.filter((img: DBImage) => selectedImageIds.has(img.id));
                                        const imagesToProcess = selectedInGroup.length > 0 ? selectedInGroup : groupImages;
                                        if (onReID) onReID(imagesToProcess, species);
                                        setAnalyseMenuOpen(false);
                                        setAnalyseMenuGroup(null);
                                    }}
                                    availableSpecies={availableSpecies}
                                    selectedCount={
                                        analyseMenuGroup.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length > 0
                                            ? analyseMenuGroup.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length
                                            : analyseMenuGroup.images.length
                                    }
                                />
                            )}
                        </>
                    ) : aiButtonMode === 'reid' ? (
                        <>
                            <AiModeButton
                                text={group.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length > 0
                                    ? `个体鉴别 (${group.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length})`
                                    : "个体鉴别"}
                                onClick={() => {
                                    setAnalyseMenuGroup(group);
                                    setAnalyseMenuOpen(true);
                                }}
                            />
                            {analyseMenuGroup?.id === group.id && analyseMenuGroup && (
                                <AnalyseMenu
                                    open={analyseMenuOpen}
                                    onClose={() => {
                                        setAnalyseMenuOpen(false);
                                        setAnalyseMenuGroup(null);
                                    }}
                                    onReID={(species) => {
                                        const groupImages = analyseMenuGroup.images;
                                        const selectedInGroup = groupImages.filter((img: DBImage) => selectedImageIds.has(img.id));
                                        const imagesToProcess = selectedInGroup.length > 0 ? selectedInGroup : groupImages;
                                        if (onReID) onReID(imagesToProcess, species);
                                        setAnalyseMenuOpen(false);
                                        setAnalyseMenuGroup(null);
                                    }}
                                    availableSpecies={availableSpecies}
                                    selectedCount={
                                        analyseMenuGroup.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length > 0
                                            ? analyseMenuGroup.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length
                                            : analyseMenuGroup.images.length
                                    }
                                    reidOnly={true}
                                    title="个体鉴别"
                                />
                            )}
                        </>
                    ) : (
                        <AiModeButton
                            text={group.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length > 0
                                ? `检测 (${group.images.filter((img: DBImage) => selectedImageIds.has(img.id)).length})`
                                : "检测"}
                            onClick={() => {
                                const selectedInGroup = group.images.filter((img: DBImage) => selectedImageIds.has(img.id));
                                handleDetect(selectedInGroup.length > 0 ? selectedInGroup : group.images);
                            }}
                        />
                    )}
                </Box>
            );
        } else if (item.type === 'sub-header') {
            // Sub-header for species/individual grouping
            return (
                <Box sx={{
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 4,
                    pt: 2,
                    pb: 0.5
                }}>
                    {item.color && (
                        <Box sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: item.color,
                            flexShrink: 0
                        }} />
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        {item.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {item.count}
                    </Typography>
                </Box>
            );
        } else if (item.type === 'horizontal-row') {
            // Grid row for grouped images - same as default view
            const rowHeight = getRowHeight() + 8;
            return (
                <Box sx={{
                    height: rowHeight,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: 2,
                    pb: 0,
                    px: 4,
                    overflow: 'hidden',
                    alignItems: 'start'
                }}>
                    {item.images.map((img: DBImage) => {
                        const fileDetails = {
                            name: img.original_path.split(/[\\/]/).pop() || 'image.jpg',
                            path: img.original_path,
                            isDirectory: false
                        };

                        // Build species badge (top-right) - use most recent detection run
                        let speciesBadge: React.ReactNode = null;
                        if (showSpeciesTags && img.detections && img.detections.length > 0) {
                            // Sort by batch_id descending to get most recent run
                            const sortedDetections = [...img.detections].sort((a, b) => (b.batch_id || 0) - (a.batch_id || 0));
                            const latestBatchId = sortedDetections[0]?.batch_id;
                            const latestDetections = sortedDetections.filter(d => d.batch_id === latestBatchId);
                            const labels = Array.from(new Set(latestDetections.map((d: { label: string }) => d.label).filter((l: string) => l && l !== 'blank')));
                            if (labels.length === 0) {
                                speciesBadge = <Chip label="未分类" size="small" sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', height: 20, fontSize: '0.65rem', fontWeight: 600, backdropFilter: 'blur(4px)' }} />;
                            } else {
                                const text = labels.length > 1 ? `${translateSpecies(labels[0])} +${labels.length - 1}` : translateSpecies(labels[0]);
                                speciesBadge = <Chip label={text} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.9)', color: '#000', height: 20, fontSize: '0.65rem', fontWeight: 600 }} />;
                            }
                        }

                        // Build ReID badge (top-left) - use most recent run
                        let reidBadge: React.ReactNode = null;
                        if (showReidTags && img.reidResults && img.reidResults.length > 0) {
                            // Sort by runId descending to get most recent run
                            const sortedReid = [...img.reidResults].sort((a, b) => (b.runId || 0) - (a.runId || 0));
                            const latestRunId = sortedReid[0]?.runId;
                            const latestReid = sortedReid.filter(r => r.runId === latestRunId);
                            const firstReid = latestReid[0];
                            const moreCount = latestReid.length - 1;
                            const reidLabel = moreCount > 0
                                ? `${firstReid.individualDisplayName} +${moreCount}`
                                : firstReid.individualDisplayName;

                            reidBadge = (
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    bgcolor: firstReid.individualColor,
                                    color: '#fff',
                                    px: 0.75,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }}>
                                    {reidLabel}
                                </Box>
                            );
                        }

                        return (
                            <Box key={img.id} sx={{ minWidth: 0, height: 'fit-content' }}>
                                <ImageCard
                                    file={fileDetails}
                                    date={item.id}
                                    // @ts-ignore
                                    loadImage={() => {
                                        if (gridItemSize > 500 && loadFullImage) {
                                            loadFullImage(img);
                                        } else {
                                            loadImage(img);
                                        }
                                    }}
                                    imageUrl={(gridItemSize > 500 && fullImageUrls[img.id]) ? fullImageUrls[img.id] : imageUrls[img.id]}
                                    onClick={() => onImageClick(img)}
                                    selectable={isSelectionMode}
                                    selected={selectedImageIds.has(img.id)}
                                    onToggleSelection={() => onToggleSelection(img.id)}
                                    showNames={showNames}
                                    onLongPress={() => handleLongPress(img.id)}
                                    onPointerDown={(e) => handlePointerDown(e, img.id)}
                                    onPointerEnter={() => handlePointerEnter(img.id)}
                                    badge={speciesBadge}
                                    badgeBottomLeft={reidBadge}
                                    aspectRatio={aspectRatio}
                                    isPlaceholder={gridItemSize > 500 && !fullImageUrls[img.id]}
                                    cloudUrl={img.cloud_url}
                                />
                            </Box>
                        );
                    })}
                </Box>
            );
        } else {
            // Default: Image Row (grid) - fixed height prevents scroll jumps
            const rowHeight = getRowHeight() + 8; // +8 for bottom margin (row gap)
            return (
                <Box sx={{ height: rowHeight, display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 2, pb: 1, px: 4, overflow: 'hidden', alignItems: 'start' }}>
                    {item.images.map((img: DBImage) => {
                        const fileDetails = {
                            name: img.original_path.split(/[\\/]/).pop() || 'image.jpg',
                            path: img.original_path,
                            isDirectory: false
                        };

                        // Build species badge (top-right) - use most recent detection run
                        let speciesBadge: React.ReactNode = null;
                        if (showSpeciesTags && img.detections && img.detections.length > 0) {
                            // Sort by batch_id descending to get most recent run
                            const sortedDetections = [...img.detections].sort((a, b) => (b.batch_id || 0) - (a.batch_id || 0));
                            const latestBatchId = sortedDetections[0]?.batch_id;
                            const latestDetections = sortedDetections.filter(d => d.batch_id === latestBatchId);
                            const labels = Array.from(new Set(latestDetections.map((d: { label: string }) => d.label).filter((l: string) => l && l !== 'blank')));
                            if (labels.length === 0) {
                                speciesBadge = <Chip label="未分类" size="small" sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', height: 20, fontSize: '0.65rem', fontWeight: 600, backdropFilter: 'blur(4px)' }} />;
                            } else {
                                const text = labels.length > 1 ? `${translateSpecies(labels[0])} +${labels.length - 1}` : translateSpecies(labels[0]);
                                speciesBadge = <Chip label={text} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.9)', color: '#000', height: 20, fontSize: '0.65rem', fontWeight: 600 }} />;
                            }
                        }

                        // Build ReID badge (top-left) - use most recent run
                        let reidBadge: React.ReactNode = null;
                        if (showReidTags && img.reidResults && img.reidResults.length > 0) {
                            // Sort by runId descending to get most recent run
                            const sortedReid = [...img.reidResults].sort((a, b) => (b.runId || 0) - (a.runId || 0));
                            const latestRunId = sortedReid[0]?.runId;
                            const latestReid = sortedReid.filter(r => r.runId === latestRunId);
                            const firstReid = latestReid[0];
                            const moreCount = latestReid.length - 1;
                            const reidLabel = moreCount > 0
                                ? `${firstReid.individualDisplayName} +${moreCount}`
                                : firstReid.individualDisplayName;

                            reidBadge = (
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    bgcolor: firstReid.individualColor,
                                    color: '#fff',
                                    px: 0.75,
                                    py: 0.25,
                                    borderRadius: 1,
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }}>
                                    {reidLabel}
                                </Box>
                            );
                        }

                        const badge = speciesBadge;

                        return (
                            <Box key={img.id} sx={{ minWidth: 0, height: 'fit-content' }}>
                                <ImageCard
                                    file={fileDetails}
                                    date={item.id} // Just needs a string
                                    // @ts-ignore
                                    loadImage={() => {
                                        if (gridItemSize > 500 && loadFullImage) {
                                            loadFullImage(img);
                                        } else {
                                            loadImage(img);
                                        }
                                    }}
                                    imageUrl={(gridItemSize > 500 && fullImageUrls[img.id]) ? fullImageUrls[img.id] : imageUrls[img.id]}
                                    onClick={() => onImageClick(img)}
                                    selectable={isSelectionMode}
                                    selected={selectedImageIds.has(img.id)}
                                    onToggleSelection={() => onToggleSelection(img.id)}
                                    showNames={showNames}
                                    onLongPress={() => handleLongPress(img.id)}
                                    onPointerDown={(e) => handlePointerDown(e, img.id)}
                                    onPointerEnter={() => handlePointerEnter(img.id)}
                                    badge={badge}
                                    badgeBottomLeft={reidBadge}
                                    aspectRatio={aspectRatio}
                                    isPlaceholder={gridItemSize > 500 && !fullImageUrls[img.id]}
                                    cloudUrl={img.cloud_url}
                                />
                            </Box>
                        );
                    })}
                </Box>
            );
        }
    };

    // Memoized components and context for Virtuoso (prevents unnecessary recalculations)
    // NOTE: These hooks MUST be before any early returns to satisfy React's rules of hooks
    const virtuosoComponents = useMemo(() => ({
        Header: () => <Box>{headerContent}</Box>
    }), [headerContent]);

    // Average item height for better Virtuoso estimation
    const avgItemHeight = useMemo(() => {
        const rowHeight = getRowHeight() + 8;
        return Math.round((56 + 78 + rowHeight * 3) / 5); // 56=date-header, 78=group-header
    }, [getRowHeight]);

    // Empty state - show header content so filter/search controls remain accessible
    if (dateSections.length === 0) {
        return (
            <Box ref={containerRef} sx={{ height: '100%', width: '100%', overflow: 'auto' }}>
                {headerContent}
                <Box sx={{ height: 'calc(100% - 140px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                    <Images size={64} color={theme.palette.text.primary} weight="thin" />
                    <Typography variant="h5" fontWeight="500" sx={{ mt: 3, color: 'text.primary' }}>No images found</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>Try adjusting your filters or search query</Typography>
                    {onUpload && (
                        <Button
                            variant="contained"
                            startIcon={<UploadSimple size={18} />}
                            onClick={onUpload}
                            sx={{
                                mt: 3,
                                borderRadius: 2,
                                textTransform: 'none',
                                bgcolor: theme.palette.mode === 'dark' ? '#FFFFFF' : '#000000',
                                color: theme.palette.mode === 'dark' ? '#000000' : '#FFFFFF',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark' ? '#E0E0E0' : '#333333'
                                }
                            }}
                        >
                            Upload
                        </Button>
                    )}
                </Box>
            </Box>
        );
    }

    return (
        <Box ref={containerRef} sx={{ height: '100%', width: '100%' }}>
            <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%' }}
                data={flatItems}
                itemContent={itemContent}
                overscan={400}
                defaultItemHeight={avgItemHeight}
                computeItemKey={(_, item) => item.id}
                rangeChanged={({ startIndex }) => {
                    if (!onActiveItemChange) return;
                    for (let i = startIndex; i >= 0; i--) {
                        const item = flatItems[i];
                        if (item.type === 'date-header' || item.type === 'group-header') {
                            onActiveItemChange(item.id);
                            break;
                        }
                    }
                }}
                onScroll={(e) => {
                    if (!onScrollStateChange) return;
                    const scrollTop = (e.target as HTMLElement).scrollTop;
                    const isScrolled = scrollTop > 150;
                    if (isScrolled !== lastScrollState.current) {
                        lastScrollState.current = isScrolled;
                        onScrollStateChange(isScrolled);
                    }
                }}
                components={virtuosoComponents}
            />
        </Box>
    );
});
