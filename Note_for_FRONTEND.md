# Hướng Dẫn Tích Hợp Frontend - BE Cinema API

## Tình trạng dự án: SẴN SÀNG cho Frontend Integration

Backend đã hoàn thiện đầy đủ các tính năng cần thiết để frontend bắt đầu phát triển.

---

## Thông tin cơ bản

### Base URL
```
http://localhost:3000/api/v1
```

### API Documentation (Swagger)
```
http://localhost:3000/api/docs
```

### Các module chính
1. **Authentication** - Đăng ký, đăng nhập, JWT, OAuth, OTP, Reset password
2. **Users** - Quản lý người dùng, profile, avatar upload
3. **Movies** - Quản lý phim (CRUD, pagination, search)
4. **Theaters** - Quản lý rạp chiếu
5. **Showtimes** - Quản lý suất chiếu
6. **Bookings** - Đặt vé với seat locking (Redis)
7. **Payments** - Thanh toán VNPay, QR code, email confirmation

---

## 1. Cấu hình Frontend

### Cài đặt Axios
```bash
npm install axios
# hoặc
yarn add axios
```

### Tạo API Client (src/api/client.ts)
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Tự động thêm token vào mỗi request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Xử lý lỗi 401 (token hết hạn)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu token hết hạn (401) và chưa retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(
          'http://localhost:3000/api/v1/auth/refresh',
          { refreshToken }
        );

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);

        // Retry request với token mới
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token cũng hết hạn → Đăng xuất
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### Environment Variables (.env)
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_FRONTEND_URL=http://localhost:3001
```

---

## 2. Authentication Flow

### Đăng ký (Register)
```typescript
// POST /auth/register
const register = async (data: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) => {
  const response = await api.post('/auth/register', data);
  return response.data; // { accessToken, refreshToken, user }
};
```

### Đăng nhập (Login)
```typescript
// POST /auth/login
const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  const { accessToken, refreshToken, user } = response.data;
  
  // Lưu tokens
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
  
  return response.data;
};
```

### Đăng xuất (Logout)
```typescript
const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
};
```

### OAuth (Google/Facebook)
```typescript
// Redirect đến backend OAuth URL
const loginWithGoogle = () => {
  window.location.href = 'http://localhost:3000/api/v1/auth/google';
};

const loginWithFacebook = () => {
  window.location.href = 'http://localhost:3000/api/v1/auth/facebook';
};

// Backend sẽ redirect về: http://localhost:3001/auth/callback?token=xxx&refreshToken=yyy
// Frontend xử lý callback:
const handleOAuthCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const refreshToken = params.get('refreshToken');
  
  if (token && refreshToken) {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    window.location.href = '/';
  }
};
```

### OTP Verification
```typescript
// POST /auth/send-otp
const sendOTP = async (email: string) => {
  await api.post('/auth/send-otp', { email });
};

// POST /auth/verify-otp
const verifyOTP = async (email: string, otp: string) => {
  const response = await api.post('/auth/verify-otp', { email, otp });
  return response.data;
};
```

### Reset Password
```typescript
// POST /auth/forgot-password
const forgotPassword = async (email: string) => {
  await api.post('/auth/forgot-password', { email });
  // OTP sẽ được gửi qua email
};

// POST /auth/reset-password
const resetPassword = async (email: string, otp: string, newPassword: string) => {
  await api.post('/auth/reset-password', { email, otp, newPassword });
};
```

---

## 3. Movies API

### Lấy danh sách phim (có pagination & search)
```typescript
// GET /movies?page=1&limit=10&search=avengers
const getMovies = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const response = await api.get('/movies', { params });
  return response.data;
  /*
  {
    data: [
      {
        _id: "...",
        title: "Avengers: Endgame",
        description: "...",
        duration: 181,
        releaseDate: "2019-04-26",
        genre: ["Action", "Adventure"],
        director: "Russo Brothers",
        cast: ["Robert Downey Jr.", "Chris Evans"],
        rating: 8.4,
        posterUrl: "https://...",
        trailerUrl: "https://..."
      }
    ],
    meta: {
      total: 100,
      page: 1,
      limit: 10,
      totalPages: 10,
      hasNextPage: true,
      hasPrevPage: false
    }
  }
  */
};
```

### Lấy chi tiết phim
```typescript
// GET /movies/:id
const getMovieById = async (id: string) => {
  const response = await api.get(`/movies/${id}`);
  return response.data;
};
```

---

## 4. Theaters & Showtimes

### Lấy danh sách rạp
```typescript
// GET /theaters?city=Hanoi
const getTheaters = async (city?: string) => {
  const response = await api.get('/theaters', { params: { city } });
  return response.data;
};
```

### Lấy suất chiếu theo phim/rạp/ngày
```typescript
// GET /showtimes?movieId=xxx&theaterId=yyy&date=2024-12-13
const getShowtimes = async (params: {
  movieId?: string;
  theaterId?: string;
  date?: string; // YYYY-MM-DD
}) => {
  const response = await api.get('/showtimes', { params });
  return response.data;
};
```

### Kiểm tra ghế trống
```typescript
// GET /showtimes/:id/seats
const getAvailableSeats = async (showtimeId: string) => {
  const response = await api.get(`/showtimes/${showtimeId}/seats`);
  return response.data;
  /*
  {
    totalSeats: 100,
    availableSeats: 85,
    bookedSeats: ["A1", "A2", "B5"],
    lockedSeats: ["C3"] // Ghế đang được giữ bởi user khác
  }
  */
};
```

---

## 5. Booking Flow (QUAN TRỌNG)

### Bước 1: Tạo booking (status: PENDING)
```typescript
// POST /bookings
const createBooking = async (data: {
  showtimeId: string;
  seats: string[]; // ["A1", "A2", "B5"]
  totalPrice?: number; // Optional, backend sẽ tính
}) => {
  const response = await api.post('/bookings', data);
  return response.data;
  /*
  {
    _id: "...",
    bookingCode: "BK20241213ABC123",
    status: "PENDING", // Chờ thanh toán
    showtimeId: "...",
    seats: ["A1", "A2"],
    totalPrice: 200000,
    expiresAt: "2024-12-13T10:20:00Z" // Hết hạn sau 10 phút
  }
  */
};

