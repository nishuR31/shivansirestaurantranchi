import { Redis } from "ioredis";
import env from "./envConfig";

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
};

const cache = (env.REDIS_URL_CACHE ? new Redis(env.REDIS_URL_CACHE, redisOptions) : null) as unknown as Redis;
const rateLimit = (env.REDIS_URL_RATELIMIT ? new Redis(env.REDIS_URL_RATELIMIT, redisOptions) : null) as unknown as Redis;

export async function connectRedisCache(): Promise<Redis | null> {
  if (cache && cache.status !== "ready") {
    try {
      await cache.connect();
      console.log("[Redis Cache] connected successfully.");
    } catch (error) {
      console.warn("[Redis Cache] Failed to connect.", error);
    }
  }
  return cache;
}

export async function connectRedisRateLimit(): Promise<Redis | null> {
  if (rateLimit && rateLimit.status !== "ready") {
    try {
      await rateLimit.connect();
      console.log("[Redis Rate Limit] connected successfully.");
    } catch (error) {
      console.warn("[Redis Rate Limit] Failed to connect.", error);
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
      console.warn(`[Redis Cache] Failed to get ${key}:`, err);
    }
  }
  const data = await fetcher();
  if (cache && data !== undefined && data !== null) {
    try {
      await cache.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      console.warn(`[Redis Cache] Failed to set ${key}:`, err);
    }
  }
  return data;
}

export { rateLimit, cache };
export default { cache, rateLimit };
