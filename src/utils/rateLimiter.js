/**
 * Rate limiter implementation using token bucket algorithm
 */
export class RateLimit {
  constructor(limit, interval) {
    this.limit = limit;
    this.interval = interval;
    this.tokens = limit;
    this.lastRefill = Date.now();
  }

  async acquire() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    this.tokens += timePassed * (this.limit / this.interval);
    this.tokens = Math.min(this.tokens, this.limit);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (this.interval / this.limit);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.tokens -= 1;
    return true;
  }
}

export const rateLimit = new RateLimit(30, 60000); // 30 requests per minute
