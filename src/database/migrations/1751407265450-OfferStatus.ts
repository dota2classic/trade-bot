import { MigrationInterface, QueryRunner } from "typeorm";

export class OfferStatus1751407265450 implements MigrationInterface {
    name = 'OfferStatus1751407265450'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer" ADD "trade_id" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."trade_offer_status" AS ENUM('pending', 'accepted', 'escrow')`);
        await queryRunner.query(`ALTER TABLE "trade_offer" ADD "status" "public"."trade_offer_status" NOT NULL DEFAULT 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trade_offer" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."trade_offer_status"`);
        await queryRunner.query(`ALTER TABLE "trade_offer" DROP COLUMN "trade_id"`);
    }

}
