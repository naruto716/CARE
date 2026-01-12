import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, IconButton, useTheme } from '@mui/material';
import { X } from '@phosphor-icons/react';

interface GroupNameDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (name: string) => void;
    title?: string;
    initialValue?: string;
}

export const GroupNameDialog: React.FC<GroupNameDialogProps> = ({
    open,
    onClose,
    onConfirm,
    title = '输入组名',
    initialValue = ''
}) => {
    const [name, setName] = useState(initialValue);
    const [error, setError] = useState('');
    const theme = useTheme();

    useEffect(() => {
        if (open) {
            setName(initialValue);
            setError('');
        }
    }, [open, initialValue]);

    const handleSubmit = () => {
        if (!name.trim()) {
            setError('组名不能为空');
            return;
        }
        onConfirm(name.trim());
        setName('');
        setError('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: theme.palette.mode === 'light'
                        ? 'rgba(255, 255, 255, 0.90)'
                        : 'rgba(45, 45, 45, 0.90)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    boxShadow: theme.palette.mode === 'light'
                        ? '0 8px 32px rgba(0, 0, 0, 0.08)'
                        : '0 8px 32px rgba(0, 0, 0, 0.4)',
                    border: theme.palette.mode === 'light'
                        ? '1px solid rgba(230, 230, 230, 0.85)'
                        : '1px solid rgba(70, 70, 70, 0.85)',
                }
            }}
            BackdropProps={{
                sx: {
                    backdropFilter: 'blur(4px)',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pb: 1,
                fontWeight: 600
            }}>
                {title}
                <IconButton
                    onClick={onClose}
                    size="small"
                    sx={{
                        color: 'text.secondary',
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'light'
                                ? 'rgba(0, 0, 0, 0.04)'
                                : 'rgba(255, 255, 255, 0.08)'
                        }
                    }}
                >
                    <X size={20} />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label="组名"
                    fullWidth
                    variant="outlined"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (error) setError('');
                    }}
                    onKeyPress={handleKeyPress}
                    error={!!error}
                    helperText={error}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                        }
                    }}
                />
            </DialogContent>
            <DialogActions sx={{ p: 2.5, pt: 1 }}>
                <Button
                    onClick={onClose}
                    sx={{
                        textTransform: 'none',
                        borderRadius: '8px',
                        px: 3,
                        color: 'text.secondary',
                        backgroundColor: theme.palette.mode === 'light'
                            ? 'rgba(0, 0, 0, 0.04)'
                            : 'rgba(255, 255, 255, 0.08)',
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'light'
                                ? 'rgba(0, 0, 0, 0.08)'
                                : 'rgba(255, 255, 255, 0.12)'
                        }
                    }}
                >
                    取消
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    sx={{
                        textTransform: 'none',
                        borderRadius: '8px',
                        px: 3,
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                        }
                    }}
                >
                    确认
                </Button>
            </DialogActions>
        </Dialog>
    );
};
