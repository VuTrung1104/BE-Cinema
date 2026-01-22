const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcrypt');

// Define schemas directly
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: String,
  password: String,
  fullName: String,
  phoneNumber: String,
  role: String,
  isActive: Boolean,
  isEmailVerified: Boolean,
  dateOfBirth: Date,
  avatar: String,
  isLocked: { type: Boolean, default: false },
  violationCount: { type: Number, default: 0 },
}, { timestamps: true });

const MovieSchema = new Schema({
  title: String,
  slug: String,
  description: String,
  duration: Number,
  releaseDate: Date,
  genres: [String],
  director: String,
  cast: [String],
  rating: Number,
  posterUrl: String,
  trailerUrl: String,
  language: String,
  ageRating: String,
  isNowShowing: Boolean,
  status: String,
}, { timestamps: true });

const TheaterSchema = new Schema({
  name: String,
  address: String,
  city: String,
  phoneNumber: String,
  totalScreens: Number,
  facilities: [String],
  isActive: Boolean,
}, { timestamps: true });

const ShowtimeSchema = new Schema({
  movieId: { type: Schema.Types.ObjectId, ref: 'Movie' },
  theaterId: { type: Schema.Types.ObjectId, ref: 'Theater' },
  startTime: Date,
  endTime: Date,
  screenNumber: Number,
  format: String,
  language: String,
  subtitles: String,
  seats: [{
    row: String,
    number: Number,
    isAvailable: Boolean,
    price: Number,
  }],
  tempLockedSeats: [{
    row: String,
    number: Number,
    userId: String,
    expiresAt: Date,
  }],
  isActive: Boolean,
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Movie = mongoose.model('Movie', MovieSchema);
const Theater = mongoose.model('Theater', TheaterSchema);
const Showtime = mongoose.model('Showtime', ShowtimeSchema);

function generateSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function seedData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to MongoDB\n');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Movie.deleteMany({});
    await Theater.deleteMany({});
    await Showtime.deleteMany({});
    console.log('Cleared existing data\n');

    // 1. Seed Admin User
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
    const admin = await User.create({
      email: process.env.ADMIN_EMAIL || 'admin@cinema.com',
      password: hashedPassword,
      fullName: process.env.ADMIN_NAME || 'System Administrator',
      phoneNumber: process.env.ADMIN_PHONE || '0123456789',
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    });
    console.log(`Admin created: ${admin.email} / ${process.env.ADMIN_PASSWORD || 'Admin@123'}\n`);

    // 2. Seed Regular Users
    console.log('Creating regular users...');
    const users = await User.create([
      {
        email: 'user1@gmail.com',
        password: await bcrypt.hash('User@123', 10),
        fullName: 'Nguyen Van A',
        phoneNumber: '0987654321',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
      },
      {
        email: 'user2@gmail.com',
        password: await bcrypt.hash('User@123', 10),
        fullName: 'Tran Thi B',
        phoneNumber: '0912345678',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
      },
    ]);
    console.log(`Created ${users.length} regular users\n`);

    // 3. Seed Movies
    console.log('Creating movies...');
    const movies = await Movie.create([
      {
        title: 'Avatar: The Way of Water',
        slug: generateSlug('Avatar: The Way of Water'),
        description: 'Jake Sully lives with his newfound family formed on the extrasolar moon Pandora. Once a familiar threat returns to finish what was previously started, Jake must work with Neytiri and the army of the Na\'vi race to protect their home.',
        duration: 192,
        releaseDate: new Date('2022-12-16'),
        genres: ['Action', 'Adventure', 'Fantasy'],
        director: 'James Cameron',
        cast: ['Sam Worthington', 'Zoe Saldana', 'Sigourney Weaver'],
        rating: 7.8,
        posterUrl: 'https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=d9MyW72ELq0',
        language: 'English',
        ageRating: 'PG-13',
        isNowShowing: true,
        status: 'now-showing',
      },
      {
        title: 'Top Gun: Maverick',
        slug: generateSlug('Top Gun: Maverick'),
        description: 'After thirty years, Maverick is still pushing the envelope as a top naval aviator, but must confront ghosts of his past when he leads TOP GUN\'s elite graduates on a mission that demands the ultimate sacrifice from those chosen to fly it.',
        duration: 130,
        releaseDate: new Date('2022-05-27'),
        genres: ['Action', 'Drama'],
        director: 'Joseph Kosinski',
        cast: ['Tom Cruise', 'Jennifer Connelly', 'Miles Teller'],
        rating: 8.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=qSqVVswa420',
        language: 'English',
        ageRating: 'PG-13',
        isNowShowing: true,
        status: 'now-showing',
      },
      {
        title: 'Spider-Man: No Way Home',
        slug: generateSlug('Spider-Man: No Way Home'),
        description: 'Peter Parker seeks Doctor Strange\'s help to make people forget he is Spider-Man. When a spell goes wrong, dangerous foes from other worlds start to appear, forcing Peter to discover what it truly means to be Spider-Man.',
        duration: 148,
        releaseDate: new Date('2021-12-17'),
        genres: ['Action', 'Adventure', 'Fantasy'],
        director: 'Jon Watts',
        cast: ['Tom Holland', 'Zendaya', 'Benedict Cumberbatch'],
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=JfVOs4VSpmA',
        language: 'English',
        ageRating: 'PG-13',
        isNowShowing: true,
        status: 'now-showing',
      },
      {
        title: 'The Batman',
        slug: generateSlug('The Batman'),
        description: 'In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.',
        duration: 176,
        releaseDate: new Date('2022-03-04'),
        genres: ['Action', 'Crime', 'Drama'],
        director: 'Matt Reeves',
        cast: ['Robert Pattinson', 'Zoë Kravitz', 'Paul Dano'],
        rating: 7.8,
        posterUrl: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=mqqft2x_Aa4',
        language: 'English',
        ageRating: 'PG-13',
        isNowShowing: false,
        status: 'ended',
      },
      {
        title: 'Everything Everywhere All at Once',
        slug: generateSlug('Everything Everywhere All at Once'),
        description: 'An aging Chinese immigrant is swept up in an insane adventure, where she alone can save what\'s important to her by connecting with the lives she could have led in other universes.',
        duration: 139,
        releaseDate: new Date('2022-03-25'),
        genres: ['Action', 'Adventure', 'Comedy'],
        director: 'Daniel Kwan, Daniel Scheinert',
        cast: ['Michelle Yeoh', 'Stephanie Hsu', 'Jamie Lee Curtis'],
        rating: 7.8,
        posterUrl: 'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=wxN1T1uxQ2g',
        language: 'English',
        ageRating: 'R',
        isNowShowing: true,
        status: 'now-showing',
      },
    ]);
    console.log(`Created ${movies.length} movies\n`);

    // 4. Seed Theaters
    console.log('Creating theaters...');
    const theaters = await Theater.create([
      {
        name: 'CGV Vincom Center',
        address: '72 Le Thanh Ton, District 1',
        city: 'Ho Chi Minh City',
        phoneNumber: '1900-6017',
        totalScreens: 8,
        facilities: ['3D', 'IMAX', '4DX', 'Dolby Atmos'],
        isActive: true,
      },
      {
        name: 'Galaxy Nguyen Du',
        address: '116 Nguyen Du, District 1',
        city: 'Ho Chi Minh City',
        phoneNumber: '1900-2224',
        totalScreens: 6,
        facilities: ['3D', 'Dolby Atmos'],
        isActive: true,
      },
      {
        name: 'Lotte Cinema Diamond Plaza',
        address: '34 Le Duan, District 1',
        city: 'Ho Chi Minh City',
        phoneNumber: '1900-5454',
        totalScreens: 10,
        facilities: ['3D', 'IMAX', 'Dolby Atmos', 'VIP Lounge'],
        isActive: true,
      },
      {
        name: 'BHD Star Cineplex',
        address: '3/2 Street, District 10',
        city: 'Ho Chi Minh City',
        phoneNumber: '1900-2099',
        totalScreens: 5,
        facilities: ['3D', 'Dolby Atmos'],
        isActive: true,
      },
    ]);
    console.log(`Created ${theaters.length} theaters\n`);

    // 5. Seed Showtimes
    console.log('Creating showtimes...');
    const showtimes = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create showtimes for next 7 days
    for (let day = 0; day < 7; day++) {
      const showtimeDate = new Date(today);
      showtimeDate.setDate(today.getDate() + day);

      // Only create showtimes for movies that are now showing
      const nowShowingMovies = movies.filter(m => m.status === 'now-showing');

      for (const movie of nowShowingMovies) {
        for (const theater of theaters.slice(0, 2)) { // First 2 theaters
          // Create 3 showtimes per day
          const times = ['10:00', '14:30', '19:00'];

          for (const time of times) {
            const [hours, minutes] = time.split(':');
            const startTime = new Date(showtimeDate);
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + movie.duration);

            // Generate seats (50 seats: 5 rows x 10 columns)
            const seats = [];
            const rows = ['A', 'B', 'C', 'D', 'E'];
            for (const row of rows) {
              for (let col = 1; col <= 10; col++) {
                seats.push({
                  row,
                  number: col,
                  isAvailable: true,
                  price: row === 'A' || row === 'B' ? 150000 : 120000, // VIP rows more expensive
                });
              }
            }

            showtimes.push({
              movieId: movie._id,
              theaterId: theater._id,
              startTime,
              endTime,
              screenNumber: Math.floor(Math.random() * theater.totalScreens) + 1,
              format: movie.genres.includes('Action') ? '3D' : '2D',
              language: movie.language,
              subtitles: 'Vietnamese',
              seats,
              isActive: true,
            });
          }
        }
      }
    }

    await Showtime.insertMany(showtimes);
    console.log(`Created ${showtimes.length} showtimes\n`);

    // Summary
    console.log('SEED DATA SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Users: ${users.length + 1} (${users.length} regular + 1 admin)`);
    console.log(`Movies: ${movies.length} (${movies.filter(m => m.status === 'now-showing').length} now showing)`);
    console.log(`Theaters: ${theaters.length}`);
    console.log(`Showtimes: ${showtimes.length}`);
    console.log('='.repeat(50));
    console.log('\nSeed data created successfully!\n');

    console.log('LOGIN CREDENTIALS:');
    console.log('  Admin: admin@cinema.com / Admin@123');
    console.log('  User1: user1@gmail.com / User@123');
    console.log('  User2: user2@gmail.com / User@123\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedData();