// LƯU Ý: 
// - Ghế sẽ được lock trong Redis trong 10 phút
// - Nếu không thanh toán trong 10 phút, booking sẽ bị hủy tự động
// - Frontend nên hiển thị countdown timer
```

### Bước 2: Tạo payment URL (VNPay)
```typescript
// POST /payments/vnpay/create
const createVNPayPayment = async (data: {
  bookingId: string;
  amount: number;
  bankCode?: string; // Optional: "VNBANK", "INTCARD", "VISA"
}) => {
  const response = await api.post('/payments/vnpay/create', data);
  return response.data;
  /*
  {
    paymentId: "...",
    paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=..."
  }
  */
};

// Frontend redirect user đến paymentUrl
window.location.href = paymentUrl;
```

### Bước 3: Xử lý callback từ VNPay
```typescript
// VNPay sẽ redirect về: http://localhost:3001/payment/success?bookingId=xxx
// hoặc: http://localhost:3001/payment/failed?message=xxx

const handlePaymentReturn = () => {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('bookingId');
  const message = params.get('message');
  
  if (bookingId) {
    // Thanh toán thành công
    // Backend đã tự động:
    // 1. Confirm booking (status: CONFIRMED)
    // 2. Release seats từ Redis
    // 3. Gửi email xác nhận kèm QR code
    
    // Frontend hiển thị thông báo thành công
    alert('Đặt vé thành công! Kiểm tra email để nhận QR code.');
  } else {
    // Thanh toán thất bại
    alert(`Thanh toán thất bại: ${message}`);
  }
};
```

### Lấy thông tin booking
```typescript
// GET /bookings/:id
const getBookingById = async (id: string) => {
  const response = await api.get(`/bookings/${id}`);
  return response.data;
};

// GET /bookings/code/:code
const getBookingByCode = async (code: string) => {
  const response = await api.get(`/bookings/code/${code}`);
  return response.data;
};

// GET /bookings (lấy tất cả bookings của user hiện tại)
const getMyBookings = async () => {
  const response = await api.get('/bookings');
  return response.data;
};
```

### Hủy booking
```typescript
// PATCH /bookings/:id/cancel
const cancelBooking = async (id: string) => {
  const response = await api.patch(`/bookings/${id}/cancel`);
  return response.data;
};
```

### Xác thực QR Code (tại rạp)
```typescript
// POST /bookings/verify-qr
const verifyQRCode = async (qrData: string) => {
  const response = await api.post('/bookings/verify-qr', { qrData });
  return response.data;
  /*
  {
    valid: true,
    booking: { ... },
    message: "QR code hợp lệ"
  }
  */
};
```

---

## 6. User Profile

### Lấy thông tin user
```typescript
// GET /users/profile
const getProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data;
};
```

### Cập nhật profile
```typescript
// PATCH /users/profile
const updateProfile = async (data: {
  fullName?: string;
  phone?: string;
}) => {
  const response = await api.patch('/users/profile', data);
  return response.data;
};
```

### Upload avatar
```typescript
// POST /users/avatar
const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  return response.data; // { avatarUrl: "https://cloudinary.com/..." }
};
```

---

## 7. Xử lý Lỗi

### Error Response Format
```typescript
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}

