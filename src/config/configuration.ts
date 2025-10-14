export default () => {
  return {
    steam: {
      key: process.env.STEAM_API_KEY,
      username: process.env.STEAM_USERNAME,
      password: process.env.STEAM_PASSWORD,
      sharedSecret: process.env.STEAM_SHARED_SECRET,
      identitySecret: process.env.STEAM_IDENTITY_SECRET,
      refreshToken: process.env.STEAM_REFRESH_TOKEN,
    },
    redis: {
      host: process.env.REDIS_HOST,
      password: process.env.REDIS_PASSWORD,
    },
    postgres: {
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
    },
    fluentbit: {
      application: process.env.APP_NAME,
      host: process.env.FLUENTBIT_HOST,
      port: parseInt(process.env.FLUENTBIT_PORT) || 24224,
    },
    rabbitmq: {
      host: process.env.RABBITMQ_HOST,
      port: process.env.RABBITMQ_PORT,
      user: process.env.RABBITMQ_USER,
      password: process.env.RABBITMQ_PASSWORD,
    },
    trade: {
      marketRateLimitPerMinute:
        parseInt(process.env.MARKET_RATE_LIMIT_PER_MINUTE) || 20,
      scrape: process.env.DO_TRADE_SCRAPES,
    },
  };
};
