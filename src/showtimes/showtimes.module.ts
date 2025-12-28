import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShowtimesService } from './showtimes.service';
import { ShowtimesController } from './showtimes.controller';
import { ShowtimesGateway } from './showtimes.gateway';
import { Showtime, ShowtimeSchema } from './schemas/showtime.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Showtime.name, schema: ShowtimeSchema }]),
  ],
  controllers: [ShowtimesController],
  providers: [ShowtimesService, ShowtimesGateway],
  exports: [ShowtimesService],
})
export class ShowtimesModule {}
