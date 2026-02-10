import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackToSimple1770717817423 implements MigrationInterface {
  name = 'BackToSimple1770717817423';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "market_item" DROP COLUMN "buy_price"`,
    );

    await queryRunner.query(
      `ALTER TABLE "market_item" RENAME COLUMN "sell_price" TO "price"`,
    );

    // Yes, delete everything, let it burn..
    await queryRunner.query(`
      UPDATE "market_item" SET quantity = -1, price = -1 WHERE true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "market_item" RENAME COLUMN "price" TO "sell_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_item" ADD "buy_price" integer NOT NULL DEFAULT '-1'`,
    );
  }
}
