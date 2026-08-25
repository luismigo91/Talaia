import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";
import { RiskQueryDto } from "./risk.dto.js";
import { RiskService } from "./risk.service.js";

@Controller("api/v1/risk")
export class RiskController {
  constructor(@Inject(RiskService) private readonly service: RiskService) {}

  /** Semáforo de riesgo por localización, con el desglose que lo justifica. */
  @Get()
  async risk(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: RiskQueryDto }))
    q: RiskQueryDto,
  ) {
    const stations = await this.service.risk(q.station ? { station: q.station } : {});
    return { stations };
  }
}
