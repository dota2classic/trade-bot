import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MarketItemEntity } from "./entities/market-item.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

@Controller("trade")
@ApiTags("trade")
export class TradeController {

  constructor(
    @InjectRepository(MarketItemEntity)
    private readonly marketItemEntityRepository: Repository<MarketItemEntity>,
  ) {
  }


}
