import { Module } from "@nestjs/common";
import { DbModule } from "./db/db.module.js";
import { HealthController } from "./health/health.controller.js";
import { StatusController } from "./status/status.controller.js";
import { StationsController } from "./stations/stations.controller.js";
import { CompareController } from "./compare/compare.controller.js";
import { CompareService } from "./compare/compare.service.js";
import { SensorsController } from "./sensors/sensors.controller.js";
import { ObservationsController } from "./observations/observations.controller.js";
import { RiskController } from "./risk/risk.controller.js";
import { RiskHistoryController } from "./risk/history.controller.js";
import { AlertsController } from "./alerts/alerts.controller.js";
import { RiskStream } from "./risk/risk.stream.js";
import { RiskStreamController } from "./risk/stream.controller.js";
import { RiskBadgeController } from "./risk/badge.controller.js";
import { PushController } from "./push/push.controller.js";
import { RiskService } from "./risk/risk.service.js";

@Module({
  imports: [DbModule],
  controllers: [
    HealthController,
    StatusController,
    StationsController,
    CompareController,
    SensorsController,
    ObservationsController,
    RiskController,
    RiskHistoryController,
    AlertsController,
    RiskStreamController,
    RiskBadgeController,
    PushController,
  ],
  providers: [CompareService, RiskService, RiskStream],
})
export class AppModule {}
