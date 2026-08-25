import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";
import { CompareQueryDto } from "./compare.dto.js";
import { CompareService } from "./compare.service.js";

@Controller("api/v1/compare")
export class CompareController {
  constructor(@Inject(CompareService) private readonly service: CompareService) {}

  @Get()
  compare(
    // expectedType explícito: no dependemos de emitDecoratorMetadata (esbuild/Vitest no lo emite)
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: CompareQueryDto }))
    q: CompareQueryDto,
  ) {
    return this.service.compare({
      variable: q.variable,
      hours: q.hours,
      ...(q.station ? { station: q.station } : {}),
    });
  }
}
