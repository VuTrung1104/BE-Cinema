import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { TheatersService } from './theaters.service';
import { CreateTheaterDto } from './dto/create-theater.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('theaters')
@ApiBearerAuth()
@Controller('theaters')
export class TheatersController {
  constructor(private readonly theatersService: TheatersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new theater (Admin only)' })
  @ApiResponse({ status: 201, description: 'Theater created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  create(@Body() createTheaterDto: CreateTheaterDto) {
    return this.theatersService.create(createTheaterDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all theaters with optional city filter' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter theaters by city' })
  @ApiResponse({ status: 200, description: 'Theaters retrieved successfully' })
  findAll(@Query('city') city?: string) {
    return this.theatersService.findAll(city);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get theater by ID' })
  @ApiResponse({ status: 200, description: 'Theater found' })
  @ApiResponse({ status: 404, description: 'Theater not found' })
  findOne(@Param('id') id: string) {
    return this.theatersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update theater by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Theater updated successfully' })
  @ApiResponse({ status: 404, description: 'Theater not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  update(@Param('id') id: string, @Body() updateTheaterDto: Partial<CreateTheaterDto>) {
    return this.theatersService.update(id, updateTheaterDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete theater by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Theater deleted successfully' })
  @ApiResponse({ status: 404, description: 'Theater not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  remove(@Param('id') id: string) {
    return this.theatersService.remove(id);
  }
}
