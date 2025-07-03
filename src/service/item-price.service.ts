import { Injectable } from '@nestjs/common';
import { ItemQualities, ItemQuality } from '../constant';
import { MarketItemEntity } from '../entities/market-item.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ItemPriceService {
  constructor(
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
  ) {}

  public async updateItemMarketData(
    marketHashName: string,
    price: number,
    type: string,
  ) {
    let itemName = marketHashName;
    const first = marketHashName.split(' ')[0];
    let quality = ItemQualities.find((quality) => quality === first);
    if (quality) {
      itemName = itemName.replace(`${quality} `, '');
    } else {
      quality = ItemQuality.Standard;
    }

    await this.marketItemEntityRepository.update(
      {
        marketHashName: itemName,
        quality: quality,
      },
      {
        price: price,
        type: type,
      },
    );
  }
}
