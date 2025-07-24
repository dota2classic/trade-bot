import { MigrationInterface, QueryRunner } from "typeorm";

export class Fixes1753350538710 implements MigrationInterface {
    name = 'Fixes1753350538710'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer" ADD "incoming" boolean NOT NULL`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD "assetid" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP COLUMN "assetid"`);
        await queryRunner.query(`ALTER TABLE "trade_offer" DROP COLUMN "incoming"`);
    }

}
