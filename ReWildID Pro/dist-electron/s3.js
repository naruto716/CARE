"use strict";
/**
 * S3 Client for CARE ReWildID Pro
 *
 * Supports optional explicit credentials from app settings,
 * or falls back to system credentials (env vars, ~/.aws/credentials, IAM role).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initS3Client = initS3Client;
exports.uploadImageToS3 = uploadImageToS3;
exports.isS3Configured = isS3Configured;
exports.getS3Bucket = getS3Bucket;
const client_s3_1 = require("@aws-sdk/client-s3");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_BUCKET = 'fish-reid-images';
const DEFAULT_REGION = 'ap-southeast-2';
let s3Client = null;
let currentBucket = DEFAULT_BUCKET;
/**
 * Initialize S3 client with optional explicit credentials.
 * If credentials are not provided, falls back to system credentials.
 */
function initS3Client(config) {
    const region = config?.region || DEFAULT_REGION;
    currentBucket = config?.bucket || DEFAULT_BUCKET;
    if (config?.accessKeyId && config?.secretAccessKey) {
        // Use explicit credentials from settings
        console.log('[S3] Using explicit credentials from settings');
        s3Client = new client_s3_1.S3Client({
            region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });
    }
    else {
        // Fall back to system credentials (env vars, ~/.aws/credentials, IAM role)
        console.log('[S3] Using system credentials (env/profile/IAM)');
        s3Client = new client_s3_1.S3Client({ region });
    }
    console.log(`[S3] Bucket: ${currentBucket}`);
}
/**
 * Upload an image to S3 and return the S3 URL.
 *
 * @param localPath - Local file path to upload
 * @param groupName - Group name for organizing uploads
 * @returns S3 URL in format s3://bucket/key
 */
async function uploadImageToS3(localPath, groupName) {
    if (!s3Client) {
        initS3Client();
    }
    const filename = path_1.default.basename(localPath);
    // Sanitize group name for use in S3 key
    const sanitizedGroup = groupName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'default';
    const key = `uploads/${sanitizedGroup}/${Date.now()}_${filename}`;
    const fileContent = fs_1.default.readFileSync(localPath);
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: currentBucket,
        Key: key,
        Body: fileContent,
        ContentType: 'image/jpeg'
    }));
    console.log(`[S3] Uploaded: ${localPath} -> s3://${currentBucket}/${key}`);
    return `s3://${currentBucket}/${key}`;
}
/**
 * Check if S3 is configured and accessible.
 * Returns true if credentials are available.
 */
function isS3Configured() {
    return s3Client !== null;
}
/**
 * Get current S3 bucket name.
 */
function getS3Bucket() {
    return currentBucket;
}
