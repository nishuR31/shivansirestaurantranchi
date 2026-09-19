import { Redis } from "ioredis";
import env from "./envConfig";
import logger from "./loggerConfig";

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
};

const cache = (env.REDIS_URL_CACHE ? new Redis(env.REDIS_URL_CACHE, redisOptions) : null) as unknown as Redis;
const rateLimit = (env.REDIS_URL_RATELIMIT ? new Redis(env.REDIS_URL_RATELIMIT, redisOptions) : null) as unknown as Redis;

if (cache) cache.on("error", (err) => logger.warn({ err }, "[Redis Cache] error event"));
if (rateLimit) rateLimit.on("error", (err) => logger.warn({ err }, "[Redis Rate Limit] error event"));

export async function connectRedisCache(): Promise<Redis | null> {
  if (cache && cache.status !== "ready") {
    try {
      await cache.connect();
      logger.info("[Redis Cache] connected successfully.");
    } catch (error) {
      logger.warn({ error }, "[Redis Cache] Failed to connect.");
    }
  }
  return cache;
}

export async function connectRedisRateLimit(): Promise<Redis | null> {
  if (rateLimit && rateLimit.status !== "ready") {
    try {
      await rateLimit.connect();
      logger.info("[Redis Rate Limit] connected successfully.");
    } catch (error) {
      logger.warn({ error }, "[Redis Rate Limit] Failed to connect.");
    }
  }
  return rateLimit;
}

export async function fetchWithCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  if (cache) {
    try {
      const cached = await cache.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch (err) {
      logger.warn({ err }, `[Redis Cache] Failed to get ${key}`);
    }
  }
  const data = await fetcher();
  if (cache && data !== undefined && data !== null) {
    try {
      await cache.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      logger.warn({ err }, `[Redis Cache] Failed to set ${key}`);
    }
  }
  return data;
}

export { rateLimit, cache };
export default { cache, rateLimit };
