import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveConstraint1770715068003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "market_item" DROP CONSTRAINT market_item_buy_gt_sell RESTRICT;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
