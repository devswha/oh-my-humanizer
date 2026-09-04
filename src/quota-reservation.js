// Atomic Pro allowance reservations. Attempts remain charged to a separate
// budget when a failed rewrite returns the customer's request/character quota.
export const PRO_RETRY_HEADROOM = 5;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/**
 * @typedef {{keys: string[], caps: number[], amounts: number[], ttlMs: number[], receiptTtlMs: number, attemptCap: number}} ReservationPlan
 */

/** @param {ReservationPlan} plan */
export function validateReservationPlan(plan) {
  const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
  if (!plan || !Array.isArray(plan.keys) || plan.keys.length !== 5
    || new Set(plan.keys).size !== 5 || !plan.keys.every((key) => /^[a-f0-9]{64}$/.test(key))
    || !Array.isArray(plan.caps) || plan.caps.length !== 3 || !plan.caps.every((n) => integer(n))
    || !integer(plan.caps[0], 1) || !integer(plan.caps[1], 1)
    || !Array.isArray(plan.amounts) || plan.amounts.length !== 3
    || plan.amounts[0] !== 1 || plan.amounts[1] !== 1 || !integer(plan.amounts[2])
    || !Array.isArray(plan.ttlMs) || plan.ttlMs.length !== 3 || !plan.ttlMs.every((n) => integer(n, 1))
    || !integer(plan.receiptTtlMs, 1) || !integer(plan.attemptCap, 1)
    || plan.attemptCap < plan.caps[1]) throw new TypeError('Invalid quota reservation plan');
  return plan;
}

export function reservationArgs(plan) {
  validateReservationPlan(plan);
  return [...plan.caps, ...plan.amounts, ...plan.ttlMs, plan.receiptTtlMs, plan.attemptCap].map(String);
}

export function settlementArgs(plan, refund) {
  validateReservationPlan(plan);
  if (typeof refund !== 'boolean') throw new TypeError('Invalid quota settlement outcome');
  return [refund ? '1' : '0', String(plan.receiptTtlMs), ...plan.amounts.map(String)];
}

// Result: [1, remainingDay] allowed, [0, dimension] capacity denied,
// [-1] malformed storage or a conflicting/previously settled reservation.
export const RESERVE_QUOTA_LUA = `
local maxsafe = 9007199254740991
local function counter(key)
  local raw = redis.call('GET', key)
  if not raw then return 0 end
  if raw ~= '0' and not string.match(raw, '^[1-9][0-9]*$') then return nil end
  local n = tonumber(raw)
  if not n or n < 0 or n > maxsafe or n ~= math.floor(n) then return nil end
  return n
end
local caps = {tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])}
local amounts = {tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])}
local ttls = {tonumber(ARGV[7]), tonumber(ARGV[8]), tonumber(ARGV[9])}
local existing = redis.call('GET', KEYS[5])
if existing then
  local ok, saved = pcall(cjson.decode, existing)
  if not ok or type(saved) ~= 'table' or saved.version ~= 1 or saved.state ~= 'charged' then return {-1} end
  if type(saved.keys) ~= 'table' or type(saved.amounts) ~= 'table' or #saved.keys ~= 4 or #saved.amounts ~= 3 then return {-1} end
  for i=1,4 do if saved.keys[i] ~= KEYS[i] then return {-1} end end
  for i=1,3 do if saved.amounts[i] ~= amounts[i] then return {-1} end end
  if type(saved.remainingDay) ~= 'number' or saved.remainingDay < 0 or saved.remainingDay > maxsafe or saved.remainingDay ~= math.floor(saved.remainingDay) then return {-1} end
  return {1, saved.remainingDay}
end
local counts = {}
for i=1,4 do
  counts[i] = counter(KEYS[i])
  if counts[i] == nil then return {-1} end
end
for i=1,3 do
  if amounts[i] > maxsafe - counts[i] then return {-1} end
  if caps[i] > 0 and counts[i] + amounts[i] > caps[i] then return {0, i} end
end
local attempts = math.max(counts[4], counts[2])
if attempts >= tonumber(ARGV[11]) then return {0, 4} end
for i=1,3 do
  if amounts[i] > 0 then
    redis.call('SET', KEYS[i], string.format('%.0f', counts[i] + amounts[i]), 'PX', ARGV[6+i])
  end
end
redis.call('SET', KEYS[4], string.format('%.0f', attempts + 1), 'PX', ARGV[8])
local saved = {version=1, state='charged', keys={KEYS[1], KEYS[2], KEYS[3], KEYS[4]}, amounts=amounts, remainingDay=caps[1]-counts[1]-1}
redis.call('SET', KEYS[5], cjson.encode(saved), 'PX', ARGV[10])
return {1, saved.remainingDay}
`;

