import React, { useState, useRef, KeyboardEvent, ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Tooltip,
    CircularProgress,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PaperPlaneRight, Stop, X, Plus } from '@phosphor-icons/react';
import AgentImageModal from './AgentImageModal';

interface ImageFile {
    id: string;
    file: File;
    previewUrl: string;
    dataUrl: string | null;  // Base64 data URL once loaded
    status: 'loading' | 'ready' | 'error';
    error?: string;
}

interface AgentInputBarProps {
    onSendMessage: (message: string, images?: string[]) => void;
    isLoading: boolean;
    onStopGeneration?: () => void;
    onNewChat?: () => void;
}

const MAX_IMAGES = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB max for Gemini inline images

const AgentInputBar: React.FC<AgentInputBarProps> = ({
    onSendMessage,
    isLoading,
    onStopGeneration,
    onNewChat,
}) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [inputValue, setInputValue] = useState('');
    const [images, setImages] = useState<ImageFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Image modal state for previewing thumbnails
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [imageModalIndex, setImageModalIndex] = useState(0);

    // Guard to prevent modal auto-opening when images are added
    const lastImageAddTimeRef = useRef<number>(0);

    const handleImagePreviewClick = (index: number) => {
        // Don't open modal if image was just added (within 500ms)
        if (Date.now() - lastImageAddTimeRef.current < 500) {
            return;
        }
        setImageModalIndex(index);
        setImageModalOpen(true);
    };

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
    };

    // Convert file to base64 data URL
    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    // Process and add images
    const processFiles = async (files: File[]) => {
        const newImages: ImageFile[] = [];
        const availableSlots = MAX_IMAGES - images.length;
        const filesToAdd = files.slice(0, availableSlots);

        for (const file of filesToAdd) {
            if (!ACCEPTED_TYPES.includes(file.type)) {
                continue;
            }
            if (file.size > MAX_IMAGE_SIZE) {
                continue;
            }

            const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const previewUrl = URL.createObjectURL(file);

            newImages.push({
                id,
                file,
                previewUrl,
                dataUrl: null,
                status: 'loading',
            });
        }

        if (newImages.length === 0) return;

        setImages(prev => [...prev, ...newImages]);

        // Load data URLs in background
        for (const img of newImages) {
            try {
                const dataUrl = await fileToDataUrl(img.file);
                setImages(prev => prev.map(i =>
                    i.id === img.id
                        ? { ...i, dataUrl, status: 'ready' as const }
                        : i
                ));
            } catch (error) {
                setImages(prev => prev.map(i =>
                    i.id === img.id
                        ? { ...i, status: 'error' as const, error: 'Failed to load' }
                        : i
                ));
            }
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            lastImageAddTimeRef.current = Date.now(); // Mark add time to prevent modal auto-open
            processFiles(Array.from(event.target.files));
        }
        if (event.target) event.target.value = '';
    };

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        const filesToProcess: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file && ACCEPTED_TYPES.includes(file.type)) {
                    filesToProcess.push(file);
                }
            }
        }

        if (filesToProcess.length > 0) {
            event.preventDefault();
            lastImageAddTimeRef.current = Date.now(); // Mark add time to prevent modal auto-open
            processFiles(filesToProcess);
        }
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);

        const files = Array.from(event.dataTransfer.files);
        lastImageAddTimeRef.current = Date.now(); // Mark add time to prevent modal auto-open
        processFiles(files);
    };

    const handleRemoveImage = (imageId: string) => {
        setImages(prev => {
            const image = prev.find(i => i.id === imageId);
            if (image) {
                URL.revokeObjectURL(image.previewUrl);
            }
            return prev.filter(i => i.id !== imageId);
        });
    };

    const handleSubmit = () => {
        const trimmed = inputValue.trim();
        const readyImages = images.filter(i => i.status === 'ready' && i.dataUrl);

        if ((trimmed || readyImages.length > 0) && !isLoading) {
            const imageDataUrls = readyImages.map(i => i.dataUrl!);
            onSendMessage(trimmed, imageDataUrls.length > 0 ? imageDataUrls : undefined);
            setInputValue('');
            // Cleanup preview URLs
            images.forEach(i => URL.revokeObjectURL(i.previewUrl));
            setImages([]);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    };

    const isUploading = images.some(i => i.status === 'loading');
    const hasError = images.some(i => i.status === 'error');
    const canSend = (inputValue.trim() || images.some(i => i.status === 'ready')) && !isUploading && !hasError;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                maxWidth: '800px',
                mx: 'auto',
                p: 2,
            }}
        >
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={ACCEPTED_TYPES.join(',')}
                multiple
                style={{ display: 'none' }}
            />

            <Box
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    p: 1.5,
                    borderRadius: '20px',
                    background: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.04)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1px solid ${isDragOver
                        ? theme.palette.primary.main
                        : isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                    boxShadow: isDark
                        ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                        : '0 4px 20px rgba(0, 0, 0, 0.1)',
                    transition: 'border-color 0.2s',
                }}
            >
                {/* Image Previews */}
                {images.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1, px: 0.5 }}>
                        {images.map((img, index) => (
                            <Box
                                key={img.id}
                                sx={{
                                    position: 'relative',
                                    width: 64,
                                    height: 64,
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                                    cursor: img.status === 'ready' ? 'pointer' : 'default',
                                    '&:hover': img.status === 'ready' ? {
                                        transform: 'scale(1.02)',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                    } : {},
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                }}
                                onClick={() => img.status === 'ready' && handleImagePreviewClick(index)}
                            >
                                <img
                                    src={img.previewUrl}
                                    alt="Preview"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                                {img.status === 'loading' && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            bgcolor: 'rgba(0,0,0,0.5)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <CircularProgress size={20} sx={{ color: 'white' }} />
                                    </Box>
                                )}
                                {img.status === 'error' && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            bgcolor: 'rgba(244,67,54,0.7)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ color: 'white', fontSize: '0.6rem' }}>
                                            错误
                                        </Typography>
                                    </Box>
                                )}
                                <IconButton
                                    size="small"
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation(); // Prevent click from bubbling to parent and opening modal
                                        handleRemoveImage(img.id);
                                    }}
                                    sx={{
                                        position: 'absolute',
                                        top: 2,
                                        right: 2,
                                        width: 18,
                                        height: 18,
                                        bgcolor: 'rgba(0,0,0,0.6)',
                                        color: 'white',
                                        '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                                        p: 0,
                                    }}
                                >
                                    <X size={12} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Input Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {/* New Chat Button */}
                    <Tooltip title="新建聊天">
                        <span>
                            <IconButton
                                onClick={onNewChat}
                                disabled={isLoading}
                                size="small"
                                sx={{
                                    color: theme.palette.text.secondary,
                                    '&:hover': {
                                        background: isDark
                                            ? 'rgba(255, 255, 255, 0.1)'
                                            : 'rgba(0, 0, 0, 0.08)',
                                    },
                                }}
                            >
                                <Plus size={20} weight="bold" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    {/* Text Input */}
                    <TextField
                        inputRef={inputRef}
                        fullWidth
                        variant="standard"
                        placeholder={images.length > 0 ? "添加关于图片的消息..." : "提问任何问题..."}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        multiline
                        maxRows={4}
                        InputProps={{
                            disableUnderline: true,
                            sx: {
                                fontSize: '1rem',
                                lineHeight: 1.5,
                                px: 1,
                            },
                        }}
                        sx={{
                            flexGrow: 1,
                            '& .MuiInputBase-input': {
                                color: theme.palette.text.primary,
                                '&::placeholder': {
                                    color: theme.palette.text.secondary,
                                    opacity: 0.7,
                                },
                            },
                        }}
                    />

                    {/* Send/Stop Button */}
                    {isLoading ? (
                        onStopGeneration ? (
                            <Tooltip title="停止">
                                <IconButton
                                    onClick={onStopGeneration}
                                    size="small"
                                    sx={{
                                        color: theme.palette.error.main,
                                        '&:hover': {
                                            background: isDark
                                                ? 'rgba(244, 67, 54, 0.2)'
                                                : 'rgba(244, 67, 54, 0.1)',
                                        },
                                    }}
                                >
                                    <Stop size={22} weight="fill" />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <CircularProgress size={22} sx={{ mx: 1 }} />
                        )
                    ) : (
                        <Tooltip title="发送">
                            <span>
                                <IconButton
                                    onClick={handleSubmit}
                                    disabled={!canSend}
                                    size="small"
                                    sx={{
                                        color: canSend
                                            ? theme.palette.primary.main
                                            : theme.palette.text.disabled,
                                        '&:hover': {
                                            background: isDark
                                                ? 'rgba(255, 255, 255, 0.1)'
                                                : 'rgba(0, 0, 0, 0.08)',
                                        },
                                    }}
                                >
                                    <PaperPlaneRight size={22} weight="fill" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {/* Image Modal for previewing thumbnails */}
            {images.length > 0 && (
                <AgentImageModal
                    open={imageModalOpen}
                    onClose={() => setImageModalOpen(false)}
                    imageUrl={null}
                    images={images.filter(i => i.status === 'ready').map(i => i.dataUrl || i.previewUrl)}
                    initialIndex={imageModalIndex}
                />
            )}
        </Box>
    );
};

export default AgentInputBar;
