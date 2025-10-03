import { MigrationInterface, QueryRunner } from "typeorm";

export class FixNullableDroppedItem1759526970930 implements MigrationInterface {
    name = 'FixNullableDroppedItem1759526970930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" ALTER COLUMN "match_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" ALTER COLUMN "match_id" SET NOT NULL`);
    }

}
