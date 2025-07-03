import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import configuration from './configuration';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Entities } from './entities';

export const getTypeormConfig = (
  cs: ConfigService,
): PostgresConnectionOptions => {
  return {
    type: 'postgres',
    database: 'postgres',

    port: cs.get<number>('postgres.port') || 5432,
    host: cs.get('postgres.host'),
    username: cs.get('postgres.username'),
    password: cs.get('postgres.password'),
    synchronize: false,
    entities: Entities,
    migrations: ['src/database/migrations/*.*'],
    migrationsRun: false,
    migrationsTableName: 'trade_bot_migration',
    logging: true,
  };
};

const AppDataSource = new DataSource(
  getTypeormConfig(new ConfigService(configuration('config.yaml'))),
);

export default AppDataSource;
