import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export const COMPARABLE_VARIABLES = [
  "precip_mm",
  "precip_prob_pct",
  "temp_c",
  "rh_pct",
  "wind_ms",
  "gust_ms",
  "cape_jkg",
] as const;

export class CompareQueryDto {
  @IsOptional()
  @IsIn(COMPARABLE_VARIABLES)
  variable: (typeof COMPARABLE_VARIABLES)[number] = "precip_mm";

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  station?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(48)
  hours: number = 24;
}
