import { MigrationInterface, QueryRunner } from "typeorm";

export class ItemDropLog1754261631677 implements MigrationInterface {
    name = 'ItemDropLog1754261631677'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "item_drop_log" ("id" SERIAL NOT NULL, "steam_id" character varying NOT NULL, "match_id" integer NOT NULL, "asset_id" character varying NOT NULL, "market_hash_name" character varying NOT NULL, "quality" "public"."item_quality" NOT NULL, "price" integer NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_367aa1cb6b7b6c3360cc4d4338c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "item_drop_log" ADD CONSTRAINT "FK_f275eb5c76380668f8e87d3564a" FOREIGN KEY ("market_hash_name", "quality") REFERENCES "market_item"("market_hash_name","quality") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_drop_log" DROP CONSTRAINT "FK_f275eb5c76380668f8e87d3564a"`);
        await queryRunner.query(`DROP TABLE "item_drop_log"`);
    }

}
