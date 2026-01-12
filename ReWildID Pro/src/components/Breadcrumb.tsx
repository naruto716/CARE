import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';

// Translation map for route paths
const ROUTE_TRANSLATIONS: Record<string, string> = {
    'library': '图库',
    'dashboard': '仪表板',
    'classification': '分类',
    'reid': '个体鉴别',
    'agent': 'AI助手',
    'settings': '设置',
};

function translateRoute(route: string): string {
    return ROUTE_TRANSLATIONS[route.toLowerCase()] || route.charAt(0).toUpperCase() + route.slice(1);
}

interface BreadcrumbProps {
    customItems?: { label: string; path: string }[];
}

export default function Breadcrumb({ customItems }: BreadcrumbProps) {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    const linkSx = {
        transition: 'color 0.15s ease',
        '&:hover': {
            color: 'text.primary'
        }
    };

    return (
        <Box role="presentation" sx={{ ml: 2, width: 'fit-content', flexShrink: 0, flexGrow: 0 }}>
            <Breadcrumbs aria-label="breadcrumb">
                <Link component={RouterLink} underline="none" color="text.secondary" to="/" sx={linkSx}>
                    主页
                </Link>
                {customItems ? (
                    customItems.map((item, index) => {
                        const isLast = index === customItems.length - 1;
                        return isLast ? (
                            <Typography color="text.primary" key={item.path}>{item.label}</Typography>
                        ) : (
                            <Link component={RouterLink} underline="none" color="text.secondary" to={item.path} key={item.path} sx={linkSx}>
                                {item.label}
                            </Link>
                        );
                    })
                ) : (
                    pathnames.map((value, index) => {
                        const last = index === pathnames.length - 1;
                        const to = `/${pathnames.slice(0, index + 1).join('/')}`;

                        return last ? (
                            <Typography color="text.primary" key={to}>
                                {translateRoute(value)}
                            </Typography>
                        ) : (
                            <Link component={RouterLink} underline="none" color="text.secondary" to={to} key={to} sx={linkSx}>
                                {translateRoute(value)}
                            </Link>
                        );
                    })
                )}
            </Breadcrumbs>
        </Box>
    );
}

