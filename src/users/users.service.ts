import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export type UserEntity = {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
};

@Injectable()
export class UsersService {
  private readonly users: UserEntity[] = [];

  constructor() {
    // Seed one demo user: username: admin, password: admin123
    const password = 'admin123';
    const passwordHash = bcrypt.hashSync(password, 10);
    this.users.push({
      id: 1,
      email: 'admin@example.com',
      passwordHash,
      fullName: 'Admin',
    });
  }

  findByEmail(email: string): UserEntity | undefined {
    return this.users.find((u) => u.email === email);
  }
}
