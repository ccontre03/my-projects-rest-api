const buckets = new Map()

export function createRateLimiter({
  limit = 100,
  windowMs = 60 * 1000,
  keyGenerator,
  message,
}) {
  return async (c, next) => {
    const now = Date.now()
    const key = keyGenerator?.(c) || 'anonymous'
    const current = buckets.get(key)

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      await next()
      return
    }

    current.count += 1

    if (current.count > limit) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000)

      c.header('Retry-After', String(retryAfter))
      c.header('RateLimit-Limit', String(limit))
      c.header('RateLimit-Remaining', '0')
      c.header('RateLimit-Reset', String(retryAfter))

      return c.json(message(c), 429)
    }

    c.header('RateLimit-Limit', String(limit))
    c.header('RateLimit-Remaining', String(limit - current.count))
    c.header('RateLimit-Reset', String(Math.ceil((current.resetAt - now) / 1000)))

    await next()
  }
}
