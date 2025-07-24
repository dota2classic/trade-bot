import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketItemEntity } from '../entities/market-item.entity';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { TradeMapper } from './trade.mapper';
import { UpdateUserDto } from './trade.dto';
import { UserService } from '../service/user.service';
import { DroppedItemEntity } from '../entities/dropped-item.entity';
import { Steam } from "../steam";

@Controller('trade')
@ApiTags('trade')
export class TradeController {
  constructor(
    private readonly steam: Steam,
    private readonly mapper: TradeMapper,
    private readonly userService: UserService,
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
    @InjectRepository(UserMarketBalanceEntity)
    private readonly userMarketBalanceEntityRepository: Repository<UserMarketBalanceEntity>,
    @InjectRepository(DroppedItemEntity)
    private readonly droppedItemEntityRepository: Repository<DroppedItemEntity>,
  ) {}

  @Get('user/:steamId')
  public async getUser(@Param('steamId') steamId: string) {
    let res = await this.userMarketBalanceEntityRepository.findOne({
      where: {
        steamId,
      },
    });

    if (!res) {
      res = new UserMarketBalanceEntity(steamId, 0);
    }

    return this.mapper.mapUser(res);
  }

  @Patch('user/:steamId')
  public async updateUser(
    @Param('steamId') steamId: string,
    @Body() dto: UpdateUserDto,
  ) {
    await this.userService.update(steamId, dto.tradeLink);
    return this.getUser(steamId);
  }

  @Get('drops/:steamId')
  public async getDrops(@Param('steamId') steamId: string) {
    const drops = await this.droppedItemEntityRepository.findBy({ steamId });

    return drops.map(this.mapper.mapDrop);
  }

  // Ask for a trade request
  @Post('drops/:steamId/claim')
  public async claimDrops(@Param('steamId') steamId: string) {
    await this.userService.claimDrops(steamId)

  }

  @Delete('drops/:steamId/discard/:assetId')
  public async discardDrop(
    @Param('steamId') steamId: string,
    @Param('assetId') assetId: string,
  ) {
    await this.droppedItemEntityRepository.delete({
      steamId,
      assetId,
    });
  }
}
