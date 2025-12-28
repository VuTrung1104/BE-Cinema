import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSettingDto {
  @ApiProperty({ example: 'site_name', description: 'Unique setting key' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Cinema Management System', description: 'Setting value' })
  @IsString()
  value: string;

  @ApiProperty({ example: 'Website name', description: 'Description of the setting', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'general', description: 'Setting category', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: true, description: 'Whether setting is public', required: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
