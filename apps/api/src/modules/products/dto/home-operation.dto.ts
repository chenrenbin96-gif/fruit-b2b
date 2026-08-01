import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export class SaveHomeBannerDto {
  @IsString()
  @Length(1, 120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  image_url?: string;

  @IsIn(['ACTIVITY', 'MARKET', 'NEW_ARRIVAL'])
  banner_type!: 'ACTIVITY' | 'MARKET' | 'NEW_ARRIVAL';

  @IsIn(['NONE', 'PRODUCT', 'CATEGORY', 'URL'])
  link_type!: 'NONE' | 'PRODUCT' | 'CATEGORY' | 'URL';

  @IsOptional()
  @IsNumberString()
  link_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link_value?: string;

  @Type(() => Number)
  @IsInt()
  sort = 0;

  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;
}

export class SaveHomeRecommendationDto {
  @IsNumberString()
  product_id!: string;

  @IsIn(['RECOMMENDED', 'HOT', 'NEW_ARRIVAL', 'SPECIAL'])
  recommendation_type!:
    | 'RECOMMENDED'
    | 'HOT'
    | 'NEW_ARRIVAL'
    | 'SPECIAL';

  @Type(() => Number)
  @IsInt()
  sort = 0;

  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}

export class SaveHomeCategoryDto {
  @IsNumberString()
  category_id!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  image_url?: string;

  @IsString()
  @Length(1, 100)
  title!: string;

  @Type(() => Number)
  @IsInt()
  sort = 0;

  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}

export class SaveHomeProductDto {
  @IsNumberString()
  product_id!: string;

  @IsIn(['HOT', 'NEW', 'RECOMMEND'])
  position!: 'HOT' | 'NEW' | 'RECOMMEND';

  @Type(() => Number)
  @IsInt()
  sort = 0;

  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}
