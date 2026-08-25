import { IsIn, IsOptional, IsString, Matches } from "class-validator";

export const SENSOR_VARIABLES = [
  "river_flow_m3s",
  "river_level_m",
  "reservoir_hm3",
  "reservoir_level_m",
  "precip_mm",
  "precip_rate_mmh",
  "precip_24h_mm",
] as const;

export class SensorsQueryDto {
  @IsOptional()
  @IsIn(SENSOR_VARIABLES)
  variable?: (typeof SENSOR_VARIABLES)[number];

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  station?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  source?: string;
}
