"use strict";
/**
 * SQS Client for CARE ReWildID Pro
 *
 * Handles sending detection requests and polling for results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSQSClient = initSQSClient;
exports.sendDetectionRequest = sendDetectionRequest;
exports.sendClusteringRequest = sendClusteringRequest;
exports.onJobResult = onJobResult;
exports.removeJobHandler = removeJobHandler;
exports.startResultsListener = startResultsListener;
exports.stopResultsListener = stopResultsListener;
exports.isSQSConfigured = isSQSConfigured;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const settings_1 = require("./settings");
// Queue URLs - FIFO queues
const REQUEST_QUEUE_URL = 'https://sqs.ap-southeast-2.amazonaws.com/478393948232/fish-reid-requests.fifo';
const RESULTS_QUEUE_URL = 'https://sqs.ap-southeast-2.amazonaws.com/478393948232/fish-reid-results.fifo';
let sqsClient = null;
let resultsListener = null;
let resultHandlers = new Map();
/**
 * Initialize SQS client with credentials from settings.
 */
function initSQSClient() {
    const config = (0, settings_1.getAWSConfig)();
    const region = config?.region || 'ap-southeast-2';
    if (config?.accessKeyId && config?.secretAccessKey) {
        console.log('[SQS] Using explicit credentials from settings');
        sqsClient = new client_sqs_1.SQSClient({
            region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        });
    }
    else {
        console.log('[SQS] Using system credentials');
        sqsClient = new client_sqs_1.SQSClient({ region });
    }
}
/**
 * Send a detection request to the request queue.
 */
async function sendDetectionRequest(request) {
    if (!sqsClient) {
        initSQSClient();
    }
    const command = new client_sqs_1.SendMessageCommand({
        QueueUrl: REQUEST_QUEUE_URL,
        MessageBody: JSON.stringify(request),
        MessageGroupId: request.job_id,
        MessageDeduplicationId: `${request.job_id}-request`
    });
    await sqsClient.send(command);
    console.log(`[SQS] Sent detection request for job ${request.job_id}`);
}
/**
 * Send a clustering (ReID) request to the request queue.
 */
async function sendClusteringRequest(request) {
    if (!sqsClient) {
        initSQSClient();
    }
    const command = new client_sqs_1.SendMessageCommand({
        QueueUrl: REQUEST_QUEUE_URL,
        MessageBody: JSON.stringify(request),
        MessageGroupId: request.job_id,
        MessageDeduplicationId: `${request.job_id}-clustering`
    });
    await sqsClient.send(command);
    console.log(`[SQS] Sent clustering request for job ${request.job_id}`);
}
/**
 * Register a handler for a specific job result.
 */
function onJobResult(jobId, handler) {
    resultHandlers.set(jobId, handler);
}
/**
 * Remove handler for a job.
 */
function removeJobHandler(jobId) {
    resultHandlers.delete(jobId);
}
/**
 * Poll results queue once.
 */
async function pollResults() {
    if (!sqsClient) {
        initSQSClient();
    }
    try {
        const command = new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: RESULTS_QUEUE_URL,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 5, // Short poll for responsiveness
            VisibilityTimeout: 30
        });
        const response = await sqsClient.send(command);
        const messages = response.Messages || [];
        for (const msg of messages) {
            if (!msg.Body || !msg.ReceiptHandle)
                continue;
            try {
                const result = JSON.parse(msg.Body);
                const handler = resultHandlers.get(result.job_id);
                if (handler) {
                    console.log(`[SQS] Received result for job ${result.job_id}`);
                    handler(result);
                    resultHandlers.delete(result.job_id);
                }
                // Delete message after processing
                const deleteCommand = new client_sqs_1.DeleteMessageCommand({
                    QueueUrl: RESULTS_QUEUE_URL,
                    ReceiptHandle: msg.ReceiptHandle
                });
                await sqsClient.send(deleteCommand);
            }
            catch (e) {
                console.error('[SQS] Failed to parse result:', e);
            }
        }
    }
    catch (e) {
        console.error('[SQS] Poll error:', e);
    }
}
/**
 * Start background polling for results.
 */
function startResultsListener() {
    if (resultsListener)
        return;
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
function stopResultsListener() {
    if (resultsListener) {
        clearTimeout(resultsListener);
        resultsListener = null;
        console.log('[SQS] Stopped results listener');
    }
}
/**
 * Check if SQS is configured.
 */
function isSQSConfigured() {
    return sqsClient !== null;
}
