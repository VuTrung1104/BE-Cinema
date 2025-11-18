# Hướng Dẫn Tích Hợp Frontend - BE Cinema API

## 📚 Nội dung
1. [Cấu hình cơ bản](#cấu-hình-cơ-bản)
2. [Authentication](#authentication)
3. [Movies & Showtimes](#movies--showtimes)
4. [Booking & Payment](#booking--payment)
5. [Xử lý lỗi](#xử-lý-lỗi)

---

## 🚀 Cấu hình cơ bản

**Base URL:** `http://localhost:3000/api/v1`  
**Swagger Docs:** `http://localhost:3000/api/v1/docs`

### Setup Axios

```typescript
// src/api/config.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  timeout: 30000,
});

// Tự động thêm token vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Xử lý lỗi 401 (token hết hạn)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```


---

## 🔐 Authentication

### 1. Đăng ký & Đăng nhập

```typescript
// src/api/auth.ts
import { api } from './config';

// Đăng ký
export const register = async (email: string, password: string, fullName: string) => {
  const { data } = await api.post('/auth/register', { email, password, fullName });
  localStorage.setItem('token', data.accessToken);
  return data;
};

// Đăng nhập
export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('token', data.accessToken);
  return data;
};

// Đăng xuất
export const logout = () => {
  localStorage.clear();
  window.location.href = '/login';
};
```

### 2. Xác thực OTP

```typescript
// Gửi mã OTP
export const sendOTP = async (email: string, type: 'REGISTER' | 'FORGOT_PASSWORD') => {
  return api.post('/auth/send-otp', { email, type });
};

// Xác nhận OTP
export const verifyOTP = async (email: string, code: string) => {
  return api.post('/auth/verify-otp', { email, code });
};

// Quên mật khẩu
export const forgotPassword = async (email: string) => {
  return api.post('/auth/forgot-password', { email });
};

// Đặt lại mật khẩu
export const resetPassword = async (email: string, code: string, newPassword: string) => {
  return api.post('/auth/reset-password', { email, code, newPassword });
};
```

### 3. Component ví dụ (React)

```tsx
// LoginForm.tsx
import { useState } from 'react';
import { login } from '../api/auth';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      window.location.href = '/'; // Chuyển trang sau khi login
    } catch (error) {
      alert('Đăng nhập thất bại');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      <button type="submit">Đăng nhập</button>
    </form>
  );
};
```

---

## 🎬 Movies & Showtimes

### 1. Lấy danh sách phim

```typescript
// src/api/movies.ts
import { api } from './config';

// Lấy tất cả phim
export const getMovies = async () => {
  const { data } = await api.get('/movies');
  return data;
};

// Lấy chi tiết 1 phim
export const getMovieById = async (id: string) => {
  const { data } = await api.get(`/movies/${id}`);
  return data;
};
```

### 2. Lấy lịch chiếu & rạp

```typescript
// src/api/showtimes.ts
import { api } from './config';

// Lấy lịch chiếu theo phim
export const getShowtimesByMovie = async (movieId: string) => {
  const { data } = await api.get(`/showtimes?movieId=${movieId}`);
  return data;
};

// Lấy ghế còn trống
export const getAvailableSeats = async (showtimeId: string) => {
  const { data } = await api.get(`/showtimes/${showtimeId}`);
  return data.availableSeats; // ['A1', 'A2', 'B1', ...]
};

// Lấy danh sách rạp
export const getTheaters = async () => {
  const { data } = await api.get('/theaters');
  return data;
};
```

### 3. Component hiển thị phim

```tsx
// MovieList.tsx
import { useEffect, useState } from 'react';
import { getMovies } from '../api/movies';

export const MovieList = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMovies()
      .then(setMovies)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="movie-grid">
      {movies.map((movie) => (
        <div key={movie._id}>
          <img src={movie.posterUrl} alt={movie.title} />
          <h3>{movie.title}</h3>
          <p>{movie.genre.join(', ')}</p>
        </div>
      ))}
    </div>
  );
};
```

---

## 🎫 Booking & Payment

### 1. Đặt vé

```typescript
// src/api/bookings.ts
import { api } from './config';

// Tạo booking
export const createBooking = async (showtimeId: string, seats: string[]) => {
  const { data } = await api.post('/bookings', { showtimeId, seats });
  return data; // { _id, bookingCode, totalPrice, ... }
};

// Lấy booking của tôi
export const getMyBookings = async () => {
  const { data } = await api.get('/bookings/my-bookings');
  return data;
};

// Hủy booking
export const cancelBooking = async (id: string) => {
  const { data } = await api.patch(`/bookings/${id}/cancel`);
  return data;
};
```

### 2. Thanh toán

```typescript
// src/api/payments.ts
import { api } from './config';

// Tạo thanh toán
export const createPayment = async (bookingId: string, method: 'CREDIT_CARD' | 'E_WALLET') => {
  const { data } = await api.post('/payments', {
    bookingId,
    paymentMethod: method,
  });
  return data;
};

// Lịch sử thanh toán
export const getMyPayments = async () => {
  const { data } = await api.get('/payments/my-payments');
  return data;
};
```

### 3. Component chọn ghế

```tsx
// SeatSelection.tsx
import { useState, useEffect } from 'react';
import { getAvailableSeats } from '../api/showtimes';
import { createBooking } from '../api/bookings';

export const SeatSelection = ({ showtimeId }) => {
  const [availableSeats, setAvailableSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);

  useEffect(() => {
    getAvailableSeats(showtimeId).then(setAvailableSeats);
  }, [showtimeId]);

  const toggleSeat = (seat) => {
    setSelectedSeats((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat]
    );
  };

  const handleBooking = async () => {
    try {
      const booking = await createBooking(showtimeId, selectedSeats);
      alert(`Đặt vé thành công! Mã: ${booking.bookingCode}`);
    } catch (error) {
      alert('Đặt vé thất bại. Vui lòng thử lại');
    }
  };

  return (
    <div>
      <div className="seats">
        {availableSeats.map((seat) => (
          <button
            key={seat}
            onClick={() => toggleSeat(seat)}
            className={selectedSeats.includes(seat) ? 'selected' : ''}
          >
            {seat}
          </button>
        ))}
      </div>
      <p>Đã chọn: {selectedSeats.join(', ')}</p>
      <button onClick={handleBooking}>Đặt vé</button>
    </div>
  );
};
```

---

## 👤 User Profile & Avatar

```typescript
// src/api/users.ts
import { api } from './config';

// Lấy thông tin user
export const getProfile = async () => {
  const { data } = await api.get('/users/me');
  return data;
};

// Cập nhật profile
export const updateProfile = async (fullName: string, phone: string) => {
  const { data } = await api.put('/users/me', { fullName, phone });
  return data;
};

// Upload avatar
export const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('avatar', file);
  
  const { data } = await api.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.avatar; // URL của avatar
};
```

**Lưu ý upload avatar:**
- Chỉ chấp nhận: JPG, PNG, WebP
- Dung lượng tối đa: 5MB
- Tự động resize về 400x400px

---

## 🚨 Xử lý lỗi

### Các mã lỗi thường gặp

| Code | Ý nghĩa | Xử lý |
|------|---------|-------|
| 400 | Dữ liệu không hợp lệ | Kiểm tra input |
| 401 | Chưa đăng nhập | Chuyển về trang login |
| 403 | Không có quyền | Hiển thị thông báo |
| 404 | Không tìm thấy | Hiển thị 404 page |
| 409 | Xung đột (ghế đã đặt) | Reload dữ liệu |
| 429 | Quá nhiều request | Chờ và thử lại |
| 500 | Lỗi server | Thử lại sau |

### Xử lý lỗi trong component

```tsx
const MyComponent = () => {
  const [error, setError] = useState('');

  const handleAction = async () => {
    try {
      await someAPI();
      setError('');
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 401) {
        alert('Vui lòng đăng nhập lại');
        logout();
      } else if (status === 409) {
        setError('Ghế đã được đặt. Vui lòng chọn ghế khác');
      } else {
        setError(message || 'Có lỗi xảy ra');
      }
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button onClick={handleAction}>Submit</button>
    </div>
  );
};
```

---

## ⚠️ Rate Limits!

API có giới hạn số lần gọi để tránh spam:

| Endpoint | Giới hạn |
|----------|----------|
| POST /auth/send-otp | 5 lần/giờ |
| POST /auth/verify-otp | 10 lần/10 phút |
| POST /auth/forgot-password | 3 lần/giờ |
| POST /auth/reset-password | 5 lần/giờ |
| Các endpoint khác | 10 lần/phút |

**Khi vượt quá:** Server trả về lỗi 429, cần đợi trước khi thử lại.

---

## 🛠️ Utils hữu ích

### Loading Hook

```typescript
// useLoading.ts
import { useState } from 'react';

export const useLoading = () => {
  const [loading, setLoading] = useState(false);

  const withLoading = async (fn: () => Promise<any>) => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  };

  return { loading, withLoading };
};

// Sử dụng
const { loading, withLoading } = useLoading();
await withLoading(() => createBooking(id, seats));
```

### Auth Hook

```typescript
// useAuth.ts
import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  return { isAuthenticated };
};
```

---

## 📝 Tóm tắt:

### 1. Setup ban đầu
```bash
npm install axios
```

### 2. Tạo file config
```typescript
// src/api/config.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 3. Gọi API
```typescript
// Login
const { data } = await api.post('/auth/login', { email, password });
localStorage.setItem('token', data.accessToken);

// Lấy phim
const { data } = await api.get('/movies');

// Đặt vé
const { data } = await api.post('/bookings', { showtimeId, seats });
```

### 4. Xử lý lỗi
```typescript
try {
  await api.post('/bookings', data);
} catch (error) {
  if (error.response?.status === 401) {
    // Chưa đăng nhập
  } else if (error.response?.status === 409) {
    // Ghế đã đặt
  }
}
```

---

## 🔗 Resources

- **Swagger Docs:** http://localhost:3000/api/v1/docs
- **Backend Repo:** https://github.com/VuTrung1104/BE-Cinema
- **Postman Collection:** Xem trong Swagger

---
