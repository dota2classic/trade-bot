import { MigrationInterface, QueryRunner } from "typeorm";

export class TradeOfferHistory1751382174684 implements MigrationInterface {
    name = 'TradeOfferHistory1751382174684'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "market_item_id_unique" ON "market_item" ("id") `);
        await queryRunner.query(`CREATE TABLE "trade_offer_item" ("id" SERIAL NOT NULL, "price" integer NOT NULL DEFAULT '-1', "item_id" integer, CONSTRAINT "PK_9113af884c0aade545891cb360a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "trade_offer" ("id" SERIAL NOT NULL, "offer_id" character varying NOT NULL, "steam_id" character varying NOT NULL, "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9a884a2c66c9e07cd2bf6bc136f" PRIMARY KEY ("id", "offer_id"))`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" ADD CONSTRAINT "FK_5625026c801f6c74aba139c85b6" FOREIGN KEY ("item_id") REFERENCES "market_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "market_item_id_unique"`);
        await queryRunner.query(`ALTER TABLE "trade_offer_item" DROP CONSTRAINT "FK_5625026c801f6c74aba139c85b6"`);
        await queryRunner.query(`DROP TABLE "trade_offer"`);
        await queryRunner.query(`DROP TABLE "trade_offer_item"`);
    }

}
