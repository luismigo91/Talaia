import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createDb, waitForDb, type Db } from "@talaia/shared";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: async (): Promise<Db> => {
        const conn = createDb();
        await waitForDb(conn.sql);
        DbModule.conn = conn;
        return conn.db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  static conn: ReturnType<typeof createDb> | undefined;
  async onApplicationShutdown() {
    await DbModule.conn?.close();
    DbModule.conn = undefined;
  }
}
