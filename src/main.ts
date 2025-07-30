import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ItemDropService } from './service/item-drop.service';
import { MatchmakingMode } from './gateway/shared-types/matchmaking-mode';
import { UserService } from "./service/user.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);

  // await app
  //   .get(ItemDropService)
  //   .onMatchFinished(MatchmakingMode.UNRANKED, 12345, ['116514945']);
  // await app.get(UserService).claimDrops('116514945');
}
bootstrap();
