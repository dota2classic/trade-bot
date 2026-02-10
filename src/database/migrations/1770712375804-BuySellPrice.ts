import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuySellPrice1770712375804 implements MigrationInterface {
  name = 'BuySellPrice1770712375804';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "market_item" RENAME COLUMN "price" TO "sell_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_item" ADD "buy_price" integer NOT NULL DEFAULT '-1'`,
    );
    await queryRunner.query(
      `UPDATE "market_item" SET "buy_price" = greatest(buy_price, "sell_price" * 1.1) `,
    );
    await queryRunner.query(
      `ALTER TABLE "market_item"
   ADD CONSTRAINT "market_item_buy_gt_sell"
   CHECK ("buy_price" > "sell_price")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "market_item" DROP COLUMN "buy_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "market_item" RENAME COLUMN "sell_price" TO "price"`,
    );
  }
}
