import { Box, Typography, alpha, useTheme, Skeleton, Tooltip } from '@mui/material';
import { useState, useEffect, useMemo } from 'react';
import {
    Sparkle, Fingerprint, Clock, FolderOpen, ChartDonut, TrendUp, CalendarBlank, Users
} from '@phosphor-icons/react';
import { triggerUpload } from '../../utils/navigationEvents';
import AiModeButton from '../../components/AiModeButton';
import { AiModeContext } from '../../contexts/AiModeContext';
import { OnboardingTour } from '../../components/OnboardingTour';
import { useColorMode } from '../../features/theme/ThemeContext';

interface DashboardStats {
    totalImages: number;
    totalGroups: number;
    totalDetections: number;
    totalSpecies: number;
    totalReidRuns: number;
    totalIndividuals: number;
    recentActivity: { type: string; name: string; count: number; date: number }[];
    speciesBreakdown?: { label: string; count: number }[];
    individualsPerSpecies?: { species: string; count: number }[];
    detectionTimeline?: { month: string; count: number }[];
    groupDistribution?: { name: string; images: number; detections: number }[];
}

// Card backgrounds from neurolink theme
const CARD_BG_LIGHT = '#F7F9FB';
const CARD_BG_DARK = '#1e1e24';
// Transparent versions for gradient themes
const CARD_BG_LIGHT_TRANSPARENT = 'rgba(247, 249, 251, 0.75)';
const CARD_BG_DARK_TRANSPARENT = 'rgba(30, 30, 36, 0.75)';

// Clean Stat Card - compact design
const StatCard = ({
    title,
    value,
    loading,
    hasGradient
}: {
    title: string;
    value: number | string;
    loading?: boolean;
    hasGradient?: boolean;
}) => {
    const theme = useTheme();
    const getBgColor = () => {
        if (hasGradient) {
            return theme.palette.mode === 'dark' ? CARD_BG_DARK_TRANSPARENT : CARD_BG_LIGHT_TRANSPARENT;
        }
        return theme.palette.mode === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT;
    };
    return (
        <Box sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: getBgColor(),
            backdropFilter: hasGradient ? 'blur(12px)' : 'none',
            WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
            transition: 'background-color 0.2s',
        }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
                {title}
            </Typography>
            {loading ? (
                <Skeleton variant="text" width={60} height={32} />
            ) : (
                <Typography variant="h5" fontWeight={600} color="text.primary">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </Typography>
            )}
        </Box>
    );
};

