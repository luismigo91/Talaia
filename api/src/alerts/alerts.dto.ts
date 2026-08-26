import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class AlertsQueryDto {
  /** Por defecto solo los vigentes: un aviso caducado no es un aviso. */
  @IsOptional()
  @Transform(({ value }) => value !== "false")
  @IsBoolean()
  active: boolean = true;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  zone?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}
