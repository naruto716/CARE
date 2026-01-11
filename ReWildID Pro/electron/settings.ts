/**
 * Settings Storage for CARE ReWildID Pro
 * 
 * Stores application settings including optional AWS credentials.
 * Uses a simple JSON file in the app data directory.
 */

import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

export interface AppSettings {
    aws?: {
        accessKeyId?: string;
        secretAccessKey?: string;
        region?: string;
        bucket?: string;
    };
    // Future settings can be added here
}

const defaultSettings: AppSettings = {
    aws: {
        region: 'ap-southeast-2',
        bucket: 'fish-reid-images'
    }
};

/**
 * Load settings from disk, or return defaults if not found.
 */
export function loadSettings(): AppSettings {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            return JSON.parse(data) as AppSettings;
        }
    } catch (error) {
        console.error('[Settings] Failed to load settings:', error);
    }
    return { ...defaultSettings };
}

/**
 * Save settings to disk.
 */
export function saveSettings(settings: AppSettings): void {
    try {
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        console.log('[Settings] Saved settings to', SETTINGS_FILE);
    } catch (error) {
        console.error('[Settings] Failed to save settings:', error);
    }
}

/**
 * Get AWS config from settings.
 */
export function getAWSConfig(): { accessKeyId?: string; secretAccessKey?: string; region?: string; bucket?: string } {
    const settings = loadSettings();
    return {
        accessKeyId: settings.aws?.accessKeyId,
        secretAccessKey: settings.aws?.secretAccessKey,
        region: settings.aws?.region || 'ap-southeast-2',
        bucket: settings.aws?.bucket || 'fish-reid-images'
    };
}

/**
 * Update AWS credentials in settings.
 */
export function updateAWSCredentials(accessKeyId: string, secretAccessKey: string, region?: string): void {
    const settings = loadSettings();
    settings.aws = {
        ...settings.aws,
        accessKeyId,
        secretAccessKey,
        region: region || settings.aws?.region || 'ap-southeast-2'
    };
    saveSettings(settings);
}

/**
 * Clear AWS credentials from settings.
 */
export function clearAWSCredentials(): void {
    const settings = loadSettings();
    if (settings.aws) {
        delete settings.aws.accessKeyId;
        delete settings.aws.secretAccessKey;
    }
    saveSettings(settings);
}
