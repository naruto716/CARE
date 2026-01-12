import { useEffect, useRef } from 'react';
import { driver, DriveStep } from 'driver.js';
import { useTheme } from '@mui/material';
import 'driver.js/dist/driver.css';
import '../styles/driver-theme.css';

// Tour step definitions for each page
const DASHBOARD_STEPS: DriveStep[] = [
    {
        element: '[data-tour="new-job"]',
        popover: {
            title: '欢迎使用ReWildID! 🎉',
            description: '点击这里开始新任务。你也可以在应用中的任何地方拖放文件夹！',
            side: 'bottom',
            align: 'end',
        },
    },
    {
        element: '[data-tour="nav-dashboard"]',
        popover: {
            title: '仪表板',
            description: '仪表板显示你的项目概览 - 统计数据、最近活动和见解。',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '[data-tour="nav-library"]',
        popover: {
            title: '图库',
            description: '图库是你的统一工作区，用于浏览图片、运行AI分类和重新鉴别个体。',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '[data-tour="nav-classification"]',
        popover: {
            title: '分类',
            description: '分类是AI检测和识别你图片中物种的地方。',
            side: 'right',
            align: 'start',
        },
    },
    {
        element: '[data-tour="nav-reid"]',
        popover: {
            title: '个体鉴别',
            description: '个体鉴别使用AI识别技术在图片中追踪单个动物。',
            side: 'right',
            align: 'start',
        },
    },
];

const LIBRARY_STEPS: DriveStep[] = [
    {
        element: '[data-tour="library-filter"]',
        popover: {
            title: '筛选',
            description: '按日期、组或其他条件筛选图片。',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '[data-tour="library-select"]',
        popover: {
            title: '选择模式',
            description: '进入选择模式以选择多张图片进行批量操作。你也可以长按任何图片开始选择！',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '[data-tour="library-sort"]',
        popover: {
            title: '排序图片',
            description: '按物种、个体（来自个体鉴别运行）或文件名排序图片。',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '[data-tour="library-analyse"]',
        popover: {
            title: '使用AI分析 ✨',
            description: '在任何组上点击分析以运行AI分类或个体鉴别。',
            side: 'left',
            align: 'start',
        },
    },
    {
        element: '[data-tour="library-grid"]',
        popover: {
            title: '缩放预览 🔍',
            description: '使用Ctrl + 滚轮（或在触摸板上换指）放大/缩小图片网格！',
            side: 'top',
            align: 'center',
        },
    },
];

// LocalStorage keys for tracking tour completion
const TOUR_KEYS = {
    dashboard: 'tour_completed_dashboard',
    library: 'tour_completed_library',
    classification: 'tour_completed_classification',
};

interface OnboardingTourProps {
    page: 'dashboard' | 'library' | 'classification';
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ page }) => {
    const theme = useTheme();
    const driverRef = useRef<ReturnType<typeof driver> | null>(null);

    // Set data-theme attribute on body for CSS styling
    useEffect(() => {
        document.body.setAttribute('data-theme', theme.palette.mode);
        return () => {
            document.body.removeAttribute('data-theme');
        };
    }, [theme.palette.mode]);

    useEffect(() => {
        const tourKey = TOUR_KEYS[page];
        const hasCompletedTour = localStorage.getItem(tourKey);

        if (hasCompletedTour) return;

        // Get steps based on page
        let steps: DriveStep[];
        switch (page) {
            case 'dashboard':
                steps = DASHBOARD_STEPS;
                break;
            case 'library':
                steps = LIBRARY_STEPS;
                break;
            case 'classification':
                steps = LIBRARY_STEPS.slice(0, 3); // Reuse first 3 library steps
                break;
            default:
                return;
        }

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            // Check if first target exists
            const firstTarget = document.querySelector(steps[0].element as string);
            if (!firstTarget) {
                localStorage.setItem(tourKey, 'true');
                return;
            }

            // Create driver instance
            driverRef.current = driver({
                showProgress: true,
                animate: true,
                allowClose: true,
                stagePadding: 8,
                stageRadius: 8,
                popoverClass: 'driverjs-theme',
                steps: steps,
                onDestroyStarted: () => {
                    localStorage.setItem(tourKey, 'true');
                    driverRef.current?.destroy();
                },
                onDestroyed: () => {
                    localStorage.setItem(tourKey, 'true');
                },
            });

            driverRef.current.drive();
        }, 800);

        return () => {
            clearTimeout(timer);
            if (driverRef.current) {
                driverRef.current.destroy();
            }
        };
    }, [page]);

    return null; // This component doesn't render anything
};

// Helper function to reset all tours (for settings page)
export const resetAllTours = () => {
    Object.values(TOUR_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
};

export default OnboardingTour;
