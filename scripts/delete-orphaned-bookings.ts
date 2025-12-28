import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { Booking, BookingStatus } from '../src/bookings/schemas/booking.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Showtime } from '../src/showtimes/schemas/showtime.schema';
import * as readline from 'readline';

/**
 * Script to delete orphaned bookings
 * Orphaned bookings are bookings that:
 * 1. Are in PENDING status for more than 15 minutes
 * 2. Reference non-existent showtimes
 */
async function deleteOrphanedBookings() {
  console.log('🗑️  Starting orphaned bookings deletion...\n');

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

    // Find bookings with invalid showtime references
    const allBookings = await bookingModel.find().select('_id showtimeId bookingCode').lean();
    const showtimeIds = new Set(
      (await showtimeModel.find().select('_id').lean()).map((s) => s._id.toString()),
    );

    const orphanedByShowtime = allBookings.filter(
      (booking) => !showtimeIds.has(booking.showtimeId.toString()),
    );

    const totalOrphaned = expiredBookings.length + orphanedByShowtime.length;

    if (totalOrphaned === 0) {
      console.log('✅ No orphaned bookings found. Nothing to delete.\n');
      await app.close();
      return;
    }

    console.log('📊 Found orphaned bookings:');
    console.log(`   - Expired PENDING bookings: ${expiredBookings.length}`);
    console.log(`   - Bookings with invalid showtime: ${orphanedByShowtime.length}`);
    console.log(`   - Total: ${totalOrphaned}\n`);

    // Ask for confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('⚠️  Are you sure you want to DELETE these bookings? (yes/no): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled.\n');
      await app.close();
      return;
    }

    console.log('\n🔄 Deleting orphaned bookings...');

    let deletedCount = 0;

    // Delete expired PENDING bookings
    if (expiredBookings.length > 0) {
      const expiredIds = expiredBookings.map((b) => b._id);
      const result = await bookingModel.deleteMany({
        _id: { $in: expiredIds },
      });
      deletedCount += result.deletedCount;
      console.log(`   ✅ Deleted ${result.deletedCount} expired PENDING bookings`);
    }

    // Delete bookings with invalid showtimes
    if (orphanedByShowtime.length > 0) {
      const orphanedIds = orphanedByShowtime.map((b) => b._id);
      const result = await bookingModel.deleteMany({
        _id: { $in: orphanedIds },
      });
      deletedCount += result.deletedCount;
      console.log(`   ✅ Deleted ${result.deletedCount} bookings with invalid showtimes`);
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} orphaned bookings\n`);
  } catch (error) {
    console.error('❌ Error during deletion:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

deleteOrphanedBookings();
