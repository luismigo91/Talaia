import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";
import { VerifyQueryDto } from "./verify.dto.js";
import { VerifyService } from "./verify.service.js";

@Controller("api/v1/verify")
export class VerifyController {
  constructor(@Inject(VerifyService) private readonly service: VerifyService) {}

  @Get()
  verify(
    @Query(new ValidationPipe({ transform: true, whitelist: true, expectedType: VerifyQueryDto }))
    q: VerifyQueryDto,
  ) {
    return this.service.verify({ days: q.days, ...(q.station ? { station: q.station } : {}) });
  }
}
