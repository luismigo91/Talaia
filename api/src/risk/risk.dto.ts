import { IsOptional, IsString, Matches } from "class-validator";

export class RiskQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9:_-]+$/i)
  station?: string;
}
