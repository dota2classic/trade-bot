import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { throttledQueue } from 'throttled-queue';

type ApiCall<T> = () => Promise<T>;

@Injectable()
export class RateLimiter {
  private logger = new Logger(RateLimiter.name);
  private readonly throttle: any;

  constructor(config: ConfigService) {
    const rlm = config.get('trade.marketRateLimitPerMinute');
    this.logger.log(`Rate limit: ${rlm}`);
    this.throttle = throttledQueue({
      maxPerInterval: rlm,
      interval: 60_000,
      evenlySpaced: false,
    });
  }

  public enqueue<T>(apiCall: ApiCall<T>): Promise<T> {
    return this.throttle(async () => {
      return apiCall().catch((e: Error) => {
        this.logger.warn('Rate limited!', typeof e);
        console.log(e.message);
      });
    });
  }
}
