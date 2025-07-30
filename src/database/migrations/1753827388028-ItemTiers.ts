import { MigrationInterface, QueryRunner } from 'typeorm';

export class ItemTiers1753827388028 implements MigrationInterface {
  name = 'ItemTiers1753827388028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "item_drop_tier" ("id" SERIAL NOT NULL, "price_min" integer NOT NULL, "price_max" integer NOT NULL, "weight" integer NOT NULL, CONSTRAINT "PK_9b9ccf05215d598923d95803deb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `insert into item_drop_tier(price_min, price_max, weight) values (0, 100, 0.9), (100, 500, 0.08), (500, 1000, 0.01), (1000, 5000, 0.007), (5000, 15000, 0.0025), (15000, 500000, 0.0005)`,
    );
    await queryRunner.query(`ALTER TABLE "item_drop_settings" ADD "desired_stock" integer NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item_drop_settings" DROP COLUMN "desired_stock"`);
    await queryRunner.query(`DROP TABLE "item_drop_tier"`);
  }
}
