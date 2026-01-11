/**
 * S3 Client for CARE ReWildID Pro
 * 
 * Supports optional explicit credentials from app settings,
 * or falls back to system credentials (env vars, ~/.aws/credentials, IAM role).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const DEFAULT_BUCKET = 'fish-reid-images';
const DEFAULT_REGION = 'ap-southeast-2';

let s3Client: S3Client | null = null;
let currentBucket: string = DEFAULT_BUCKET;

export interface AWSConfig {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    bucket?: string;
}

/**
 * Initialize S3 client with optional explicit credentials.
 * If credentials are not provided, falls back to system credentials.
 */
export function initS3Client(config?: AWSConfig): void {
    const region = config?.region || DEFAULT_REGION;
    currentBucket = config?.bucket || DEFAULT_BUCKET;

    if (config?.accessKeyId && config?.secretAccessKey) {
        // Use explicit credentials from settings
        console.log('[S3] Using explicit credentials from settings');
        s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });
    } else {
        // Fall back to system credentials (env vars, ~/.aws/credentials, IAM role)
        console.log('[S3] Using system credentials (env/profile/IAM)');
        s3Client = new S3Client({ region });
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
export async function uploadImageToS3(localPath: string, groupName: string): Promise<string> {
    if (!s3Client) {
        initS3Client();
    }

    const filename = path.basename(localPath);
    // Sanitize group name for use in S3 key
    const sanitizedGroup = groupName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'default';
    const key = `uploads/${sanitizedGroup}/${Date.now()}_${filename}`;

    const fileContent = fs.readFileSync(localPath);

    await s3Client!.send(new PutObjectCommand({
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
export function isS3Configured(): boolean {
    return s3Client !== null;
}

/**
 * Get current S3 bucket name.
 */
export function getS3Bucket(): string {
    return currentBucket;
}
