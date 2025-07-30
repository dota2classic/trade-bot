import { MigrationInterface, QueryRunner } from "typeorm";

export class DroppedItemTradeOfferId1753830137693 implements MigrationInterface {
    name = 'DroppedItemTradeOfferId1753830137693'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" ADD "active_trade_offer_id" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" DROP COLUMN "active_trade_offer_id"`);
    }

}
