import { MigrationInterface, QueryRunner } from "typeorm";

export class TradeOfferQueue1751487508099 implements MigrationInterface {
    name = 'TradeOfferQueue1751487508099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer" ADD "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer" DROP COLUMN "updated"`);
    }

}
