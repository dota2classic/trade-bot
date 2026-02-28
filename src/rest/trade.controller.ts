import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Patch, Post, } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNull, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MarketItemEntity } from '../entities/market-item.entity';
import { UserMarketBalanceEntity } from '../entities/user-market-balance.entity';
import { TradeMapper } from './trade.mapper';
import {
  CreateDropTierDto,
  DropItemDto,
  DropSettingsDto,
  PurchaseDto,
  UpdateDropSettingsDto,
  UpdateDropTierDto,
  UpdateUserDto,
} from './trade.dto';
import { UserService } from '../service/user.service';
import { DroppedItemEntity } from '../entities/dropped-item.entity';
import { Steam } from '../steam';
import { TradeOfferEntity } from '../entities/trade-offer.entity';
import { ItemDropTierEntity } from '../entities/item-drop-tier.entity';
import { DropSettingsEntity } from '../entities/drop-settings.entity';
import { ItemDropService } from '../service/item-drop.service';

@Controller('trade')
@ApiTags('trade')
export class TradeController {
  private logger = new Logger(TradeController.name);
  constructor(
    private readonly steam: Steam,
    private readonly mapper: TradeMapper,
    private readonly userService: UserService,
    private readonly dropService: ItemDropService,
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
    @InjectRepository(UserMarketBalanceEntity)
    private readonly userMarketBalanceEntityRepository: Repository<UserMarketBalanceEntity>,
    @InjectRepository(DroppedItemEntity)
    private readonly droppedItemEntityRepository: Repository<DroppedItemEntity>,
    @InjectRepository(TradeOfferEntity)
    private readonly tradeOfferEntityRepository: Repository<TradeOfferEntity>,
    @InjectRepository(ItemDropTierEntity)
    private readonly itemDropTierEntityRepository: Repository<ItemDropTierEntity>,
    @InjectRepository(DropSettingsEntity)
    private readonly dropSettingsEntityRepository: Repository<DropSettingsEntity>,
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

  @Get('user/:steamId/offers')
  public async getOfferHistory(@Param('steamId') steamId: string) {
    const offers = await this.tradeOfferEntityRepository.find({
      where: {
        steamId,
      },
      relations: ['items'],
      order: {
        created: 'DESC',
      },
    });

    return offers.map(this.mapper.mapOffer);
  }

  @Get('drops/:steamId')
  public async getDrops(@Param('steamId') steamId: string) {
    const drops = await this.droppedItemEntityRepository.find({
      where: { steamId },
      relations: ['marketItem'],
      order: {
        created: 'DESC',
      },
    });

    return drops.map(this.mapper.mapDrop);
  }

  @Post('drops/:steamId')
  public async dropItem(
    @Param('steamId') steamId: string,
    @Body() dto: DropItemDto,
  ) {
    await this.dropService.dropItem(steamId, null, dto.tierId);
  }

  // Ask for a trade request
  @Post('user/:steamId/purchase')
  public async purchase(
    @Param('steamId') steamId: string,
    @Body() purchase: PurchaseDto,
  ) {
    return this.userService.purchase(steamId, purchase.amount);
  }

  // Ask for a trade request
  @Post('drops/:steamId/claim')
  public async claimDrops(@Param('steamId') steamId: string) {
    return this.userService.claimDrops(steamId);
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
    this.logger.warn(`Player ${steamId} discarded drop ${assetId}`);
  }

  // Tier CRUD
  @Get('tiers')
  public async getDropTiers() {
    const tiers = await this.itemDropTierEntityRepository.find();

    return Promise.all(
      tiers.map(async (tier) => {
        const result = await this.marketItemEntityRepository
          .createQueryBuilder('item')
          .select('COALESCE(SUM(item.quantity), 0)', 'count')
          .where('item.price >= :minPrice', { minPrice: tier.minPrice })
          .andWhere('item.price <= :maxPrice', { maxPrice: tier.maxPrice })
          .getRawOne();

        return {
          ...this.mapper.mapTier(tier),
          count: parseInt(result.count, 10),
        };
      }),
    );
  }

  @Post('tiers')
  public async createDropTier(@Body() dto: CreateDropTierDto) {
    // Validate
    const allTiers = await this.itemDropTierEntityRepository.find();
    const collision =
      allTiers.findIndex(
        (t) =>
          (dto.minPrice >= t.minPrice && dto.minPrice <= t.maxPrice) ||
          (dto.maxPrice >= t.minPrice && dto.maxPrice <= t.maxPrice),
      ) !== -1;
    if (collision) {
      throw 'Collision!';
    }
    await this.itemDropTierEntityRepository.save(dto);
  }

  @Patch('tiers/:id')
  public async updateTier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDropTierDto,
  ) {
    await this.itemDropTierEntityRepository.update(
      {
        id,
      },
      {
        ...dto,
      },
    );
  }

  @Delete('tiers/:id')
  public async deleteTier(@Param('id', ParseIntPipe) id: number) {
    await this.itemDropTierEntityRepository.delete({
      id,
    });
  }

  @Get('settings')
  public async getSettings(): Promise<DropSettingsDto> {
    return this.dropSettingsEntityRepository.findOne({
      where: {
        id: Not(IsNull()),
      },
    });
  }

  @Patch('settings')
  public async updateSettings(@Body() dto: UpdateDropSettingsDto) {
    await this.dropSettingsEntityRepository.update(
      {
        id: Not(IsNull()),
      },
      {
        ...dto,
      },
    );
  }
}
