import { MigrationInterface, QueryRunner } from "typeorm";

export class ItemDrops1753307651541 implements MigrationInterface {
    name = 'ItemDrops1753307651541'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dropped_item" ("assetid" character varying NOT NULL, "steam_id" character varying NOT NULL, "created" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7eb1f0a05adc47f917974f0d80f" PRIMARY KEY ("assetid"))`);
        await queryRunner.query(`CREATE TABLE "item_drop_settings" ("id" SERIAL NOT NULL, "base_drop_chance" double precision NOT NULL, "subsequent_drop_chance" double precision NOT NULL, CONSTRAINT "PK_0d2d927ad6ea7f0889310911dd4" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "item_drop_settings"`);
        await queryRunner.query(`DROP TABLE "dropped_item"`);
    }

}
