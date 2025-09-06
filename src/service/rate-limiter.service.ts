import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetryError, seconds, throttledQueue } from 'throttled-queue';

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
      apiCall().catch(() => {
        this.logger.error(
          'There was an error executing rate limited api call!',
        );
        throw new RetryError({
          pauseQueue: true,
          retryAfter: seconds(30),
        });
      });
    });
  }
}
