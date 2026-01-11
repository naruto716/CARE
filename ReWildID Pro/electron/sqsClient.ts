/**
 * SQS Client for CARE ReWildID Pro
 * 
 * Handles sending detection requests and polling for results.
 */

import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { getAWSConfig } from './settings';

// Queue URLs - FIFO queues
const REQUEST_QUEUE_URL = 'https://sqs.ap-southeast-2.amazonaws.com/478393948232/fish-reid-requests.fifo';
const RESULTS_QUEUE_URL = 'https://sqs.ap-southeast-2.amazonaws.com/478393948232/fish-reid-results.fifo';

let sqsClient: SQSClient | null = null;
let resultsListener: NodeJS.Timeout | null = null;
let resultHandlers: Map<string, (result: any) => void> = new Map();

export interface DetectionRequest {
    job_id: string;
    mode: 'detection';
    images: Array<{
        image_id: number;
        s3_url: string;  // api_worker.py expects 's3_url' not 'cloud_url'
    }>;
}

export interface DetectionResult {
    job_id: string;
    status: 'completed' | 'failed';
    error?: string;
    detections: Array<{
        image_id: number;
        bbox: [number, number, number, number]; // [x1, y1, x2, y2] normalized
        species: string;
        confidence: number;
    }>;
}

/**
 * Initialize SQS client with credentials from settings.
 */
export function initSQSClient(): void {
    const config = getAWSConfig();
    const region = config?.region || 'ap-southeast-2';

    if (config?.accessKeyId && config?.secretAccessKey) {
        console.log('[SQS] Using explicit credentials from settings');
        sqsClient = new SQSClient({
            region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });
    } else {
        console.log('[SQS] Using system credentials');
        sqsClient = new SQSClient({ region });
    }
}

/**
 * Send a detection request to the request queue.
 */
export async function sendDetectionRequest(request: DetectionRequest): Promise<void> {
    if (!sqsClient) {
        initSQSClient();
    }

    const command = new SendMessageCommand({
        QueueUrl: REQUEST_QUEUE_URL,
        MessageBody: JSON.stringify(request),
        MessageGroupId: request.job_id,
        MessageDeduplicationId: `${request.job_id}-request`
    });

    await sqsClient!.send(command);
    console.log(`[SQS] Sent detection request for job ${request.job_id}`);
}

/**
 * Register a handler for a specific job result.
 */
export function onJobResult(jobId: string, handler: (result: DetectionResult) => void): void {
    resultHandlers.set(jobId, handler);
}

/**
 * Remove handler for a job.
 */
export function removeJobHandler(jobId: string): void {
    resultHandlers.delete(jobId);
}

/**
 * Poll results queue once.
 */
async function pollResults(): Promise<void> {
    if (!sqsClient) {
        initSQSClient();
    }

    try {
        const command = new ReceiveMessageCommand({
            QueueUrl: RESULTS_QUEUE_URL,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 5, // Short poll for responsiveness
            VisibilityTimeout: 30
        });

        const response = await sqsClient!.send(command);
        const messages = response.Messages || [];

        for (const msg of messages) {
            if (!msg.Body || !msg.ReceiptHandle) continue;

            try {
                const result: DetectionResult = JSON.parse(msg.Body);
                const handler = resultHandlers.get(result.job_id);

                if (handler) {
                    console.log(`[SQS] Received result for job ${result.job_id}`);
                    handler(result);
                    resultHandlers.delete(result.job_id);
                }

                // Delete message after processing
                const deleteCommand = new DeleteMessageCommand({
                    QueueUrl: RESULTS_QUEUE_URL,
                    ReceiptHandle: msg.ReceiptHandle
                });
                await sqsClient!.send(deleteCommand);

            } catch (e) {
                console.error('[SQS] Failed to parse result:', e);
            }
        }
    } catch (e) {
        console.error('[SQS] Poll error:', e);
    }
}

/**
 * Start background polling for results.
 */
export function startResultsListener(): void {
    if (resultsListener) return;

    console.log('[SQS] Starting results listener');

    const poll = async () => {
        await pollResults();
        resultsListener = setTimeout(poll, 1000); // Poll every second
    };

    poll();
}

/**
 * Stop background polling.
 */
export function stopResultsListener(): void {
    if (resultsListener) {
        clearTimeout(resultsListener);
        resultsListener = null;
        console.log('[SQS] Stopped results listener');
    }
}

/**
 * Check if SQS is configured.
 */
export function isSQSConfigured(): boolean {
    return sqsClient !== null;
}
