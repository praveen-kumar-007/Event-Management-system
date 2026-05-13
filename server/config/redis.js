const dotenv = require("dotenv");
const { createClient } = require("redis");

dotenv.config();

const hasRedisConfig = Boolean(
  process.env.REDIS_URL ||
  process.env.REDIS_HOST ||
  process.env.REDIS_SOCKET_PATH,
);

let client = null;
let connectPromise = null;
let redisReady = false;
let warningLogged = false;

const buildRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = process.env.REDIS_PORT || "6379";
  const password = process.env.REDIS_PASSWORD
    ? `:${process.env.REDIS_PASSWORD}@`
    : "";
  const username = process.env.REDIS_USER ? `${process.env.REDIS_USER}` : "";
  const authPrefix = username || password ? `${username}${password}` : "";

  return `redis://${authPrefix ? `${authPrefix}@` : ""}${host}:${port}`;
};

const logRedisWarning = (message) => {
  if (warningLogged) return;
  warningLogged = true;
  console.warn(`Redis cache unavailable, using memory fallback: ${message}`);
};

const getRedisClient = async () => {
  if (!hasRedisConfig) return null;
  if (client && redisReady) return client;
  if (connectPromise) return connectPromise;

  client = createClient({
    url: buildRedisUrl(),
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 1000),
    },
  });

  client.on("error", (error) => {
    redisReady = false;
    logRedisWarning(error.message);
  });

  client.on("ready", () => {
    redisReady = true;
  });

  connectPromise = client
    .connect()
    .then(() => {
      redisReady = true;
      return client;
    })
    .catch((error) => {
      redisReady = false;
      client = null;
      connectPromise = null;
      logRedisWarning(error.message);
      return null;
    });

  return connectPromise;
};

const isRedisAvailable = () => Boolean(client && redisReady);

module.exports = {
  getRedisClient,
  isRedisAvailable,
  hasRedisConfig,
};
