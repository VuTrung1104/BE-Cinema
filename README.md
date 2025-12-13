# Movie Booking API

API RESTful cho ứng dụng đặt vé xem phim được xây dựng bằng NestJS, MongoDB, và JWT Authentication.

## 🚀 Công nghệ sử dụng

- **Framework**: NestJS
- **Database**: MongoDB với Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: class-validator & class-transformer
- **Configuration**: @nestjs/config

## 📁 Cấu trúc dự án

```
movie-booking-api/
├── src/
│   ├── auth/                    # Xác thực JWT & Passport
│   │   ├── decorators/          # Custom decorators (@GetUser, @Roles)
│   │   ├── dto/                 # DTOs cho authentication
│   │   ├── guards/              # Guards (JWT, Roles)
│   │   ├── strategies/          # Passport strategies
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── users/                   # Quản lý người dùng
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── movies/                  # Quản lý phim
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── movies.controller.ts
│   │   ├── movies.service.ts
│   │   └── movies.module.ts
│   ├── theaters/                # Quản lý rạp chiếu
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── theaters.controller.ts
│   │   ├── theaters.service.ts
│   │   └── theaters.module.ts
│   ├── showtimes/               # Quản lý suất chiếu
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── showtimes.controller.ts
│   │   ├── showtimes.service.ts
│   │   └── showtimes.module.ts
│   ├── bookings/                # Quản lý đặt vé
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── bookings.controller.ts
│   │   ├── bookings.service.ts
│   │   └── bookings.module.ts
│   ├── payments/                # Quản lý thanh toán
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   └── payments.module.ts
│   ├── database/                # Database configuration
│   │   └── database.module.ts
│   ├── app.module.ts            # Root module
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts                  # Entry point
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## 🛠️ Cài đặt

### 1. Clone repository

```bash
cd movie-booking-api
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cấu hình môi trường

Sao chép file `.env.example` thành `.env` và cấu hình:

```env
DATABASE_URL=mongodb://localhost:27017/movie-booking
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### 4. Khởi động MongoDB

Đảm bảo MongoDB đang chạy:

```bash
# Windows
net start MongoDB

# Mac/Linux
sudo systemctl start mongod
```

### 5. Chạy ứng dụng

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`

## 📚 API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Đăng ký tài khoản mới
- `POST /api/v1/auth/login` - Đăng nhập

### Users

- `GET /api/v1/users` - Lấy danh sách users (Admin only)
- `GET /api/v1/users/me` - Lấy thông tin user hiện tại
- `GET /api/v1/users/:id` - Lấy thông tin user theo ID (Admin only)

### Movies

- `GET /api/v1/movies` - Lấy danh sách phim
- `GET /api/v1/movies/:id` - Lấy chi tiết phim
- `POST /api/v1/movies` - Tạo phim mới (Admin only)
- `PATCH /api/v1/movies/:id` - Cập nhật phim (Admin only)
- `DELETE /api/v1/movies/:id` - Xóa phim (Admin only)

### Theaters

- `GET /api/v1/theaters` - Lấy danh sách rạp
- `GET /api/v1/theaters/:id` - Lấy chi tiết rạp
- `POST /api/v1/theaters` - Tạo rạp mới (Admin only)
- `PATCH /api/v1/theaters/:id` - Cập nhật rạp (Admin only)
- `DELETE /api/v1/theaters/:id` - Xóa rạp (Admin only)

### Showtimes

- `GET /api/v1/showtimes` - Lấy danh sách suất chiếu
- `GET /api/v1/showtimes/:id` - Lấy chi tiết suất chiếu
- `GET /api/v1/showtimes/:id/seats` - Lấy thông tin ghế trống
- `POST /api/v1/showtimes` - Tạo suất chiếu mới (Admin only)
- `DELETE /api/v1/showtimes/:id` - Xóa suất chiếu (Admin only)

### Bookings

- `GET /api/v1/bookings` - Lấy danh sách đặt vé
- `GET /api/v1/bookings/:id` - Lấy chi tiết đặt vé
- `GET /api/v1/bookings/code/:code` - Tìm đặt vé theo mã
- `POST /api/v1/bookings` - Đặt vé mới
- `PATCH /api/v1/bookings/:id/confirm` - Xác nhận đặt vé (Admin only)
- `PATCH /api/v1/bookings/:id/cancel` - Hủy đặt vé

### Payments

- `GET /api/v1/payments` - Lấy danh sách thanh toán (Admin only)
- `GET /api/v1/payments/:id` - Lấy chi tiết thanh toán
- `POST /api/v1/payments` - Tạo thanh toán mới
- `POST /api/v1/payments/:id/process` - Xử lý thanh toán
- `PATCH /api/v1/payments/:id/refund` - Hoàn tiền (Admin only)

## 🔐 Authentication

API sử dụng JWT Bearer token. Sau khi đăng nhập, sử dụng token trong header:

```
Authorization: Bearer <your-jwt-token>
```

## 👥 User Roles

- **admin**: Toàn quyền quản lý
- **user**: Người dùng thông thường (đặt vé, xem thông tin)

## 📝 Ví dụ sử dụng

### 1. Đăng ký tài khoản

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "phone": "0123456789"
}
```

### 2. Đăng nhập

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 3. Tạo phim mới (Admin)

```bash
POST /api/v1/movies
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "title": "The Matrix",
  "description": "A computer hacker learns about the true nature of reality",
  "genres": ["sci-fi", "action"],
  "duration": 136,
  "releaseDate": "1999-03-31",
  "director": "The Wachowskis",
  "cast": ["Keanu Reeves", "Laurence Fishburne"],
  "rating": 8.7
}
```

### 4. Đặt vé

```bash
POST /api/v1/bookings
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "showtimeId": "507f1f77bcf86cd799439011",
  "seats": ["A1", "A2", "A3"]
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Build

```bash
npm run build
```

## 🚀 Deployment

1. Cấu hình biến môi trường production
2. Build ứng dụng: `npm run build`
3. Chạy: `npm run start:prod`


