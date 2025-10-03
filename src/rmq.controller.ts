import { Controller, Logger } from '@nestjs/common';
import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import { GameResultsEvent } from './gateway/events/gs/game-results.event';
import { ItemDropService } from './service/item-drop.service';
import { PlayerFinishedMatchEvent } from './gateway/events/gs/player-finished-match.event';

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
      data.players
        .filter((t) => !t.abandoned && t.steam_id.length > 2)
        .map((t) => t.steam_id),
    );
  }

  @RabbitSubscribe({
    exchange: 'app.events',
    routingKey: PlayerFinishedMatchEvent.name,
    queue: `trade-queue.${PlayerFinishedMatchEvent.name}`,
  })
  async PlayerFinishedMatchEvent(data: PlayerFinishedMatchEvent) {
    if (data.unrankedGamesCount === 2) {
      await this.itemDropService.dropItem(data.steamId, data.matchId);
      this.logger.log(
        `Dropping guaranteed item for 2nd game for a player ${data.steamId}`,
      );
    }
  }
}
