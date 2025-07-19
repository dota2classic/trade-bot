import { MigrationInterface, QueryRunner } from "typeorm";

export class ItemQuantity1753112426609 implements MigrationInterface {
    name = 'ItemQuantity1753112426609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "market_item" ADD "quantity" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "market_item" DROP COLUMN "quantity"`);
    }

}
