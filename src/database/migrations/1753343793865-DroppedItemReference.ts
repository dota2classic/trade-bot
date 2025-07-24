import { MigrationInterface, QueryRunner } from "typeorm";

export class DroppedItemReference1753343793865 implements MigrationInterface {
    name = 'DroppedItemReference1753343793865'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" ADD "market_hash_name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dropped_item" ADD "quality" "public"."item_quality" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_market_balance" ADD "trade_link" text`);
        await queryRunner.query(`ALTER TABLE "user_market_balance" ALTER COLUMN "balance" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "dropped_item" ADD CONSTRAINT "FK_7c6131975e299eaa5f3d9c4db93" FOREIGN KEY ("market_hash_name", "quality") REFERENCES "market_item"("market_hash_name","quality") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dropped_item" DROP CONSTRAINT "FK_7c6131975e299eaa5f3d9c4db93"`);
        await queryRunner.query(`ALTER TABLE "user_market_balance" ALTER COLUMN "balance" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_market_balance" DROP COLUMN "trade_link"`);
        await queryRunner.query(`ALTER TABLE "dropped_item" DROP COLUMN "quality"`);
        await queryRunner.query(`ALTER TABLE "dropped_item" DROP COLUMN "market_hash_name"`);
    }

}
