import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class ObservationsQueryDto {
  /** Id del sensor (`saih:13873`). Alternativa a `station` + `variable`. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  sensor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  station?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+$/i)
  variable?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(168)
  hours: number = 24;
}
