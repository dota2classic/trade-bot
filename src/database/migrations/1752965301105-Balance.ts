import { MigrationInterface, QueryRunner } from "typeorm";

export class Balance1752965301105 implements MigrationInterface {
    name = 'Balance1752965301105'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_market_balance" ("steam_id" text NOT NULL, "balance" integer NOT NULL, CONSTRAINT "PK_605fc470a8f44d652619890d18d" PRIMARY KEY ("steam_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "user_market_balance"`);
    }

}
