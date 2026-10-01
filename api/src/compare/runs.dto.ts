import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class RunsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  station?: string;

  /** Ventana objetivo, desde ahora: lo que cada corrida preveía para las próximas 12 o 24 h. */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsIn([12, 24])
  horizon: 12 | 24 = 24;

  /** Cuánto atrás se buscan corridas. */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(6)
  @Max(96)
  lookback: number = 48;
}
