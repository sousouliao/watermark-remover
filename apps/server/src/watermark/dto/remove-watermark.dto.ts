import { Type } from 'class-transformer'
import { IsDefined, IsIn, IsInt, IsNotEmpty, IsString, Max, Min, ValidateIf, ValidateNested } from 'class-validator'

export type WatermarkModel = 'lite' | 'flash'
export type RemoveMode = 'direct' | 'region'

export class RegionDto {
  @IsInt()
  @Min(0)
  @Max(999)
  x1: number

  @IsInt()
  @Min(0)
  @Max(999)
  y1: number

  @IsInt()
  @Min(0)
  @Max(999)
  x2: number

  @IsInt()
  @Min(0)
  @Max(999)
  y2: number
}

export class RemoveWatermarkDto {
  @IsString()
  @IsNotEmpty()
  image: string

  @IsIn(['lite', 'flash'])
  model: WatermarkModel

  @IsIn(['direct', 'region'])
  mode: RemoveMode

  @ValidateIf(dto => dto.mode === 'region' || dto.region !== undefined)
  @IsDefined()
  @ValidateNested()
  @Type(() => RegionDto)
  region?: RegionDto
}
