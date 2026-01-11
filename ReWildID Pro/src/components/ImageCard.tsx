import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Card, CardMedia, Fade, useTheme, Tooltip } from '@mui/material';
import { FileDetails } from '../types/electron';
import { CheckCircle, Circle, CloudCheck } from '@phosphor-icons/react';

interface ImageCardProps {
    file: FileDetails;
    date: string;
    loadImage: (date: string, path: string) => Promise<void>;
    imageUrl?: string;
    cloudUrl?: string; // New prop
    onClick: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelection?: () => void;
    showNames?: boolean;
    onLongPress?: () => void;
    onPointerEnter?: () => void;
    onPointerDown?: (e: React.PointerEvent) => void;
    badge?: React.ReactNode;
    badgeBottomLeft?: React.ReactNode;
    aspectRatio?: string;
    isPlaceholder?: boolean;
}

const ImageCard: React.FC<ImageCardProps> = ({
    file,
    date,
    loadImage,
    imageUrl,
    cloudUrl,
    onClick,
    selectable = false,
    selected = false,
    onToggleSelection,
    showNames = false,
    onLongPress,
    onPointerEnter,
    onPointerDown,
    badge,
    badgeBottomLeft,
    aspectRatio = '1.618/1',
    isPlaceholder = false
}) => {
    const theme = useTheme();
    const [isLoaded, setIsLoaded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    // Load image immediately on mount - Virtuoso already handles virtualization
    useEffect(() => {
        if (!imageUrl || isPlaceholder) {
            loadImage(date, file.path);
        }
    }, [imageUrl, date, file.path, loadImage, isPlaceholder]);

    // Long Press Logic
    const handlePointerDown = (e: React.PointerEvent) => {
        if (onPointerDown) onPointerDown(e);

        if (onLongPress) {
            longPressTimer.current = setTimeout(() => {
                onLongPress();
            }, 500);
        }
    };

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handlePointerLeave = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (selectable && onToggleSelection) {
            // Selection logic is handled by onPointerDown to support drag-select
            // We prevent default click handling to avoid double-toggling
            e.stopPropagation();
        } else {
            // If not in selection mode, normal click opens the image
            onClick();
        }
    };

    // Selection Icon Logic
    const getSelectionIcon = () => {
        if (selected) {
            // Selected: Filled check with adaptive colors
            const checkColor = theme.palette.mode === 'light' ? 'black' : 'white';
            const bgColor = theme.palette.mode === 'light' ? 'white' : 'black';
            return (
                <Box sx={{
                    bgcolor: bgColor,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    width: 24,
                    height: 24
                }}>
                    <CheckCircle size={24} weight="fill" color={checkColor} />
                </Box>
            );
        } else {
            // Unselected: Empty circle
            return (
                <Circle size={24} color="white" weight="regular" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))', opacity: 0.8 }} />
            );
        }
    };

    return (
        <Card
            ref={cardRef}
            onClick={handleCardClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerEnter={onPointerEnter}
            sx={{
                borderRadius: 3,
                overflow: 'hidden',
                boxShadow: 'none', // Removed border style
                aspectRatio: aspectRatio,
                position: 'relative',
                bgcolor: theme.palette.action.hover,
                cursor: 'pointer',
                transform: selected ? 'scale(0.98)' : 'scale(1)',
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                    transform: selected ? 'scale(0.98)' : 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                },
                minHeight: '35px'
            }}
        >
            {imageUrl && (
                <Fade in={isLoaded} timeout={800}>
                    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                        <CardMedia
                            component="img"
                            image={imageUrl}
                            alt={file.name}
                            draggable="false"
                            onLoad={() => setIsLoaded(true)}
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'filter 0.3s ease',
                                // "Light up" effect instead of dimming
                                filter: 'none',
                                userSelect: 'none',
                                WebkitUserDrag: 'none'
                            }}
                        />

                        {/* Light up overlay */}
                        {selected && (
                            <Box sx={{
                                position: 'absolute',
                                inset: 0,
                                bgcolor: 'rgba(255, 255, 255, 0.15)',
                                zIndex: 1,
                                pointerEvents: 'none'
                            }} />
                        )}

                        {/* Selection Icon */}
                        {(selectable || selected) && ( // Show if selectable OR already selected
                            <Box sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                zIndex: 2,
                                cursor: 'pointer'
                            }}
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    onToggleSelection && onToggleSelection();
                                }}
                            >
                                {getSelectionIcon()}
                            </Box>
                        )}

                        {/* Top Right Container (Cloud Icon + Badge) */}
                        <Box sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 2,
                            display: 'flex',
                            gap: 0.5,
                            alignItems: 'center',
                            pointerEvents: 'none'
                        }}>
                            {/* Cloud Icon (Hover only) */}
                            {cloudUrl && (
                                <Tooltip title="Uploaded to Cloud" placement="top">
                                    <Box sx={{
                                        opacity: 0,
                                        transition: 'opacity 0.2s ease',
                                        '.MuiCard-root:hover &': {
                                            opacity: 1
                                        },
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: 'white',
                                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
                                    }}>
                                        <CloudCheck size={20} weight="fill" />
                                    </Box>
                                </Tooltip>
                            )}

                            {/* Existing Badge */}
                            {badge}
                        </Box>

                        {/* Badge (ReID Name) - moves to top-right under species when selection mode */}
                        {badgeBottomLeft && (
                            <Box sx={{
                                position: 'absolute',
                                top: (selectable || selected) ? 36 : 10,
                                left: (selectable || selected) ? 'auto' : 8,
                                right: (selectable || selected) ? 11 : 'auto',
                                zIndex: 2,
                                pointerEvents: 'none',
                                transition: 'top 0.15s ease'
                            }}>
                                {badgeBottomLeft}
                            </Box>
                        )}

                        <Box sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            pointerEvents: 'none' // Pass through interactions
                        }}>
                            <Box sx={{
                                height: '40px',
                                background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)',
                                opacity: selected ? 1 : 0,
                                transition: 'opacity 0.3s ease',
                                '.MuiCard-root:hover &': {
                                    opacity: 1
                                }
                            }} />

                            <Box sx={{
                                p: 1.5,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                                color: 'white',
                                opacity: (selected || showNames) ? 1 : 0,
                                transition: 'opacity 0.3s ease',
                                '.MuiCard-root:hover &': {
                                    opacity: 1
                                }
                            }}>
                                <Typography
                                    variant="body2"
                                    noWrap
                                    sx={{
                                        fontWeight: 500,
                                        textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    {file.name}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Fade>
            )}
        </Card>
    );
};

export default ImageCard;
