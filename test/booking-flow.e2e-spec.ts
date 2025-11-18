import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Booking Flow (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let adminToken: string;
  let movieId: string;
  let theaterId: string;
  let showtimeId: string;
  let bookingId: string;
  let paymentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    // Create user account
    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `user${Date.now()}@example.com`,
        password: 'password123',
        fullName: 'Test User',
      });
    userToken = userRes.body.accessToken;

    // Create admin account (manually set role in real scenario)
    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `admin${Date.now()}@example.com`,
        password: 'password123',
        fullName: 'Test Admin',
        role: 'admin',
      });
    adminToken = adminRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Booking Flow', () => {
    it('Step 1: Admin creates a movie', async () => {
      const movieDto = {
        title: 'Test Movie',
        description: 'A test movie for booking',
        genres: ['action', 'drama'],
        duration: 120,
        releaseDate: new Date('2024-12-25'),
        director: 'Test Director',
        rating: 8.5,
        isNowShowing: true,
      };

      const res = await request(app.getHttpServer())
        .post('/movies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(movieDto)
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.title).toBe(movieDto.title);
      movieId = res.body._id;
    });

    it('Step 2: Admin creates a theater', async () => {
      const theaterDto = {
        name: 'CGV Test Theater',
        location: '123 Test Street',
        totalSeats: 100,
        seats: Array.from({ length: 100 }, (_, i) => `A${i + 1}`),
      };

      const res = await request(app.getHttpServer())
        .post('/theaters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(theaterDto)
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe(theaterDto.name);
      theaterId = res.body._id;
    });

    it('Step 3: Admin creates a showtime', async () => {
      const showtimeDto = {
        movieId,
        theaterId,
        startTime: new Date('2024-12-25T19:00:00'),
        endTime: new Date('2024-12-25T21:00:00'),
        price: 100000,
      };

      const res = await request(app.getHttpServer())
        .post('/showtimes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(showtimeDto)
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.price).toBe(showtimeDto.price);
      showtimeId = res.body._id;
    });

    it('Step 4: User views available movies', async () => {
      const res = await request(app.getHttpServer())
        .get('/movies')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const movie = res.body.find((m) => m._id === movieId);
      expect(movie).toBeDefined();
    });

    it('Step 5: User views showtimes for the movie', async () => {
      const res = await request(app.getHttpServer())
        .get('/showtimes')
        .query({ movieId })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const showtime = res.body.find((s) => s._id === showtimeId);
      expect(showtime).toBeDefined();
    });

    it('Step 6: User checks seat availability', async () => {
      const res = await request(app.getHttpServer())
        .get(`/showtimes/${showtimeId}/seats`)
        .expect(200);

      expect(res.body).toHaveProperty('availableSeats');
      expect(Array.isArray(res.body.availableSeats)).toBe(true);
      expect(res.body.availableSeats.length).toBeGreaterThan(0);
    });

    it('Step 7: User creates a booking', async () => {
      const bookingDto = {
        showtimeId,
        seats: ['A1', 'A2'],
      };

      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingDto)
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body).toHaveProperty('bookingCode');
      expect(res.body.seats).toEqual(bookingDto.seats);
      expect(res.body.totalPrice).toBe(200000); // 2 seats * 100000
      expect(res.body.status).toBe('pending');
      bookingId = res.body._id;
    });

    it('Step 8: User cannot book already booked seats', async () => {
      const bookingDto = {
        showtimeId,
        seats: ['A1', 'A3'], // A1 is already booked
      };

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingDto)
        .expect(400);
    });

    it('Step 9: User creates payment for booking', async () => {
      const paymentDto = {
        bookingId,
        amount: 200000,
        method: 'credit_card',
      };

      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentDto)
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body).toHaveProperty('transactionId');
      expect(res.body.status).toBe('pending');
      paymentId = res.body._id;
    });

    it('Step 10: Process payment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/process`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.status).toBe('completed');
      expect(res.body).toHaveProperty('paidAt');
    });

    it('Step 11: Verify booking is confirmed after payment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.status).toBe('confirmed');
    });

    it('Step 12: User views their bookings', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const booking = res.body.find((b) => b._id === bookingId);
      expect(booking).toBeDefined();
      expect(booking.status).toBe('confirmed');
    });

    it('Step 13: User cannot cancel confirmed booking', async () => {
      await request(app.getHttpServer())
        .patch(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });
  });

  describe('Booking Cancellation Flow', () => {
    let cancelBookingId: string;

    it('should create a booking and cancel it before payment', async () => {
      // Create showtime if needed
      const showtimeDto = {
        movieId,
        theaterId,
        startTime: new Date('2024-12-26T19:00:00'),
        endTime: new Date('2024-12-26T21:00:00'),
        price: 100000,
      };

      const showtimeRes = await request(app.getHttpServer())
        .post('/showtimes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(showtimeDto);

      const newShowtimeId = showtimeRes.body._id;

      // Create booking
      const bookingDto = {
        showtimeId: newShowtimeId,
        seats: ['B1', 'B2'],
      };

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingDto)
        .expect(201);

      cancelBookingId = bookingRes.body._id;
      expect(bookingRes.body.status).toBe('pending');

      // Cancel booking
      const cancelRes = await request(app.getHttpServer())
        .patch(`/bookings/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cancelRes.body.status).toBe('cancelled');

      // Verify seats are released
      const seatsRes = await request(app.getHttpServer())
        .get(`/showtimes/${newShowtimeId}/seats`)
        .expect(200);

      expect(seatsRes.body.availableSeats).toContain('B1');
      expect(seatsRes.body.availableSeats).toContain('B2');
    });
  });
});
