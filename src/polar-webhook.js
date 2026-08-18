// @ts-check
import { createHmac, timingSafeEqual } from 'node:crypto';

export const POLAR_WEBHOOK_TOLERANCE_SECONDS = 300;

export class PolarWebhookError extends Error {
  /** @param {'malformed'|'signature'} code */
  constructor(code) {
    super(code === 'signature' ? 'invalid webhook signature' : 'malformed webhook');
    this.code = code;
  }
}

/** @param {unknown} value */
function singleHeader(value) {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

/** @param {Headers|Record<string, unknown>} headers @param {string} name */
export function polarWebhookHeader(headers, name) {
  if (headers && typeof /** @type {any} */ (headers).get === 'function') return singleHeader(/** @type {any} */ (headers).get(name));
  if (!headers || typeof headers !== 'object') return null;
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name);
  return key ? singleHeader(/** @type {Record<string, unknown>} */ (headers)[key]) : null;
}

/** @param {Headers|Record<string, unknown>} headers */
function signatureHeader(headers) {
  if (headers && typeof /** @type {any} */ (headers).get === 'function') return singleHeader(/** @type {any} */ (headers).get('webhook-signature'));
  if (!headers || typeof headers !== 'object') return null;
  const key = Object.keys(headers).find((item) => item.toLowerCase() === 'webhook-signature');
  const value = key ? /** @type {Record<string, unknown>} */ (headers)[key] : null;
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')) return value.join(' ');
  return singleHeader(value);
}

/** @param {string} value */
function signatureValues(value) {
  const values = [];
  for (const part of value.trim().split(/\s+/)) {
    if (!part.startsWith('v1,')) continue;
    const match = /^v1,([A-Za-z0-9+/]+={0,2})$/.exec(part);
    if (!match) throw new PolarWebhookError('malformed');
    const decoded = Buffer.from(match[1], 'base64');
    if (decoded.length !== 32 || decoded.toString('base64') !== match[1]) throw new PolarWebhookError('malformed');
    values.push(decoded);
  }
  if (values.length === 0) throw new PolarWebhookError('malformed');
  return values;
}

/** @param {unknown} value */
function rawBody(value) {
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new PolarWebhookError('malformed');
}

/**
 * Verifies a Polar Standard Webhooks delivery before parsing it. Polar's SDK
 * base64-wraps the configured secret for the Standard Webhooks library; this
 * direct HMAC implementation intentionally uses the original configured secret bytes.
 * @param {string|Uint8Array} body
 * @param {Headers|Record<string, unknown>} headers
 * @param {{secret: string, now?: Date|number|string, toleranceSeconds?: number}} options
 */
export function verifyPolarWebhook(body, headers, { secret, now = new Date(), toleranceSeconds = POLAR_WEBHOOK_TOLERANCE_SECONDS }) {
  if (typeof secret !== 'string' || secret.length === 0) throw new PolarWebhookError('malformed');
  const id = polarWebhookHeader(headers, 'webhook-id');
  const timestampText = polarWebhookHeader(headers, 'webhook-timestamp');
  const signature = signatureHeader(headers);
  if (!id || !/^[A-Za-z0-9_-]{1,200}$/.test(id) || !timestampText || !/^(?:0|[1-9][0-9]{0,15})$/.test(timestampText) || !signature) throw new PolarWebhookError('malformed');
  const timestamp = Number(timestampText);
  const nowSeconds = Math.floor(new Date(now).getTime() / 1000);
  if (!Number.isSafeInteger(timestamp) || !Number.isFinite(nowSeconds) || !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) throw new PolarWebhookError('malformed');
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) throw new PolarWebhookError('signature');
  const bytes = rawBody(body);
  const expected = createHmac('sha256', Buffer.from(secret, 'utf8')).update(id).update('.').update(timestampText).update('.').update(bytes).digest();
  const valid = signatureValues(signature).some((candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected));
  if (!valid) throw new PolarWebhookError('signature');
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new PolarWebhookError('malformed');
  }
}

/** @param {unknown} event */
export function polarWebhookEventTime(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const timestamp = /** @type {Record<string, unknown>} */ (event).timestamp;
  if (typeof timestamp !== 'string') return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** @param {unknown} event @param {{organizationId: string, productId: string}} identity */
export function isPolarInitialPaidOrder(event, { organizationId, productId }) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof organizationId !== 'string' || typeof productId !== 'string' || !organizationId || !productId) return false;
  const candidate = /** @type {Record<string, unknown>} */ (event);
  const data = candidate.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const order = /** @type {Record<string, unknown>} */ (data);
  const product = order.product;
  if (!product || typeof product !== 'object' || Array.isArray(product)) return false;
  const orderProduct = /** @type {Record<string, unknown>} */ (product);
  return candidate.type === 'order.paid'
    && order.product_id === productId
    && orderProduct.id === productId
    && orderProduct.organization_id === organizationId
    && order.status === 'paid'
    && typeof order.total_amount === 'number'
    && Number.isSafeInteger(order.total_amount)
    && order.total_amount > 0
    && order.currency === 'usd'
    && (order.billing_reason === 'purchase' || order.billing_reason === 'subscription_create')
    && polarWebhookEventTime(event) !== null;
}
