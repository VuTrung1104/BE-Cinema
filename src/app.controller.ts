import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  private startTime: number;

  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {
    this.startTime = Date.now();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get welcome message' })
  @ApiResponse({ status: 200, description: 'Welcome message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service health status', schema: {
    example: {
      status: 'ok',
      timestamp: '2024-01-01T00:00:00.000Z',
      service: 'Movie Booking API',
      uptime: 3600,
      environment: 'development',
      mongodb: 'connected',
      redis: 'connected'
    }
  }})
  async healthCheck() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Check MongoDB connection
    let mongoStatus = 'disconnected';
    try {
      if (this.mongoConnection.readyState === 1) {
        mongoStatus = 'connected';
      }
    } catch (error) {
      mongoStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Movie Booking API',
      uptime,
      environment: process.env.NODE_ENV || 'development',
      mongodb: mongoStatus,
    };
  }
}
