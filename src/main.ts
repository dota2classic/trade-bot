import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonWrapper } from '@dota2classic/nest_logger';
import { ConfigService } from '@nestjs/config';
import configuration from './config/configuration';

async function bootstrap() {
  const parsedConfig = configuration();
  const config = new ConfigService(parsedConfig);

  const app = await NestFactory.create(AppModule, {
    // logger: new WinstonWrapper(
    //   config.get('fluentbit.host'),
    //   config.get<number>('fluentbit.port'),
    //   config.get<string>('fluentbit.application'),
    //   config.get<boolean>('fluentbit.disabled'),
    // ),
  });

  const options = new DocumentBuilder()
    .setTitle('GameServer api')
    .setDescription('Matches, players, mmrs')
    .setVersion('1.0')
    .addTag('game')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);

  await app.listen(6100);

  // for (let i = 0; i < 1; i++) {
  //   await app
  //     .get(ItemDropService)
  //     .onMatchFinished(MatchmakingMode.UNRANKED, 44671, ['116514945']);
  // }

  // await app.get(UserService).claimDrops('116514945');
}
bootstrap();