// Both success and refund settle once. Refund touches only the original keys;
// an expired day/month counter is never recreated and the attempt budget stays.
export const SETTLE_QUOTA_LUA = `
local maxsafe = 9007199254740991
local raw = redis.call('GET', KEYS[5])
if not raw then
  if ARGV[1] ~= '1' then return 0 end
  local cancelled = {version=1, state='refunded', keys={KEYS[1],KEYS[2],KEYS[3],KEYS[4]}, amounts={tonumber(ARGV[3]),tonumber(ARGV[4]),tonumber(ARGV[5])}, remainingDay=0}
  redis.call('SET', KEYS[5], cjson.encode(cancelled), 'PX', ARGV[2])
  return 1
end
local ok, saved = pcall(cjson.decode, raw)
if not ok or type(saved) ~= 'table' or saved.version ~= 1 or type(saved.keys) ~= 'table' or type(saved.amounts) ~= 'table' or #saved.keys ~= 4 or #saved.amounts ~= 3 then return -1 end
for i=1,4 do if saved.keys[i] ~= KEYS[i] then return -1 end end
for i=1,3 do if saved.amounts[i] ~= tonumber(ARGV[2+i]) then return -1 end end
local target = ARGV[1] == '1' and 'refunded' or 'completed'
if saved.state == target then return 1 end
if saved.state ~= 'charged' then return 0 end
local ttl = redis.call('PTTL', KEYS[5])
if ttl <= 0 then return -1 end
local changes = {}
for i=1,3 do
  local amount = saved.amounts[i]
  if type(amount) ~= 'number' or amount < 0 or amount > maxsafe or amount ~= math.floor(amount) then return -1 end
  if target == 'refunded' and amount > 0 then
    local value = redis.call('GET', KEYS[i])
    if value then
      if value ~= '0' and not string.match(value, '^[1-9][0-9]*$') then return -1 end
      local n = tonumber(value)
      if not n or n < amount or n > maxsafe or n ~= math.floor(n) then return -1 end
      changes[i] = amount
    end
  end
end
for i=1,3 do if changes[i] then redis.call('INCRBY', KEYS[i], string.format('%.0f', -changes[i])) end end
saved.state = target
redis.call('SET', KEYS[5], cjson.encode(saved), 'PX', ttl)
return 1
`;

/** In-memory implementation of the same atomic operations for local tests. */
export function memoryReservationMethods(entries, now, expire) {
  return {
    async reserveQuota(plan) {
      validateReservationPlan(plan); expire();
      const previous = entries.get(plan.keys[4])?.value;
      if (previous !== undefined) {
        if (!previous || previous.version !== 1 || previous.state !== 'charged'
          || !Array.isArray(previous.keys) || !previous.keys.every((key, index) => key === plan.keys[index]) || previous.keys.length !== 4
          || JSON.stringify(previous.amounts) !== JSON.stringify(plan.amounts)
          || !Number.isSafeInteger(previous.remainingDay) || previous.remainingDay < 0) return [-1];
        return [1, previous.remainingDay];
      }
      const counts = plan.keys.slice(0, 4).map((key) => entries.get(key)?.value ?? 0);
      if (counts.some((n) => !Number.isSafeInteger(n) || n < 0)) return [-1];
      for (let i = 0; i < 3; i++) {
        if (plan.amounts[i] > MAX_SAFE - counts[i]) return [-1];
        if (plan.caps[i] > 0 && counts[i] + plan.amounts[i] > plan.caps[i]) return [0, i + 1];
      }
      const attempts = Math.max(counts[3], counts[1]);
      if (attempts >= plan.attemptCap) return [0, 4];
      for (let i = 0; i < 3; i++) if (plan.amounts[i] > 0) entries.set(plan.keys[i], { value: counts[i] + plan.amounts[i], expiresAt: now() + plan.ttlMs[i] });
      entries.set(plan.keys[3], { value: attempts + 1, expiresAt: now() + plan.ttlMs[1] });
      const receipt = { version: 1, state: 'charged', keys: plan.keys.slice(0, 4), amounts: [...plan.amounts], remainingDay: plan.caps[0] - counts[0] - 1 };
      entries.set(plan.keys[4], { value: receipt, expiresAt: now() + plan.receiptTtlMs });
      return [1, receipt.remainingDay];
    },
    async settleQuota(plan, refund) {
      validateReservationPlan(plan); expire();
      const entry = entries.get(plan.keys[4]);
      if (!entry) {
        if (!refund) return 0;
        entries.set(plan.keys[4], { value: { version: 1, state: 'refunded', keys: plan.keys.slice(0, 4), amounts: [...plan.amounts], remainingDay: 0 }, expiresAt: now() + plan.receiptTtlMs });
        return 1;
      }
      if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= now()) return -1;
      const receipt = entry.value;
      if (!receipt || receipt.version !== 1 || !Array.isArray(receipt.keys) || receipt.keys.length !== 4
        || !receipt.keys.every((key, index) => key === plan.keys[index]) || !Array.isArray(receipt.amounts) || receipt.amounts.length !== 3
        || !receipt.amounts.every((amount, index) => amount === plan.amounts[index])) return -1;
      const target = refund ? 'refunded' : 'completed';
      if (receipt.state === target) return 1;
      if (receipt.state !== 'charged') return 0;
      const changes = [];
      for (let i = 0; i < 3; i++) {
        const amount = receipt.amounts[i];
        if (!Number.isSafeInteger(amount) || amount < 0) return -1;
        const value = entries.get(plan.keys[i]);
        if (refund && amount > 0 && value) {
          if (!Number.isSafeInteger(value.value) || value.value < amount) return -1;
          changes.push([value, amount]);
        }
      }
      for (const [value, amount] of changes) value.value -= amount;
      receipt.state = target;
      return 1;
    },
  };
}
