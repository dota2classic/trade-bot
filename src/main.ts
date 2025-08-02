import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ItemDropService } from './service/item-drop.service';
import { MatchmakingMode } from './gateway/shared-types/matchmaking-mode';
import { UserService } from './service/user.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  //     .onMatchFinished(MatchmakingMode.UNRANKED, 12345 + i, ['116514945']);
  // }


  // await app.get(UserService).claimDrops('116514945');
}
bootstrap();
