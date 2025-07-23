import { Controller, Logger } from '@nestjs/common';
import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import { GameResultsEvent } from './gateway/events/gs/game-results.event';
import { ItemDropService } from './service/item-drop.service';

@Controller()
export class RmqController {
  private logger = new Logger(RmqController.name);
  constructor(private readonly itemDropService: ItemDropService) {}

  @RabbitSubscribe({
    exchange: 'app.events',
    routingKey: GameResultsEvent.name,
    queue: `trade-queue.${GameResultsEvent.name}`,
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  async GameResultsEvent(data: GameResultsEvent) {
    await this.itemDropService.onMatchFinished(
      data.type,
      data.matchId,
      data.players.map((t) => t.steam_id),
    );
  }
}
