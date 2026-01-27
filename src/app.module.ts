import { Module } from '@nestjs/common';
import { TradeOfferService } from './service/trade-offer.service';
import * as SteamUser from 'steam-user';
import * as SteamCommunity from 'steamcommunity';
import * as SteamTotp from 'steam-totp';
import * as TradeOfferManager from 'steam-tradeoffer-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { ScheduleModule } from '@nestjs/schedule';
import { Steam } from './steam';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { getTypeormConfig } from './config/typeorm.config';
import { Entities } from './config/entities';
import { ItemPriceService } from './service/item-price.service';
import { ItemSellService } from './service/item-sell.service';
import { ItemDropService } from './service/item-drop.service';
import SteamMarket, { ECurrencyCode } from '@dota2classic/steam-market';
import { RabbitMQConfig, RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RmqController } from './rmq.controller';
import { TradeController } from './rest/trade.controller';
import { UserService } from './service/user.service';
import { TradeMapper } from './rest/trade.mapper';
import { RateLimiter } from './service/rate-limiter.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    RabbitMQModule.forRootAsync({
      useFactory(config: ConfigService): RabbitMQConfig {
        return {
          exchanges: [
            {
              name: 'app.events',
              type: 'topic',
            },
          ],
          enableControllerDiscovery: true,
          uri: `amqp://${config.get('rabbitmq.user')}:${config.get('rabbitmq.password')}@${config.get('rabbitmq.host')}:${config.get('rabbitmq.port')}`,
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory(config: ConfigService): TypeOrmModuleOptions {
        return {
          ...getTypeormConfig(config),
          type: 'postgres',
          migrations: ['dist/database/migrations/*.*'],
          migrationsRun: true,
          logging: ['error'],
        };
      },
      imports: [],
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(Entities),
  ],
  controllers: [RmqController, TradeController],
  providers: [
    ItemPriceService,
    TradeOfferService,
    ItemSellService,
    ItemDropService,
    UserService,
    TradeMapper,
    RateLimiter,
    {
      provide: Steam,
      useFactory: async (config: ConfigService) => {
        const client = new SteamUser({
          // renewRefreshTokens: true,
          autoRelogin: true,
          webCompatibilityMode: true,
          dataDirectory: './2fa_test',
        });
        const community = new SteamCommunity();
        const market = new SteamMarket();

        market.setCurrency(ECurrencyCode.RUB);
        market.setCountry('RU');

        const refreshToken = config.get('steam.refreshToken');

        client.logOn(
          refreshToken
            ? {
                refreshToken,
              }
            : {
                accountName: config.get('steam.username'),
                password: config.get('steam.password'),
                twoFactorCode: SteamTotp.generateAuthCode(
                  config.get('steam.sharedSecret'),
                ),
              },
        );

        // client.on('refreshToken', (tkn) => {
        //   console.log(tkn);
        // });

        const manager = new TradeOfferManager({
          steam: client,
          community: community,
          language: 'ru',
        });

        const steam = new Steam(manager, client, community, market);

        const logPromise = new Promise<void>((resolve) => {
          client.on('loggedOn', () => {
            resolve();
          });
        });

        const webPromise = new Promise<void>((resolve) => {
          client.on('webSession', (sessionid, cookies) => {
            manager.setCookies(cookies);
            community.setCookies(cookies);
            market.setCookies(cookies);

            community.startConfirmationChecker(
              10000,
              config.get('steam.identitySecret'),
            );
            resolve();
          });
        });

        community.on('sessionExpired', () => {
          console.log('Session expired! Relogging in');
          client.logOn({
            accountName: config.get('steam.username'),
            password: config.get('steam.password'),
            twoFactorCode: SteamTotp.generateAuthCode(
              config.get('steam.sharedSecret'),
            ),
          });
        });
        await Promise.all([logPromise, webPromise]);
        console.log('Steam initialized');
        return steam;
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
