import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module.js";
import { HealthController } from "./health/health.controller.js";
import { StatusController } from "./status/status.controller.js";
import { StationsController } from "./stations/stations.controller.js";
import { CompareController } from "./compare/compare.controller.js";
import { CompareService } from "./compare/compare.service.js";

@Module({
  imports: [DbModule],
  controllers: [HealthController, StatusController, StationsController, CompareController],
  providers: [CompareService],
})
export class AppModule {}
