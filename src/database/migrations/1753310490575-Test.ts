import { MigrationInterface, QueryRunner } from "typeorm";

export class Test1753310490575 implements MigrationInterface {
    name = 'Test1753310490575'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" ADD "match_id" integer NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" DROP COLUMN "match_id"`);
    }

}
