import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";
import { RunsQueryDto } from "./runs.dto.js";
import { CompareService } from "./compare.service.js";

@Controller("api/v1/forecast-runs")
export class ForecastRunsController {
  constructor(@Inject(CompareService) private readonly service: CompareService) {}

  /**
   * Qué preveía cada modelo, corrida a corrida, para la misma ventana futura. Sirve para ver
   * si el episodio crece o se desinfla entre emisiones, que es más fiable que una sola.
   */
  @Get()
  runs(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: RunsQueryDto }))
    q: RunsQueryDto,
  ) {
    return this.service.runs({
      ...(q.station ? { station: q.station } : {}),
      horizonHours: q.horizon,
      lookbackHours: q.lookback,
    });
  }
}
