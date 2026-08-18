// @ts-check
import { createHmac } from 'node:crypto';
import { isPolarInitialPaidOrder, polarWebhookEventTime, polarWebhookHeader, PolarWebhookError, verifyPolarWebhook } from '../src/polar-webhook.js';

export const config = { api: { bodyParser: false } };

const BODY_LIMIT = 64 * 1024;
const COUNTER_TTL_SECONDS = 35 * 24 * 60 * 60;
const DEDUPE_TTL_SECONDS = 400 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 2500;
const INCREMENT_ONCE = "local first = redis.call('SET', KEYS[1], '1', 'NX', 'PX', ARGV[1]) if first then redis.call('INCR', KEYS[2]) redis.call('PEXPIRE', KEYS[2], ARGV[2]) return 1 end return 0";

/** @param {any} res @param {number} status */
function respond(res, status) {
  res.statusCode = status;
  res.setHeader?.('Cache-Control', 'no-store');
  res.setHeader?.('Content-Length', '0');
  res.end?.();
}

/** @param {any} req */
async function requestBody(req) {
  if (req?.body !== undefined) {
    if (typeof req.body === 'string' || req.body instanceof Uint8Array) {
      const bytes = Buffer.from(req.body);
      return bytes.byteLength > BODY_LIMIT ? { tooLarge: true } : { bytes };
    }
    return { invalid: true };
  }
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return { invalid: true };
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > BODY_LIMIT) return { tooLarge: true };
    chunks.push(bytes);
  }
  return { bytes: Buffer.concat(chunks) };
}

/** @param {string} webhookId @param {string} secret */
export function polarWebhookDedupeDigest(webhookId, secret) {
  return createHmac('sha256', Buffer.from(secret, 'utf8')).update(webhookId).digest('hex');
}

/** @param {Date|number|string} now */
export function polarPurchaseCounterKey(now) {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError('invalid counter time');
  return `patina:funnel:v1:${date.toISOString().slice(0, 10)}:purchase-completed:provider=polar`;
}

/**
 * Dedicated aggregate-only Upstash adapter. The only persistent delivery
 * artifact is an HMAC digest of the webhook id; event/customer/order fields
 * never become keys or command arguments.
 * @param {Record<string, string|undefined>} env
 * @param {typeof fetch} fetchImpl
 */
export function createPolarWebhookStore(env = process.env, fetchImpl = globalThis.fetch) {
  const base = env.PATINA_OBSERVABILITY_REST_API_URL;
  const token = env.PATINA_OBSERVABILITY_REST_API_TOKEN;
  if (!base || !token || typeof fetchImpl !== 'function') return null;
  let url;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.upstash\.io$/i.test(url.hostname)) return null;
  return {
    /** @param {string} dedupeDigest @param {string} counterKey */
    async incrementOnce(dedupeDigest, counterKey) {
      if (!/^[a-f0-9]{64}$/.test(dedupeDigest) || !/^patina:funnel:v1:\d{4}-\d{2}-\d{2}:purchase-completed:provider=polar$/.test(counterKey)) throw new Error('invalid aggregate key');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetchImpl(url.origin, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify([
            'EVAL', INCREMENT_ONCE, '2',
            `patina:funnel:v1:dedupe:polar:${dedupeDigest}`,
            counterKey,
            String(DEDUPE_TTL_SECONDS * 1000),
            String(COUNTER_TTL_SECONDS * 1000),
          ]),
        });
        if (!response?.ok) throw new Error('aggregate storage unavailable');
        const result = await response.json();
        if (result?.result !== 0 && result?.result !== 1) throw new Error('invalid aggregate storage result');
        return result.result === 1;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/**
 * @param {{env?: Record<string, string|undefined>, store?: {incrementOnce(dedupeDigest: string, counterKey: string): Promise<boolean>|boolean}|null, now?: () => Date|number|string, fetchImpl?: typeof fetch}} options
 */
export function createPolarWebhookHandler({ env = process.env, store, now = () => new Date(), fetchImpl = globalThis.fetch } = {}) {
  const aggregateStore = store === undefined ? createPolarWebhookStore(env, fetchImpl) : store;
  return async (req, res) => {
    if (req?.method !== 'POST') return respond(res, 405);
    const contentType = polarWebhookHeader(req?.headers, 'content-type');
    if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) return respond(res, 400);
    const body = await requestBody(req);
    if (body.tooLarge) return respond(res, 413);
    if (body.invalid || !body.bytes) return respond(res, 400);
    const secret = env.POLAR_WEBHOOK_SECRET;
    const organizationId = env.POLAR_ORGANIZATION_ID;
    const productId = env.POLAR_PRO_PRODUCT_ID;
    if (!secret || !organizationId || !productId) return respond(res, 503);
    let event;
    const currentTime = now();
    try {
      event = verifyPolarWebhook(body.bytes, req.headers, { secret, now: currentTime });
    } catch (error) {
      return respond(res, error instanceof PolarWebhookError && error.code === 'signature' ? 403 : 400);
    }
    if (!isPolarInitialPaidOrder(event, { organizationId, productId })) return respond(res, 204);
    if (!aggregateStore) return respond(res, 503);
    const webhookId = polarWebhookHeader(req.headers, 'webhook-id');
    // Verification established this bounded header; never retain its raw value.
    const digest = polarWebhookDedupeDigest(/** @type {string} */ (webhookId), secret);
    try {
      await aggregateStore.incrementOnce(digest, polarPurchaseCounterKey(/** @type {Date} */ (polarWebhookEventTime(event))));
    } catch {
      return respond(res, 503);
    }
    return respond(res, 202);
  };
}

export default createPolarWebhookHandler();
