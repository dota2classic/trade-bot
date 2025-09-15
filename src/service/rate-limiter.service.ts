import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetryError, seconds, throttledQueue } from 'throttled-queue';
import { AxiosError } from 'axios';

type ApiCall<T> = () => Promise<T>;

@Injectable()
export class RateLimiter {
  private logger = new Logger(RateLimiter.name);
  private readonly throttle: any;
  private readonly marketThrottle: any;

  constructor(config: ConfigService) {
    const rlm = config.get('trade.marketRateLimitPerMinute');
    this.logger.log(`Rate limit: ${rlm}`);
    this.throttle = throttledQueue({
      maxPerInterval: rlm,
      interval: 60_000,
      evenlySpaced: false,
    });

    this.marketThrottle = throttledQueue({
      maxPerInterval: rlm,
      interval: 60_000,
      evenlySpaced: false,
    });
  }

  public enqueue<T>(apiCall: ApiCall<T>): Promise<T> {
    return this.throttle(async () => {
      return apiCall().catch((e: AxiosError) => {
        this.logger.warn('Rate limited!', typeof e);
        console.error(e.message);
        console.error(e.response.data);
      });
    });
  }

  public enqueueMarket<T>(apiCall: ApiCall<T>): Promise<T> {
    return this.throttle(async () => {
      return apiCall().catch((e: AxiosError<{ success: number | boolean }>) => {
        if (e.response.status === 429) {
          this.logger.warn('Rate limited: retrying after interval');
          throw new RetryError({
            retryAfter: null,
            pauseQueue: true,
          }); // pause the queue until retryAfter
        }
        if (e.status === 406 && e.response.data.success === 22) {
          this.logger.warn(
            'Too many requests without confirmation! pausing queue',
          );
          throw new RetryError({
            pauseQueue: true,
            retryAfter: seconds(60),
          });
        }
      });
    });
  }
}
