import {
    Box,
    Button,
    IconButton,
    Menu, MenuItem,
    Tooltip,
    useTheme
} from '@mui/material';
import {
    ArrowLineUp,
    ArrowsDownUp,
    CheckSquare,
    Funnel,
    PencilSimple,
    Plus,
    Trash,
    UploadSimple
} from '@phosphor-icons/react';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DBImage, ReidRunWithStats } from '../../types/electron';

// Hooks
import { useGroupActions } from '../../hooks/useGroupActions';
import { useImageLoader } from '../../hooks/useImageLoader';
import { useImageMetadata } from '../../hooks/useImageMetadata';
import { useLibraryData } from '../../hooks/useLibraryData';
import { useSelection } from '../../hooks/useSelection';

// Components
import { GroupNameDialog } from '../../components/GroupNameDialog';
import { LibraryFilter } from '../../components/library/LibraryFilterDialog';
import { MediaExplorer } from '../../components/library/MediaExplorer';
import { LiquidGlassButton } from '../../components/LiquidGlassButton';
import { OnboardingTour } from '../../components/OnboardingTour';
import { RefreshNotification } from '../../components/RefreshNotification';

// Utils
import { triggerUpload } from '../../utils/navigationEvents';

type SortOption = 'default' | 'species' | 'individual' | 'name';

