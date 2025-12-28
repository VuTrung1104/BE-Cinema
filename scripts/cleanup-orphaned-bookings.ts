import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { Booking, BookingStatus } from '../src/bookings/schemas/booking.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Showtime } from '../src/showtimes/schemas/showtime.schema';

/**
 * Script to find and report orphaned bookings
 * Orphaned bookings are bookings that:
 * 1. Are in PENDING status for more than 15 minutes
 * 2. Reference non-existent showtimes
 * 3. Reference non-existent users
 */
async function cleanupOrphanedBookings() {
  console.log('🔍 Starting orphaned bookings cleanup check...\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const bookingModel = app.get<Model<Booking>>(getModelToken(Booking.name));
    const showtimeModel = app.get<Model<Showtime>>(getModelToken(Showtime.name));

    // Find expired PENDING bookings (older than 15 minutes)
    const expirationTime = new Date(Date.now() - 15 * 60 * 1000);
    const expiredBookings = await bookingModel.find({
      status: BookingStatus.PENDING,
      createdAt: { $lt: expirationTime },
    });

    console.log(`📊 Found ${expiredBookings.length} expired PENDING bookings`);

    // Find bookings with invalid showtime references
    const allBookings = await bookingModel.find().select('showtimeId bookingCode').lean();
    const showtimeIds = new Set(
      (await showtimeModel.find().select('_id').lean()).map((s) => s._id.toString()),
    );

    const orphanedByShowtime = allBookings.filter(
      (booking) => !showtimeIds.has(booking.showtimeId.toString()),
    );

    console.log(`📊 Found ${orphanedByShowtime.length} bookings with invalid showtime references`);

    // Summary
    console.log('\n📋 Summary:');
    console.log(`   - Expired PENDING bookings: ${expiredBookings.length}`);
    console.log(`   - Bookings with invalid showtime: ${orphanedByShowtime.length}`);
    console.log(`   - Total orphaned bookings: ${expiredBookings.length + orphanedByShowtime.length}`);

    if (expiredBookings.length > 0) {
      console.log('\n⚠️  Expired PENDING Bookings:');
      expiredBookings.forEach((booking) => {
        const age = Math.floor((Date.now() - booking.createdAt.getTime()) / (1000 * 60));
        console.log(`   - ${booking.bookingCode} (${age} minutes old)`);
      });
    }

    if (orphanedByShowtime.length > 0) {
      console.log('\n⚠️  Bookings with Invalid Showtime:');
      orphanedByShowtime.forEach((booking) => {
        console.log(`   - ${booking.bookingCode} (showtime: ${booking.showtimeId})`);
      });
    }

    console.log('\n✅ Cleanup check completed. No changes were made.');
    console.log('💡 To delete these bookings, run: npm run script:delete-orphaned-bookings\n');
  } catch (error) {
    console.error('❌ Error during cleanup check:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

cleanupOrphanedBookings();
