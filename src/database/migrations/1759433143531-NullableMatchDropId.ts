import { MigrationInterface, QueryRunner } from "typeorm";

export class NullableMatchDropId1759433143531 implements MigrationInterface {
    name = 'NullableMatchDropId1759433143531'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_drop_log" ALTER COLUMN "match_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_drop_log" ALTER COLUMN "match_id" SET NOT NULL`);
    }

}
