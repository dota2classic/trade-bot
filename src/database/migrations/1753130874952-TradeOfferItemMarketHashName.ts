import { MigrationInterface, QueryRunner } from "typeorm";

export class TradeOfferItemMarketHashName1753130874952 implements MigrationInterface {
    name = 'TradeOfferItemMarketHashName1753130874952'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP CONSTRAINT "FK_b7a0911065780f6790c8503539b"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" RENAME COLUMN "item_id" TO "market_hash_name"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP COLUMN "market_hash_name"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD "market_hash_name" text NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP COLUMN "market_hash_name"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD "market_hash_name" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" RENAME COLUMN "market_hash_name" TO "item_id"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD CONSTRAINT "FK_b7a0911065780f6790c8503539b" FOREIGN KEY ("item_id") REFERENCES "market_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
