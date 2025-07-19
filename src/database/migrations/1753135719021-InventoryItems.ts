import { MigrationInterface, QueryRunner } from "typeorm";

export class InventoryItems1753135719021 implements MigrationInterface {
    name = 'InventoryItems1753135719021'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "inventory_item" ("assetid" character varying NOT NULL, "market_hash_name" character varying NOT NULL, "quality" "public"."item_quality" NOT NULL, "tradable" boolean NOT NULL, "marketable" boolean NOT NULL, "trade_cooldown_until" TIMESTAMP, CONSTRAINT "PK_846755e83b18d72ef9d7f3ba5f4" PRIMARY KEY ("assetid"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "inventory_item"`);
    }

}
