import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UserService } from './service/user.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);

  // await app.get(UserService).claimDrops('116514945');
}
bootstrap();