const LibraryPage: React.FC = () => {
    const theme = useTheme();
    const { leftSidebarOpen, rightSidebarOpen } = useOutletContext<{ leftSidebarOpen: boolean; rightSidebarOpen: boolean }>();

    // Scroll state for floating buttons
    const [isScrolled, setIsScrolled] = useState(false);

    // 1. Filter & Search State (Must be defined before data loading)
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<LibraryFilter | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Sort State
    const [sortBy, setSortBy] = useState<SortOption>('default');
    const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null);

    // ReID Run Filter State (linked to "By Individual" sort)
    const [reidRuns, setReidRuns] = useState<ReidRunWithStats[]>([]);
    const [selectedReidRunId, setSelectedReidRunId] = useState<number | null>(null);
    const [individualSubmenuPos, setIndividualSubmenuPos] = useState<{ top: number; left: number } | null>(null);

    // Construct DB Filter
    const dbFilter = useMemo(() => ({
        date: activeFilter?.date || null,
        groupIds: activeFilter?.groupIds || null,
        searchQuery: searchQuery || undefined
    }), [activeFilter, searchQuery]);

    // 2. Data & Loading
    // Fetch Full Library (for Filter Dialog metadata)
    const { dateSections: fullDateSections, refreshLibrary: refreshFullLibrary } = useLibraryData();

    // Fetch Filtered Library (for View)
    const { dateSections: filteredDateSections, loading, refreshLibrary: refreshFilteredLibrary } = useLibraryData(dbFilter);

    // Available species for ReID
    const [availableSpecies, setAvailableSpecies] = useState<string[]>([]);
    useEffect(() => {
        window.api.getAvailableSpecies().then(result => {
            if (result.ok && result.species) {
                setAvailableSpecies(result.species);
            }
        });
    }, []);

    // Fetch ReID Runs
    const fetchReidRuns = useCallback(async () => {
        const result = await window.api.getReidRuns();
        if (result.ok && result.runs) {
            setReidRuns(result.runs);
        }
    }, []);

    useEffect(() => {
        fetchReidRuns();
    }, [fetchReidRuns]);

    // Unified Refresh (includes metadata refresh)
    const refreshLibrary = async () => {
        await Promise.all([refreshFullLibrary(), refreshFilteredLibrary(), fetchReidRuns()]);
        // Also refresh metadata (detections/reid) - done after images refresh
        refreshMetadata();
    };

    // Listen for refresh events from TaskPanel
    useEffect(() => {
        const handleRefresh = (e: CustomEvent<{ page: string }>) => {
            if (e.detail.page === 'library') {
                refreshLibrary();
            }
        };
        window.addEventListener('trigger-refresh', handleRefresh as EventListener);
        return () => window.removeEventListener('trigger-refresh', handleRefresh as EventListener);
    }, [refreshFullLibrary, refreshFilteredLibrary]);

    // 3. Image Loading
    const { imageUrls, fullImageUrls, loadImage, loadFullImage } = useImageLoader();

    // 4. Selection
    const {
        isSelectionMode,
        selectedIds: selectedImageIds,
        toggleSelectionMode,
        toggleItem: toggleImageSelection,
        clearSelection,
        setIsSelectionMode,
        setSelection
    } = useSelection<number>();

    // 5. Group Actions
    const {
        anchorEl,
        renameDialogOpen,
        groupToRename,
        setRenameDialogOpen,
        setGroupToRename,
        handleMenuOpen,
        handleMenuClose,
        handleDeleteGroup,
        handleRenameGroupClick,
        handleConfirmRename
    } = useGroupActions(refreshLibrary, fullDateSections);

    // Derived State
    const rawImages = useMemo(() => {
        return filteredDateSections.flatMap(section => section.groups.flatMap(group => group.images));
    }, [filteredDateSections]);

    // Fetch metadata (detections + ReID) for all images
    const imageIds = useMemo(() => rawImages.map(img => img.id), [rawImages]);
    const { metadata: imageMetadata, refresh: refreshMetadata } = useImageMetadata(imageIds);

    // Merge metadata into images
    const imagesWithMetadata = useMemo(() => {
        return rawImages.map(img => ({
            ...img,
            detections: imageMetadata[img.id]?.detections || img.detections || [],
            reidResults: imageMetadata[img.id]?.reidResults || []
        }));
    }, [rawImages, imageMetadata]);

    // Filter by ReID Run (client-side)
    const reidFilteredImages = useMemo(() => {
        if (selectedReidRunId === null) return imagesWithMetadata;
        return imagesWithMetadata.filter(img =>
            img.reidResults?.some(r => r.runId === selectedReidRunId)
        );
    }, [imagesWithMetadata, selectedReidRunId]);

    // Sort images
    const allImages = useMemo(() => {
        if (sortBy === 'default') return reidFilteredImages;

        return [...reidFilteredImages].sort((a, b) => {
            switch (sortBy) {
                case 'species': {
                    const aSpecies = a.detections?.find(d => d.label && d.label !== 'blank')?.label || '';
                    const bSpecies = b.detections?.find(d => d.label && d.label !== 'blank')?.label || '';
                    return aSpecies.localeCompare(bSpecies);
                }
                case 'individual': {
                    const aIndividual = a.reidResults?.[0]?.individualDisplayName || '';
                    const bIndividual = b.reidResults?.[0]?.individualDisplayName || '';
                    return aIndividual.localeCompare(bIndividual);
                }
                case 'name': {
                    const aName = a.original_path.split(/[\\/]/).pop() || '';
                    const bName = b.original_path.split(/[\\/]/).pop() || '';
                    return aName.localeCompare(bName);
                }
                default:
                    return 0;
            }
        });
    }, [reidFilteredImages, sortBy]);

    // Update dateSections with enriched images (keep original structure) + apply ReID filter
    const enrichedDateSections = useMemo(() => {
        return filteredDateSections.map(section => ({
            ...section,
            groups: section.groups.map(group => ({
                ...group,
                images: group.images
                    .map(img => ({
                        ...img,
                        detections: imageMetadata[img.id]?.detections || img.detections || [],
                        reidResults: imageMetadata[img.id]?.reidResults || []
                    }))
                    .filter(img => {
                        // Apply ReID run filter
                        if (selectedReidRunId === null) return true;
                        return img.reidResults?.some(r => r.runId === selectedReidRunId);
                    })
            })).filter(group => group.images.length > 0) // Remove empty groups
        })).filter(section => section.groups.length > 0); // Remove empty sections
    }, [filteredDateSections, imageMetadata, selectedReidRunId]);

    // Effect: Prune selection when filter hides items
    useEffect(() => {
        if (selectedImageIds.size === 0) return;

        const visibleIds = new Set(allImages.map(img => img.id));
        const nextSelection = new Set([...selectedImageIds].filter(id => visibleIds.has(id)));

        if (nextSelection.size !== selectedImageIds.size) {
            setSelection(nextSelection);
        }
    }, [allImages, selectedImageIds, setSelection]);

    // Effect: Ctrl+A to select all images
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'a') {
                // Prevent default browser select-all behavior
                e.preventDefault();

                // If not in selection mode, enable it first
                if (!isSelectionMode) {
                    setIsSelectionMode(true);
                }

                // Select all visible images
                const allIds = new Set(allImages.map(img => img.id));
                setSelection(allIds);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [allImages, isSelectionMode, setIsSelectionMode, setSelection]);

    // Batch Actions
    const handleBatchSave = async () => {
        if (selectedImageIds.size === 0) return;
        const paths: string[] = [];
        allImages.forEach(img => {
            if (selectedImageIds.has(img.id)) paths.push(img.original_path);
        });
        if (paths.length === 0) return;

        try {
            const result = await window.api.saveImages(paths);
            if (result.ok) {
                alert(`成功保存 ${result.successCount} 张图片。`);
                clearSelection();
            } else if (result.error !== 'Operation canceled') {
                alert(`保存失败：${result.error}`);
            }
        } catch (error) {
            console.error('Batch save error:', error);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedImageIds.size === 0) return;
        if (window.confirm(`确定要删除 ${selectedImageIds.size} 张图片吗？`)) {
            try {
                for (const id of selectedImageIds) {
                    await window.api.deleteImage(id);
                }
                await refreshLibrary();
                clearSelection();
            } catch (error) {
                console.error('Batch delete error:', error);
            }
        }
    };

    const handleBatchDetect = async () => {
        if (selectedImageIds.size === 0) return;
        const paths: string[] = [];
        const ids: number[] = [];
        allImages.forEach(img => {
            if (selectedImageIds.has(img.id)) {
                paths.push(img.original_path);
                ids.push(img.id);
            }
        });
        if (paths.length === 0) return;

        try {
            await window.api.detect(paths, (txt) => console.log(txt), ids);
            setIsSelectionMode(false);
            clearSelection();
        } catch (error) {
            console.error('Batch detect error:', error);
            alert('启动检测失败：' + error);
        }
    };

    const handleBatchReID = async (species: string) => {
        if (selectedImageIds.size === 0) return;
        const imageIds = Array.from(selectedImageIds);

        try {
            const result = await window.api.smartReID(imageIds, species);
            if (result.ok) {
                setIsSelectionMode(false);
                clearSelection();
            } else {
                alert('个体鉴别失败：' + result.error);
            }
        } catch (error) {
            console.error('Batch ReID error:', error);
            alert('启动个体鉴别失败：' + error);
        }
    };

    const handleDeleteImage = async (image: DBImage) => {
        await window.api.deleteImage(image.id);
        await refreshLibrary();
    };

    // Group-level handlers for Analyse menu
    const handleGroupClassify = async (images: DBImage[]) => {
        const paths = images.map(img => img.original_path);
        const ids = images.map(img => img.id);
        try {
            await window.api.detect(paths, (txt) => console.log(txt), ids);
        } catch (error) {
            console.error('Classification error:', error);
            alert('启动分类失败：' + error);
        }
    };

    const handleGroupReID = async (images: DBImage[], species: string) => {
        const imageIds = images.map(img => img.id);
        try {
            const result = await window.api.smartReID(imageIds, species);
            if (!result.ok) {
                alert('个体鉴别失败：' + result.error);
            }
        } catch (error) {
            console.error('ReID error:', error);
            alert('启动个体鉴别失败：' + error);
        }
    };

    return (
        <>
            <OnboardingTour page="library" />
            <RefreshNotification
                watchJobTypes={['detect', 'reid']}
                onRefresh={refreshLibrary}
                message="分类或个体鉴别已完成"
            />
            <MediaExplorer
                title="图库"
                loading={loading}
                dateSections={enrichedDateSections}
                sortBy={sortBy}
                fullDateSections={fullDateSections}
                imageUrls={imageUrls}
                fullImageUrls={fullImageUrls}
                allImages={allImages}
                loadImage={loadImage}
                loadFullImage={loadFullImage}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterDialogOpen={filterDialogOpen}
                setFilterDialogOpen={setFilterDialogOpen}
                isSelectionMode={isSelectionMode}
                selectedImageIds={selectedImageIds}
                toggleSelectionMode={toggleSelectionMode}
                toggleImageSelection={toggleImageSelection}
                setSelection={setSelection}
                clearSelection={clearSelection}
                setIsSelectionMode={setIsSelectionMode}
                onBatchDelete={handleBatchDelete}
                onBatchDetect={handleBatchDetect}
                onBatchReID={handleBatchReID}
                onBatchSave={handleBatchSave}
                availableSpecies={availableSpecies}
                aiButtonMode="analyse"
                onClassify={handleGroupClassify}
                onReID={handleGroupReID}
                onDeleteImage={handleDeleteImage}
                selectedReidRunId={selectedReidRunId}
                leftSidebarOpen={leftSidebarOpen}
                rightSidebarOpen={rightSidebarOpen}
                onUpload={triggerUpload}
                onScrollStateChange={setIsScrolled}
                headerActions={
                    <>
                        <Tooltip title="排序">
                            <IconButton
                                data-tour="library-sort"
                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setSortMenuPos({ top: rect.bottom, left: rect.right });
                                }}
                                sx={{
                                    bgcolor: sortBy !== 'default' ? (theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)') : 'transparent',
                                    '&:hover': { bgcolor: sortBy !== 'default' ? (theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.20)') : theme.palette.action.hover }
                                }}
                            >
                                <ArrowsDownUp weight={sortBy !== 'default' ? 'fill' : 'regular'} />
                            </IconButton>
                        </Tooltip>
                        <Menu
                            open={Boolean(sortMenuPos)}
                            onClose={() => setSortMenuPos(null)}
                            anchorReference="anchorPosition"
                            anchorPosition={sortMenuPos ? { top: sortMenuPos.top, left: sortMenuPos.left } : undefined}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            slotProps={{
                                paper: {
                                    elevation: 0,
                                    sx: {
                                        backgroundColor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(45, 45, 45, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                                        border: `1px solid ${theme.palette.divider}`,
                                        minWidth: '180px',
                                        p: 1,
                                        mt: 1
                                    }
                                }
                            }}
                        >
                            <MenuItem
                                onClick={() => { setSortBy('default'); setSelectedReidRunId(null); setSortMenuPos(null); }}
                                selected={sortBy === 'default'}
                                sx={{ borderRadius: '8px', py: 1 }}
                            >
                                默认
                            </MenuItem>
                            <MenuItem
                                onClick={() => { setSortBy('species'); setSelectedReidRunId(null); setSortMenuPos(null); }}
                                selected={sortBy === 'species'}
                                sx={{ borderRadius: '8px', py: 1 }}
                            >
                                按物种
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    if (reidRuns.length === 0) {
                                        // No ReID runs available
                                        setSortMenuPos(null);
                                        return;
                                    }
                                    // Show submenu at same position as sort menu (under the button)
                                    if (sortMenuPos) {
                                        setIndividualSubmenuPos({ top: sortMenuPos.top, left: sortMenuPos.left });
                                    }
                                    setSortMenuPos(null);
                                }}
                                selected={sortBy === 'individual'}
                                disabled={reidRuns.length === 0}
                                sx={{ borderRadius: '8px', py: 1, display: 'flex', justifyContent: 'space-between' }}
                            >
                                <span>按个体</span>
                                {reidRuns.length > 0 && <span style={{ opacity: 0.5, fontSize: '0.9em' }}>›</span>}
                            </MenuItem>
                            <MenuItem
                                onClick={() => { setSortBy('name'); setSelectedReidRunId(null); setSortMenuPos(null); }}
                                selected={sortBy === 'name'}
                                sx={{ borderRadius: '8px', py: 1 }}
                            >
                                按图片名称
                            </MenuItem>
                        </Menu>

                        {/* By Individual Submenu - Select ReID Run */}
                        <Menu
                            open={Boolean(individualSubmenuPos)}
                            onClose={() => setIndividualSubmenuPos(null)}
                            anchorReference="anchorPosition"
                            anchorPosition={individualSubmenuPos ? { top: individualSubmenuPos.top, left: individualSubmenuPos.left } : undefined}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            slotProps={{
                                paper: {
                                    elevation: 0,
                                    sx: {
                                        backgroundColor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(45, 45, 45, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                                        border: `1px solid ${theme.palette.divider}`,
                                        minWidth: '220px',
                                        maxHeight: '300px',
                                        p: 1,
                                        mt: 0
                                    }
                                }
                            }}
                        >
                            <MenuItem disabled sx={{ opacity: 0.6, fontSize: '0.8rem', py: 0.5 }}>
                                选择个体鉴别运行
                            </MenuItem>
                            {reidRuns.map(run => (
                                <MenuItem
                                    key={run.id}
                                    onClick={() => {
                                        setSortBy('individual');
                                        setSelectedReidRunId(run.id);
                                        setIndividualSubmenuPos(null);
                                    }}
                                    selected={sortBy === 'individual' && selectedReidRunId === run.id}
                                    sx={{ borderRadius: '8px', py: 1, display: 'flex', justifyContent: 'space-between', gap: 2 }}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.name}</span>
                                    <span style={{ opacity: 0.5, fontSize: '0.85em', flexShrink: 0 }}>{run.individual_count} ind.</span>
                                </MenuItem>
                            ))}
                        </Menu>

                        <Button data-tour="library-new-job" variant="contained" startIcon={<Plus />} onClick={triggerUpload} sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}>
                            新建任务
                        </Button>
                    </>
                }
                onGroupMenuOpen={handleMenuOpen}
                groupMenu={
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                backgroundColor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(45, 45, 45, 0.85)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                                border: `1px solid ${theme.palette.divider}`,
                                minWidth: '160px',
                                mt: 0.5
                            }
                        }}
                        MenuListProps={{ sx: { padding: '6px' } }}
                    >
                        <MenuItem onClick={handleRenameGroupClick} sx={{ borderRadius: '6px', margin: '2px 0', gap: 1 }}>
                            <PencilSimple size={18} /> Rename
                        </MenuItem>
                        <MenuItem onClick={handleDeleteGroup} sx={{ borderRadius: '6px', margin: '2px 0', gap: 1, color: 'error.main' }}>
                            <Trash size={18} /> Delete
                        </MenuItem>
                    </Menu>
                }
            />

            {/* Dialog for renaming groups */}
            <GroupNameDialog
                open={renameDialogOpen}
                onClose={() => { setRenameDialogOpen(false); setGroupToRename(null); }}
                onConfirm={handleConfirmRename}
                title="Rename Group"
                initialValue={groupToRename?.name || ''}
            />

            {/* Floating Action Buttons - Show when scrolled */}
            <Box
                sx={{
                    position: 'fixed',
                    top: 80,
                    right: rightSidebarOpen ? 228 : 16,
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 1,
                    zIndex: 1000,
                    p: 1.5,
                    opacity: isScrolled ? 1 : 0,
                    transform: isScrolled ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
                    transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease, right 0.3s ease',
                    pointerEvents: isScrolled ? 'auto' : 'none'
                }}
            >
                <Tooltip title="筛选">
                    <span>
                        <LiquidGlassButton
                            size={32}
                            icon={<Funnel size={16} weight={activeFilter ? 'fill' : 'regular'} />}
                            onClick={() => setFilterDialogOpen(true)}
                        />
                    </span>
                </Tooltip>
                <Tooltip title={isSelectionMode ? '退出选择' : '选择'}>
                    <span>
                        <LiquidGlassButton
                            size={32}
                            icon={<CheckSquare size={16} weight={isSelectionMode ? 'fill' : 'regular'} />}
                            onClick={toggleSelectionMode}
                        />
                    </span>
                </Tooltip>
                <Tooltip title="排序">
                    <span>
                        <LiquidGlassButton
                            size={32}
                            icon={<ArrowsDownUp size={16} weight={sortBy !== 'default' ? 'fill' : 'regular'} />}
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setSortMenuPos({ top: rect.bottom + 8, left: rect.right });
                            }}
                        />
                    </span>
                </Tooltip>
                <Tooltip title="上传">
                    <span>
                        <LiquidGlassButton
                            size={32}
                            icon={<UploadSimple size={16} />}
                            onClick={triggerUpload}
                        />
                    </span>
                </Tooltip>
                <Tooltip title="回到顶部">
                    <span>
                        <LiquidGlassButton
                            size={32}
                            icon={<ArrowLineUp size={16} />}
                            onClick={() => {
                                const virtuosoContainer = document.querySelector('[data-virtuoso-scroller]');
                                if (virtuosoContainer) {
                                    virtuosoContainer.scrollTo({ top: 0, behavior: 'smooth' });
                                }
                            }}
                        />
                    </span>
                </Tooltip>
            </Box>
        </>
    );
};

export default LibraryPage;
