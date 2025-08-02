import { MigrationInterface, QueryRunner } from "typeorm";

export class FixWeightType1753863961146 implements MigrationInterface {
    name = 'FixWeightType1753863961146'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_drop_tier" DROP COLUMN "weight"`);
        await queryRunner.query(`ALTER TABLE "item_drop_tier" ADD "weight" double precision NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_drop_tier" DROP COLUMN "weight"`);
        await queryRunner.query(`ALTER TABLE "item_drop_tier" ADD "weight" integer NOT NULL`);
    }

}