// Custom Ring/Donut Chart Component with hover effects
const RingChart = ({
    data,
    size = 180,
    loading
}: {
    data: { label: string; count: number; color: string }[];
    size?: number;
    loading?: boolean;
}) => {
    const theme = useTheme();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [animationProgress, setAnimationProgress] = useState(0);

    const total = data.reduce((sum, d) => sum + d.count, 0);
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Animation on mount
    useEffect(() => {
        const timer = setTimeout(() => setAnimationProgress(1), 100);
        return () => clearTimeout(timer);
    }, [data]);

    if (loading || total === 0) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    border: `${strokeWidth}px solid ${alpha(theme.palette.text.primary, 0.05)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {loading ? (
                        <Skeleton variant="circular" width={size - strokeWidth * 2} height={size - strokeWidth * 2} />
                    ) : (
                        <Typography variant="body2" color="text.secondary">暂无数据</Typography>
                    )}
                </Box>
            </Box>
        );
    }

    let currentOffset = 0;
    const segments = data.map((segment, idx) => {
        const segmentLength = (segment.count / total) * circumference * animationProgress;
        const offset = currentOffset;
        currentOffset += segmentLength;
        return { ...segment, segmentLength, offset, idx };
    });

    const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'visible' }}>
            <Box sx={{ position: 'relative', width: size + 12, height: size + 12, p: '6px', overflow: 'visible' }}>
                <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                    {segments.map((segment) => (
                        <circle
                            key={segment.idx}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth={hoveredIndex === segment.idx ? strokeWidth + 6 : strokeWidth}
                            strokeDasharray={`${segment.segmentLength} ${circumference - segment.segmentLength}`}
                            strokeDashoffset={-segment.offset}
                            strokeLinecap="round"
                            style={{
                                transition: 'stroke-dasharray 0.8s ease-out, stroke-width 0.2s ease',
                                cursor: 'pointer',
                                opacity: hoveredIndex !== null && hoveredIndex !== segment.idx ? 0.4 : 1,
                                filter: hoveredIndex === segment.idx ? 'brightness(1.1)' : 'none'
                            }}
                            onMouseEnter={() => setHoveredIndex(segment.idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                    ))}
                </svg>
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                }}>
                    {hoveredData ? (
                        <>
                            <Typography variant="h5" fontWeight={600}>{hoveredData.count}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{
                                maxWidth: 80,
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {hoveredData.label}
                            </Typography>
                        </>
                    ) : (
                        <>
                            <Typography variant="h5" fontWeight={600}>{total}</Typography>
                            <Typography variant="caption" color="text.secondary">总计</Typography>
                        </>
                    )}
                </Box>
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.slice(0, 6).map((item, idx) => (
                    <Box
                        key={idx}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 0.5,
                            borderRadius: 1,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            bgcolor: hoveredIndex === idx ? alpha(item.color, 0.15) : 'transparent',
                            '&:hover': { bgcolor: alpha(item.color, 0.15) }
                        }}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <Box sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: item.color,
                            flexShrink: 0,
                            transition: 'transform 0.2s ease',
                            transform: hoveredIndex === idx ? 'scale(1.3)' : 'scale(1)'
                        }} />
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 100 }}>
                            {item.label}
                        </Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ ml: 'auto' }}>
                            {((item.count / total) * 100).toFixed(0)}%
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

// Animated Bar Chart (horizontal) with hover effects
const BarChart = ({
    data,
    loading
}: {
    data: { label: string; value: number }[];
    loading?: boolean;
}) => {
    const theme = useTheme();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [animationProgress, setAnimationProgress] = useState(0);
    const maxValue = Math.max(...data.map(d => d.value), 1);

    // Animation on mount
    useEffect(() => {
        const timer = setTimeout(() => setAnimationProgress(1), 100);
        return () => clearTimeout(timer);
    }, [data]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} variant="rounded" height={32} />
                ))}
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.map((item, idx) => {
                const isHovered = hoveredIndex === idx;
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                return (
                    <Tooltip
                        key={idx}
                        title={`${item.label}: ${item.value.toLocaleString()}`}
                        arrow
                        placement="top"
                    >
                        <Box
                            sx={{
                                cursor: 'pointer',
                                p: 0.5,
                                mx: -0.5,
                                borderRadius: 1,
                                transition: 'background-color 0.2s ease',
                                bgcolor: isHovered ? alpha(color, 0.1) : 'transparent'
                            }}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography
                                    variant="body2"
                                    color={isHovered ? 'text.primary' : 'text.secondary'}
                                    sx={{ transition: 'color 0.2s ease', fontWeight: isHovered ? 500 : 400 }}
                                >
                                    {item.label}
                                </Typography>
                                <Typography variant="body2" fontWeight={500}>{item.value.toLocaleString()}</Typography>
                            </Box>
                            <Box sx={{
                                height: isHovered ? 10 : 8,
                                borderRadius: 4,
                                bgcolor: alpha(theme.palette.text.primary, 0.06),
                                overflow: 'hidden',
                                transition: 'height 0.2s ease'
                            }}>
                                <Box sx={{
                                    height: '100%',
                                    width: `${(item.value / maxValue) * 100 * animationProgress}%`,
                                    bgcolor: color,
                                    borderRadius: 4,
                                    transition: 'width 0.8s ease-out, filter 0.2s ease',
                                    filter: isHovered ? 'brightness(1.15)' : 'none'
                                }} />
                            </Box>
                        </Box>
                    </Tooltip>
                );
            })}
        </Box>
    );
};

// Timeline Chart - Detection activity over time (SVG line chart)
const TimelineChart = ({
    data,
    loading
}: {
    data: { month: string; count: number }[];
    loading?: boolean;
}) => {
    const theme = useTheme();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [animationProgress, setAnimationProgress] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setAnimationProgress(1), 100);
        return () => clearTimeout(timer);
    }, [data]);

    if (loading || data.length === 0) {
        return (
            <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loading ? <Skeleton variant="rounded" width="100%" height={120} /> : (
                    <Typography variant="body2" color="text.secondary">暂无时间线数据</Typography>
                )}
            </Box>
        );
    }

    const maxValue = Math.max(...data.map(d => d.count), 1);
    const width = 360;
    const height = 140;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = data.map((d, i) => ({
        x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
        y: padding.top + chartHeight - (d.count / maxValue) * chartHeight * animationProgress,
        ...d,
        idx: i
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

    const formatMonth = (m: string) => {
        const [year, month] = m.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'short' });
    };

    return (
        <Box sx={{ position: 'relative', overflow: 'visible', pt: 4, mt: -2 }}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                    <line
                        key={i}
                        x1={padding.left}
                        y1={padding.top + chartHeight * (1 - v)}
                        x2={width - padding.right}
                        y2={padding.top + chartHeight * (1 - v)}
                        stroke={alpha(theme.palette.text.primary, 0.06)}
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Area fill */}
                <path
                    d={areaPath}
                    fill={`url(#areaGradient-${theme.palette.mode})`}
                    style={{ transition: 'all 0.8s ease-out' }}
                />

                {/* Line */}
                <path
                    d={linePath}
                    fill="none"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'all 0.8s ease-out' }}
                />

                {/* Data points */}
                {points.map((p) => (
                    <g key={p.idx}>
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIndex === p.idx ? 6 : 4}
                            fill={theme.palette.background.paper}
                            stroke={CHART_COLORS[0]}
                            strokeWidth={2}
                            style={{
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                filter: hoveredIndex === p.idx ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none'
                            }}
                            onMouseEnter={() => setHoveredIndex(p.idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                        {/* Tooltip on hover */}
                        {hoveredIndex === p.idx && (
                            <g>
                                <rect
                                    x={p.x - 50}
                                    y={p.y - 35}
                                    width={100}
                                    height={24}
                                    rx={6}
                                    fill={alpha(theme.palette.text.primary, 0.9)}
                                />
                                <text
                                    x={p.x}
                                    y={p.y - 18}
                                    textAnchor="middle"
                                    fill={theme.palette.background.paper}
                                    fontSize={12}
                                    fontWeight={500}
                                >
                                    {p.count} 检测
                                </text>
                            </g>
                        )}
                    </g>
                ))}

                {/* X-axis labels */}
                {points.map((p) => (
                    <text
                        key={`label-${p.idx}`}
                        x={p.x}
                        y={height - 8}
                        textAnchor="middle"
                        fill={alpha(theme.palette.text.secondary, 0.8)}
                        fontSize={11}
                    >
                        {formatMonth(p.month)}
                    </text>
                ))}

                {/* Gradient definition */}
                <defs>
                    <linearGradient id={`areaGradient-${theme.palette.mode}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                    </linearGradient>
                </defs>
            </svg>
        </Box>
    );
};

// Population Bar Chart - Individuals per species (vertical bars)
const PopulationChart = ({
    data,
    loading
}: {
    data: { species: string; count: number }[];
    loading?: boolean;
}) => {
    const theme = useTheme();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [animationProgress, setAnimationProgress] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setAnimationProgress(1), 100);
        return () => clearTimeout(timer);
    }, [data]);

    if (loading || data.length === 0) {
        return (
            <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loading ? <Skeleton variant="rounded" width="100%" height={120} /> : (
                    <Typography variant="body2" color="text.secondary">尚未追踪任何个体</Typography>
                )}
            </Box>
        );
    }

    const maxValue = Math.max(...data.map(d => d.count), 1);
    const width = 360;
    const height = 160;
    const padding = { top: 20, right: 10, bottom: 40, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = Math.min(40, chartWidth / data.length - 12);
    const gap = (chartWidth - barWidth * data.length) / (data.length + 1);

    return (
        <Box sx={{ position: 'relative' }}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                {/* Grid lines */}
                {[0, 0.5, 1].map((v, i) => (
                    <line
                        key={i}
                        x1={padding.left}
                        y1={padding.top + chartHeight * (1 - v)}
                        x2={width - padding.right}
                        y2={padding.top + chartHeight * (1 - v)}
                        stroke={alpha(theme.palette.text.primary, 0.06)}
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Bars */}
                {data.map((d, i) => {
                    const barHeight = (d.count / maxValue) * chartHeight * animationProgress;
                    const x = padding.left + gap + i * (barWidth + gap);
                    const y = padding.top + chartHeight - barHeight;
                    const isHovered = hoveredIndex === i;
                    const color = CHART_COLORS[i % CHART_COLORS.length];

                    return (
                        <g key={i}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                rx={6}
                                fill={color}
                                style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    filter: isHovered ? 'brightness(1.15) drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : 'none',
                                    transform: isHovered ? 'translateY(-2px)' : 'none',
                                    transformOrigin: `${x + barWidth / 2}px ${y + barHeight}px`
                                }}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            />

                            {/* Value label */}
                            <text
                                x={x + barWidth / 2}
                                y={y - 6}
                                textAnchor="middle"
                                fill={theme.palette.text.primary}
                                fontSize={12}
                                fontWeight={600}
                                style={{
                                    opacity: animationProgress,
                                    transition: 'opacity 0.3s ease 0.5s'
                                }}
                            >
                                {d.count}
                            </text>

                            {/* Species label */}
                            <text
                                x={x + barWidth / 2}
                                y={height - 8}
                                textAnchor="middle"
                                fill={isHovered ? theme.palette.text.primary : alpha(theme.palette.text.secondary, 0.8)}
                                fontSize={10}
                                style={{
                                    transition: 'fill 0.2s ease',
                                    fontWeight: isHovered ? 500 : 400
                                }}
                            >
                                {d.species.length > 8 ? d.species.slice(0, 7) + '…' : d.species}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </Box>
    );
};

// Activity Item Component - cleaner design
const ActivityItem = ({
    type,
    name,
    count,
    date
}: {
    type: string;
    name: string;
    count: number;
    date: number;
}) => {
    const theme = useTheme();
    const typeConfig: Record<string, { icon: React.ElementType; label: string }> = {
        group: { icon: FolderOpen, label: '已上传' },
        classification: { icon: Sparkle, label: '已分类' },
        reid: { icon: Fingerprint, label: '已鉴别' }
    };
    const config = typeConfig[type] || typeConfig.group;
    const Icon = config.icon;

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return `${days} 天前`;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            '&:last-child': { borderBottom: 'none' }
        }}>
            <Box sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex'
            }}>
                <Icon size={18} weight="duotone" color={theme.palette.primary.main} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>{name}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {config.label} • {count} 项
                </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {formatDate(date)}
            </Typography>
        </Box>
    );
};

// Chart colors from SnowUI design palette
const CHART_COLORS = [
    '#95A4FC', // Purple/Blue
    '#BAEDBD', // Light Green
    '#B1E3FF', // Light Blue
    '#A8C5DA', // Gray Blue
    '#A1E3CB', // Teal
    '#FFB1C1', // Light Pink
];

export default function Dashboard() {
    const theme = useTheme();
    const { colorTheme } = useColorMode();
    const hasGradient = colorTheme.gradient !== 'none' || !!colorTheme.special || !!colorTheme.image;
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    // AI Button Effect State
    const [shouldPlayEffect, setShouldPlayEffect] = useState(false);

    // Trigger effect once on mount
    useEffect(() => {
        setShouldPlayEffect(true);
        const timer = setTimeout(() => setShouldPlayEffect(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const res = await window.api.getDashboardStats();
                console.log('[Dashboard] getDashboardStats response:', res);
                if (res.ok && res.stats) {
                    console.log('[Dashboard] Stats received:', res.stats);
                    setStats(res.stats);
                } else {
                    console.error('[Dashboard] getDashboardStats failed:', res.error);
                }
            } catch (e) {
                console.error('Failed to load dashboard stats:', e);
            }
            setLoading(false);
        };
        loadStats();
    }, []);

    // Prepare species data for ring chart
    const speciesChartData = useMemo(() => {
        if (!stats?.speciesBreakdown || stats.speciesBreakdown.length === 0) {
            // Fallback: create from totalSpecies if no breakdown
            if (stats?.totalDetections && stats?.totalSpecies) {
                return [
                    { label: `${stats.totalSpecies} Species`, count: stats.totalDetections, color: CHART_COLORS[0] }
                ];
            }
            return [];
        }
        return stats.speciesBreakdown.map((s, i) => ({
            label: s.label,
            count: s.count,
            color: CHART_COLORS[i % CHART_COLORS.length]
        }));
    }, [stats]);

    // Summary stats for bar chart
    const summaryBarData = useMemo(() => [
        { label: '图片', value: stats?.totalImages || 0 },
        { label: '检测', value: stats?.totalDetections || 0 },
        { label: '个体', value: stats?.totalIndividuals || 0 },
        { label: '个体鉴别运行', value: stats?.totalReidRuns || 0 },
    ], [stats]);

    return (
        <Box sx={{ pt: '64px', px: 3, pb: 4, minHeight: '100vh' }}>
            <OnboardingTour page="dashboard" />
            {/* Header */}
            <Box sx={{ py: 3, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h5" fontWeight={600}>仪表板</Typography>
                    <Typography variant="body2" color="text.secondary">
                        基于深度学习的鱼类识别系统，此为开发演示版。开春后有大量数据，性能会大幅提升。
                    </Typography>
                </Box>
                <Box data-tour="new-job">
                    <AiModeContext.Provider value={{ shouldPlayEffect, setShouldPlayEffect }}>
                        <AiModeButton
                            text="新建任务"
                            onClick={triggerUpload}
                        />
                    </AiModeContext.Provider>
                </Box>
            </Box>

            {/* Top Stats Row - 4 cards */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 2,
                mb: 3
            }}>
                <StatCard title="总图片" value={stats?.totalImages || 0} loading={loading} hasGradient={hasGradient} />
                <StatCard title="检测" value={stats?.totalDetections || 0} loading={loading} hasGradient={hasGradient} />
                <StatCard title="个体" value={stats?.totalIndividuals || 0} loading={loading} hasGradient={hasGradient} />
                <StatCard title="组" value={stats?.totalGroups || 0} loading={loading} hasGradient={hasGradient} />
            </Box>

            {/* Row 1 - Species Distribution & Population Tracking */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
                {/* Species Distribution Ring Chart */}
                <Box sx={{
                    p: 3,
                    borderRadius: '16px',
                    bgcolor: hasGradient
                        ? (theme.palette.mode === 'dark' ? CARD_BG_DARK_TRANSPARENT : CARD_BG_LIGHT_TRANSPARENT)
                        : (theme.palette.mode === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT),
                    backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    overflow: 'visible',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                        <ChartDonut size={20} weight="duotone" color={theme.palette.primary.main} />
                        <Typography variant="subtitle1" fontWeight={600}>物种分布</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, mt: -2 }}>
                        所有图片中检测到的物种分解
                    </Typography>
                    <RingChart data={speciesChartData} loading={loading} />
                </Box>

                {/* Individuals Per Species - Population Tracking */}
                <Box sx={{
                    p: 3,
                    borderRadius: '16px',
                    bgcolor: hasGradient
                        ? (theme.palette.mode === 'dark' ? CARD_BG_DARK_TRANSPARENT : CARD_BG_LIGHT_TRANSPARENT)
                        : (theme.palette.mode === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT),
                    backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                        <Users size={20} weight="duotone" color={theme.palette.primary.main} />
                        <Typography variant="subtitle1" fontWeight={600}>种群追踪</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, mt: -2 }}>
                        每个物种鉴别出的独特个体
                    </Typography>
                    <PopulationChart data={stats?.individualsPerSpecies || []} loading={loading} />
                </Box>
            </Box>

            {/* Row 2 - Detection Timeline & Data Summary */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
                {/* Detection Activity Timeline */}
                <Box sx={{
                    p: 3,
                    borderRadius: '16px',
                    bgcolor: hasGradient
                        ? (theme.palette.mode === 'dark' ? CARD_BG_DARK_TRANSPARENT : CARD_BG_LIGHT_TRANSPARENT)
                        : (theme.palette.mode === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT),
                    backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    overflow: 'visible',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                        <CalendarBlank size={20} weight="duotone" color={theme.palette.primary.main} />
                        <Typography variant="subtitle1" fontWeight={600}>检测活动</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, mt: -2 }}>
                        过去6个月的野生动物检测
                    </Typography>
                    <TimelineChart data={stats?.detectionTimeline || []} loading={loading} />
                </Box>

                {/* Summary Bar Chart */}
                <Box sx={{
                    p: 3,
                    borderRadius: '16px',
                    bgcolor: hasGradient
                        ? (theme.palette.mode === 'dark' ? CARD_BG_DARK_TRANSPARENT : CARD_BG_LIGHT_TRANSPARENT)
                        : (theme.palette.mode === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT),
                    backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                        <TrendUp size={20} weight="duotone" color={theme.palette.primary.main} />
                        <Typography variant="subtitle1" fontWeight={600}>数据汇总</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, mt: -2 }}>
                        已处理野生动物数据概览
                    </Typography>
                    <BarChart data={summaryBarData} loading={loading} />
                </Box>
            </Box>

            {/* Bottom Section - Recent Activity */}
            <Box sx={{
                p: 3,
                borderRadius: '16px',
                bgcolor: hasGradient
                    ? (theme.palette.mode === 'dark' ? CARD_BG_DARK_TRANSPARENT : CARD_BG_LIGHT_TRANSPARENT)
                    : (theme.palette.mode === 'dark' ? CARD_BG_DARK : CARD_BG_LIGHT),
                backdropFilter: hasGradient ? 'blur(12px)' : 'none',
                WebkitBackdropFilter: hasGradient ? 'blur(12px)' : 'none',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Clock size={20} weight="duotone" color={theme.palette.primary.main} />
                    <Typography variant="subtitle1" fontWeight={600}>最近活动</Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} variant="rounded" height={52} />
                        ))}
                    </Box>
                ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
                    <Box>
                        {stats.recentActivity.map((activity, idx) => (
                            <ActivityItem
                                key={idx}
                                type={activity.type}
                                name={activity.name}
                                count={activity.count}
                                date={activity.date}
                            />
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Clock size={40} weight="thin" color={theme.palette.text.disabled} />
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                            尚无最近活动
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            在图库中开始上传图片
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
