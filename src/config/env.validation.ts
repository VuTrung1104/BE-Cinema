import { plainToClass } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, IsEnum, validateSync, Min, Max } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  // Database
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  // JWT
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string;

  // Application
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  // Email (optional for development)
  @IsString()
  EMAIL_HOST?: string;

  @IsNumber()
  EMAIL_PORT?: number;

  @IsString()
  EMAIL_USER?: string;

  @IsString()
  EMAIL_PASSWORD?: string;

  // OAuth (optional)
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  GOOGLE_CALLBACK_URL?: string;

  @IsString()
  FACEBOOK_APP_ID?: string;

  @IsString()
  FACEBOOK_APP_SECRET?: string;

  @IsString()
  FACEBOOK_CALLBACK_URL?: string;

  @IsString()
  FRONTEND_URL?: string;

  // Cloudinary (optional)
  @IsString()
  CLOUDINARY_CLOUD_NAME?: string;

  @IsString()
  CLOUDINARY_API_KEY?: string;

  @IsString()
  CLOUDINARY_API_SECRET?: string;

  // VNPay (optional)
  @IsString()
  VNPAY_TMN_CODE?: string;

  @IsString()
  VNPAY_HASH_SECRET?: string;

  @IsString()
  VNPAY_URL?: string;

  @IsString()
  VNPAY_RETURN_URL?: string;

  @IsString()
  VNPAY_API_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const missingVars = errors
      .map((error) => {
        const constraints = Object.values(error.constraints || {});
        return `  - ${error.property}: ${constraints.join(', ')}`;
      })
      .join('\n');

    throw new Error(`❌ Environment validation failed:\n${missingVars}\n\nPlease check your .env file.`);
  }

  return validatedConfig;
}
