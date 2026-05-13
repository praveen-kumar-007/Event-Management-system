const { getRedisClient, isRedisAvailable } = require("../config/redis");

const memoryCache = new Map();
const namespace = "kabaddi";

const makeKey = (...parts) => [namespace, ...parts].filter(Boolean).join(":");

const readMemory = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.value;
};

const writeMemory = (key, value, ttlSeconds) => {
  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
};

const cacheGet = async (key) => {
  const memoryValue = readMemory(key);
  if (memoryValue !== undefined) return memoryValue;

  const client = await getRedisClient();
  if (!client || !isRedisAvailable()) return undefined;

  const raw = await client.get(key);
  if (raw === null || raw === undefined) return undefined;

  try {
    const parsed = JSON.parse(raw);
    writeMemory(key, parsed, 30);
    return parsed;
  } catch {
    return raw;
  }
};

const cacheSet = async (key, value, ttlSeconds = 60) => {
  writeMemory(key, value, ttlSeconds);

  const client = await getRedisClient();
  if (!client || !isRedisAvailable()) return;

  await client.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  });
};

const cacheDel = async (keys = []) => {
  const list = Array.isArray(keys) ? keys : [keys];
  list.forEach((key) => memoryCache.delete(key));

  const client = await getRedisClient();
  if (!client || !isRedisAvailable() || !list.length) return;

  await client.del(list);
};

const cacheFlushPrefix = async (prefix = namespace) => {
  const normalizedPrefix = prefix.endsWith(":") ? prefix : `${prefix}:`;
  [...memoryCache.keys()].forEach((key) => {
    if (key.startsWith(normalizedPrefix)) memoryCache.delete(key);
  });

  const client = await getRedisClient();
  if (!client || !isRedisAvailable()) return;

  const keys = await client.keys(`${normalizedPrefix}*`);
  if (keys.length) {
    await client.del(keys);
  }
};

module.exports = {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheFlushPrefix,
  makeKey,
};