// Example:
{
  statusCode: 400,
  message: ["email must be an email", "password is too short"],
  error: "Bad Request",
  timestamp: "2024-12-13T10:00:00.000Z",
  path: "/api/v1/auth/register"
}
```

### Xử lý lỗi trong component
```typescript
const handleError = (error: any) => {
  if (error.response) {
    const { statusCode, message } = error.response.data;
    
    switch (statusCode) {
      case 400:
        alert(`Dữ liệu không hợp lệ: ${Array.isArray(message) ? message.join(', ') : message}`);
        break;
      case 401:
        alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        logout();
        break;
      case 403:
        alert('Bạn không có quyền thực hiện hành động này.');
        break;
      case 404:
        alert('Không tìm thấy dữ liệu.');
        break;
      case 409:
        alert('Dữ liệu đã tồn tại (ví dụ: email đã được sử dụng).');
        break;
      case 500:
        alert('Lỗi server. Vui lòng thử lại sau.');
        break;
      default:
        alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  } else {
    alert('Không thể kết nối đến server.');
  }
};

// Sử dụng:
try {
  await login(email, password);
} catch (error) {
  handleError(error);
}
```

---

## 8. Tính năng nâng cao

### Rate Limiting
- Backend có rate limiting: **10 requests/60s** cho tất cả endpoints
- Frontend nên debounce các request (ví dụ: search input)

### Redis Seat Locking
- Ghế sẽ được lock trong **10 phút** khi user tạo booking
- Frontend nên:
  1. Hiển thị countdown timer (10 phút)
  2. Cảnh báo khi còn < 2 phút
  3. Tự động redirect về trang chọn ghế khi hết thời gian

### Email Notifications
Backend tự động gửi email khi:
- User đăng ký (welcome email)
- Booking được confirm (email kèm QR code)
- Payment thành công (payment receipt)

### QR Code
- QR code được tạo sau khi booking CONFIRMED
- Chứa thông tin: bookingId, bookingCode, seats, totalPrice
- QR code có thời hạn: **30 ngày** kể từ ngày tạo
- Sử dụng để check-in tại rạp

---

## 9. Testing với Swagger

1. Truy cập: http://localhost:3000/api/docs
2. Click nút **"Authorize"** ở góc phải
3. Nhập: `Bearer <your-access-token>`
4. Click **"Authorize"** → **"Close"**
5. Bây giờ có thể test tất cả APIs cần authentication

---

## 10. Checklist cho Frontend Dev

### Authentication
- [ ] Implement login/register forms
- [ ] Store tokens trong localStorage
- [ ] Setup axios interceptors
- [ ] Handle token refresh
- [ ] Implement OAuth buttons
- [ ] Add OTP verification flow
- [ ] Add password reset flow

### Movies
- [ ] Movie list page với pagination
- [ ] Movie search functionality
- [ ] Movie detail page
- [ ] Filter by genre, rating

### Booking
- [ ] Theater selection
- [ ] Showtime selection
- [ ] Seat selection với visual layout
- [ ] Hiển thị ghế đã đặt/đang giữ
- [ ] Countdown timer (10 phút)
- [ ] Booking summary

### Payment
- [ ] Payment method selection
- [ ] Redirect to VNPay
- [ ] Handle payment callback
- [ ] Payment success/fail pages
- [ ] Display QR code

### User Profile
- [ ] View profile
- [ ] Edit profile
- [ ] Upload avatar
- [ ] Booking history
- [ ] Cancel booking

---

## 11. Lưu ý quan trọng

### Security
1. **KHÔNG BAO GIỜ** expose sensitive data ở frontend
2. Luôn validate input trước khi gửi request
3. Không lưu password trong localStorage
4. Sử dụng HTTPS trong production

### Performance
1. Implement lazy loading cho images
2. Debounce search input
3. Cache API responses khi cần
4. Pagination cho danh sách dài

### UX
1. Hiển thị loading state
2. Error messages rõ ràng
3. Confirmation dialogs cho các hành động quan trọng
4. Countdown timer cho seat locking
5. Toast notifications cho success/error

---

## 12. Hỗ trợ

### Swagger Documentation
```
http://localhost:3000/api/docs
```

### Backend Logs
```
logs/app-2024-12-13.log
logs/error-2024-12-13.log
```

### Contact
Nếu có vấn đề với API, check:
1. Swagger documentation
2. Backend logs
3. Network tab trong DevTools
4. Console errors

---

## Tóm tắt

**Backend đã sẵn sàng 100% cho frontend:**
- ✅ REST API hoàn chỉnh với Swagger docs
- ✅ JWT Authentication + OAuth + OTP
- ✅ CRUD cho tất cả modules
- ✅ Pagination & Search
- ✅ VNPay Payment Gateway
- ✅ QR Code generation
- ✅ Email notifications
- ✅ Redis seat locking
- ✅ Error handling chuẩn
- ✅ CORS configured

**Frontend có thể bắt đầu phát triển ngay!**
