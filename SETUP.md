# Guide setup

## Bước 1: Cài đặt MongoDB

### Windows:
1. Tải MongoDB Community Server từ: https://www.mongodb.com/try/download/community
2. Cài đặt và chạy MongoDB service
3. Kiểm tra: `mongosh` trong terminal

### Mac:
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Linux:
```bash
sudo apt-get install mongodb
sudo systemctl start mongod
```

## Bước 2: Cấu hình Environment

File `.env` đã được tạo với cấu hình mặc định:

```env
DATABASE_URL=mongodb://localhost:27017/movie-booking
JWT_SECRET=super-secret-jwt-key-12345
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

**Lưu ý**: Đổi `JWT_SECRET` trong production

## Bước 3: Cài đặt Dependencies

```bash
cd movie-booking-api
npm install
```

## Bước 4: Chạy ứng dụng

```bash
# Development mode with auto-reload
npm run start:dev
```

Ứng dụng sẽ chạy tại: **http://localhost:3000**

## Bước 5: Test API

### Kiểm tra Health Check:
```bash
curl http://localhost:3000/api/v1
```

### Đăng ký user đầu tiên:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@movie.com",
    "password": "admin123",
    "fullName": "Admin User",
    "role": "admin"
  }'
```

### Đăng nhập:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@movie.com",
    "password": "admin123"
  }'
```

Lưu token từ response để sử dụng cho các request khác.

## Checklist Setup

- [ ] MongoDB đã cài đặt và đang chạy
- [ ] File `.env` đã được cấu hình
- [ ] Dependencies đã được cài đặt (`npm install`)
- [ ] Ứng dụng chạy thành công (`npm run start:dev`)
- [ ] Đã test health check endpoint
- [ ] Đã tạo user admin đầu tiên

## Useful Commands

```bash
# Start development server
npm run start:dev

# Build for production
npm run build

# Run production build
npm run start:prod

# Run tests
npm run test

# Format code
npm run format

# Lint code
npm run lint
```

## Troubleshooting

### Lỗi kết nối MongoDB:
```bash
# Kiểm tra MongoDB đang chạy
mongosh

# Hoặc check service
# Windows:
net start MongoDB

# Mac/Linux:
sudo systemctl status mongod
```

### Lỗi Port đã được sử dụng:
Đổi PORT trong file `.env` thành port khác (vd: 3001)

### Lỗi dependencies:
```bash
# Xóa node_modules và cài lại
rm -rf node_modules
npm install
```
