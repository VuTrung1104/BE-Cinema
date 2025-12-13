import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ShowtimesService } from './showtimes.service';
import { CreateShowtimeDto } from './dto/create-showtime.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('showtimes')
@ApiBearerAuth()
@Controller('showtimes')
export class ShowtimesController {
  constructor(private readonly showtimesService: ShowtimesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new showtime (Admin only)' })
  @ApiResponse({ status: 201, description: 'Showtime created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  create(@Body() createShowtimeDto: CreateShowtimeDto) {
    return this.showtimesService.create(createShowtimeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all showtimes with optional filters' })
  @ApiQuery({ name: 'movieId', required: false, description: 'Filter by movie ID' })
  @ApiQuery({ name: 'theaterId', required: false, description: 'Filter by theater ID' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Showtimes retrieved successfully' })
  findAll(
    @Query('movieId') movieId?: string,
    @Query('theaterId') theaterId?: string,
    @Query('date') date?: string,
  ) {
    return this.showtimesService.findAll({ movieId, theaterId, date });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get showtime by ID' })
  @ApiResponse({ status: 200, description: 'Showtime found' })
  @ApiResponse({ status: 404, description: 'Showtime not found' })
  findOne(@Param('id') id: string) {
    return this.showtimesService.findOne(id);
  }

  @Get(':id/seats')
  @ApiOperation({ summary: 'Get available seats for showtime' })
  @ApiResponse({ status: 200, description: 'Available seats retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Showtime not found' })
  getAvailableSeats(@Param('id') id: string) {
    return this.showtimesService.getAvailableSeats(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete showtime by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Showtime deleted successfully' })
  @ApiResponse({ status: 404, description: 'Showtime not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  remove(@Param('id') id: string) {
    return this.showtimesService.remove(id);
  }
}
