import { MigrationInterface, QueryRunner } from "typeorm";

export class OfferIdInTradeItem1751392869373 implements MigrationInterface {
    name = 'OfferIdInTradeItem1751392869373'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP CONSTRAINT "FK_5625026c801f6c74aba139c85b6"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD "offer_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "trade_offer" ADD CONSTRAINT "UQ_b6c553463560880da2a3e04e95e" UNIQUE ("id")`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ALTER COLUMN "item_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD CONSTRAINT "FK_00480c11a859fdc8a7380804391" FOREIGN KEY ("offer_id") REFERENCES "trade_offer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD CONSTRAINT "FK_b7a0911065780f6790c8503539b" FOREIGN KEY ("item_id") REFERENCES "market_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP CONSTRAINT "FK_b7a0911065780f6790c8503539b"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP CONSTRAINT "FK_00480c11a859fdc8a7380804391"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ALTER COLUMN "item_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "trade_offer" DROP CONSTRAINT "UQ_b6c553463560880da2a3e04e95e"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP COLUMN "offer_id"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD CONSTRAINT "FK_5625026c801f6c74aba139c85b6" FOREIGN KEY ("item_id") REFERENCES "market_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
