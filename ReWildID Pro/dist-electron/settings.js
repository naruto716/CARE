"use strict";
/**
 * Settings Storage for CARE ReWildID Pro
 *
 * Stores application settings including optional AWS credentials.
 * Uses a simple JSON file in the app data directory.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.getAWSConfig = getAWSConfig;
exports.updateAWSCredentials = updateAWSCredentials;
exports.clearAWSCredentials = clearAWSCredentials;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SETTINGS_FILE = path_1.default.join(process.cwd(), 'data', 'settings.json');
const defaultSettings = {
    aws: {
        region: 'ap-southeast-2',
        bucket: 'fish-reid-images'
    }
};
/**
 * Load settings from disk, or return defaults if not found.
 */
function loadSettings() {
    try {
        if (fs_1.default.existsSync(SETTINGS_FILE)) {
            const data = fs_1.default.readFileSync(SETTINGS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error('[Settings] Failed to load settings:', error);
    }
    return { ...defaultSettings };
}
/**
 * Save settings to disk.
 */
function saveSettings(settings) {
    try {
        const dir = path_1.default.dirname(SETTINGS_FILE);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        console.log('[Settings] Saved settings to', SETTINGS_FILE);
    }
    catch (error) {
        console.error('[Settings] Failed to save settings:', error);
    }
}
/**
 * Get AWS config from settings.
 */
function getAWSConfig() {
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
function updateAWSCredentials(accessKeyId, secretAccessKey, region) {
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
function clearAWSCredentials() {
    const settings = loadSettings();
    if (settings.aws) {
        delete settings.aws.accessKeyId;
        delete settings.aws.secretAccessKey;
    }
    saveSettings(settings);
}
