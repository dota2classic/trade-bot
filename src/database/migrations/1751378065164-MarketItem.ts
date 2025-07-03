import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketItem1751378065164 implements MigrationInterface {
    name = 'MarketItem1751378065164'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."item_quality" AS ENUM('Standard', 'Inscribed', 'Auspicious', 'Genuine', 'Autographed', 'Heroic', 'Frozen', 'Base', 'Cursed', 'Unusual', 'Infused', 'Corrupted', 'Exalted', 'Elder', 'Glitter', 'Gold', 'Holo', 'Legacy', 'Favored', 'Ascendant')`);
        await queryRunner.query(`CREATE TABLE "market_item" ("id" SERIAL NOT NULL, "market_hash_name" character varying NOT NULL, "quality" "public"."item_quality" NOT NULL, "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "price" integer NOT NULL DEFAULT '-1', "type" text NOT NULL DEFAULT '', CONSTRAINT "PK_11199ac3134fefae1f6a029ae5e" PRIMARY KEY ("id", "quality"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "market_hash_name_quality_unique" ON "market_item" ("market_hash_name", "quality") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."market_hash_name_quality_unique"`);
        await queryRunner.query(`DROP TABLE "market_item"`);
        await queryRunner.query(`DROP TYPE "public"."item_quality"`);
    }

}
