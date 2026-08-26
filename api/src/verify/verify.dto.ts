import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class VerifyQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  station?: string;

  /** Días completos hacia atrás (excluye el día en curso, que estaría a medias). */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(14)
  days: number = 7;
}
