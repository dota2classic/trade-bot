import { MigrationInterface, QueryRunner } from "typeorm";

export class ItemImages1753265465843 implements MigrationInterface {
    name = 'ItemImages1753265465843'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "market_item" ADD "large_icon" text NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "market_item" ADD "small_icon" text NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "market_item" DROP COLUMN "small_icon"`);
        await queryRunner.query(`ALTER TABLE "market_item" DROP COLUMN "large_icon"`);
    }

}
