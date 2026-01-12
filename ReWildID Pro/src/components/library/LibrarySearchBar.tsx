import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, TextField, InputAdornment, IconButton, Tooltip, useTheme } from '@mui/material';
import { MagnifyingGlass, X } from '@phosphor-icons/react';

interface LibrarySearchBarProps {
    value?: string;
    onSearch: (query: string) => void;
}

export const LibrarySearchBar: React.FC<LibrarySearchBarProps> = ({ value = '', onSearch }) => {
    const theme = useTheme();
    const [inputValue, setInputValue] = useState(value);
    const [isExpanded, setIsExpanded] = useState(!!value);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Sync with controlled value
    useEffect(() => {
        setInputValue(value);
        if (value) setIsExpanded(true);
    }, [value]);

    // Debounced search
    const handleChange = useCallback((newValue: string) => {
        setInputValue(newValue);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onSearch(newValue);
        }, 300);
    }, [onSearch]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const handleBlur = () => {
        // Only collapse if empty
        if (!inputValue.trim()) {
            setIsExpanded(false);
        }
    };

    const handleClear = () => {
        setInputValue('');
        onSearch('');
        setIsExpanded(false);
    };

    const handleExpand = () => {
        setIsExpanded(true);
        // Focus after expansion animation
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    return (
        <Box sx={{
            width: isExpanded ? '220px' : '40px',
            transition: 'width 0.3s ease-in-out',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'flex-end'
        }}>
            {isExpanded ? (
                <TextField
                    inputRef={inputRef}
                    autoFocus
                    placeholder="搜索图片..."
                    size="small"
                    value={inputValue}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <MagnifyingGlass size={18} color={theme.palette.text.secondary} />
                            </InputAdornment>
                        ),
                        endAdornment: inputValue ? (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onMouseDown={(e: React.MouseEvent) => e.preventDefault()} // Prevent blur before click
                                    onClick={handleClear}
                                    sx={{ p: 0.5 }}
                                >
                                    <X size={14} />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                        sx: {
                            borderRadius: 2,
                            bgcolor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)',
                            width: '100%',
                            '& fieldset': { border: 'none' }
                        }
                    }}
                />
            ) : (
                <Tooltip title={inputValue ? `搜索：${inputValue}` : "搜索"}>
                    <IconButton
                        onClick={handleExpand}
                        color={inputValue ? 'inherit' : 'default'}
                        sx={{
                            bgcolor: inputValue ? (theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)') : 'transparent',
                            '&:hover': { bgcolor: inputValue ? (theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.20)') : theme.palette.action.hover }
                        }}
                    >
                        <MagnifyingGlass weight={inputValue ? "fill" : "regular"} />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );
};
