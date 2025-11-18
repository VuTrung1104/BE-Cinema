import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { Violation } from './schemas/violation.schema';
import { EmailService } from '../common/services/email.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: any;
  let mockViolationModel: any;
  let mockEmailService: any;
  let mockCloudinaryService: any;

  const mockUser = {
    _id: 'user123',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashedPassword123',
    role: 'user',
  };

  const mockUserWithoutPassword = {
    _id: 'user123',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
  };

  beforeEach(async () => {
    mockUserModel = {
      new: jest.fn(),
      constructor: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      save: jest.fn(),
    };

    mockViolationModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockEmailService = {
      sendOTP: jest.fn(),
      sendAccountLockedNotification: jest.fn(),
    };

    mockCloudinaryService = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Violation.name),
          useValue: mockViolationModel,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users without passwords', async () => {
      const mockUsers = [mockUserWithoutPassword];
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll();

      expect(mockUserModel.find).toHaveBeenCalled();
      expect(mockQuery.select).toHaveBeenCalledWith('-password');
      expect(result).toEqual(mockUsers);
      expect(result[0]).not.toHaveProperty('password');
    });

    it('should return empty array when no users exist', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      mockUserModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id without password', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUserWithoutPassword),
      };

      mockUserModel.findById.mockReturnValue(mockQuery);

      const result = await service.findOne('user123');

      expect(mockUserModel.findById).toHaveBeenCalledWith('user123');
      expect(mockQuery.select).toHaveBeenCalledWith('-password');
      expect(result).toEqual(mockUserWithoutPassword);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockUserModel.findById.mockReturnValue(mockQuery);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'User with ID nonexistent not found',
      );
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email with password', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserModel.findOne.mockReturnValue(mockQuery);

      const result = await service.findByEmail('user@example.com');

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('password');
    });

    it('should return null if user does not exist', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(null),
      };

      mockUserModel.findOne.mockReturnValue(mockQuery);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      // Reset all mocks before each test in this describe block
      jest.clearAllMocks();
    });

    it('should update user profile successfully', async () => {
      const updateUserDto = {
        fullName: 'Jane Smith',
        phone: '0987654321',
      };

      const updatedUser = {
        ...mockUserWithoutPassword,
        fullName: 'Jane Smith',
        phone: '0987654321',
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedUser),
      };

      mockUserModel.findByIdAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateProfile('user123', updateUserDto);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        updateUserDto,
        { new: true },
      );
      expect(mockQuery.select).toHaveBeenCalledWith('-password');
      expect(result).toEqual(updatedUser);
      expect(result.fullName).toBe('Jane Smith');
    });

    it.skip('should update user email if not already in use', async () => {
      const updateUserDto = {
        email: 'newemail@example.com',
        fullName: 'John Doe',
      };

      const updatedUser = {
        ...mockUserWithoutPassword,
        email: 'newemail@example.com',
      };

      // Mock findOne to return null (no existing user with that email)
      mockUserModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock findByIdAndUpdate
      mockUserModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedUser),
      });

      const result = await service.updateProfile('user123', updateUserDto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'newemail@example.com',
        _id: { $ne: 'user123' },
      });
      expect(result.email).toBe('newemail@example.com');
    });

    it('should throw ConflictException if email is already in use', async () => {
      const updateUserDto = {
        email: 'existing@example.com',
      };

      const existingUser = {
        _id: 'user456',
        email: 'existing@example.com',
      };

      const mockFindQuery = {
        exec: jest.fn().mockResolvedValue(existingUser),
      };

      mockUserModel.findOne.mockReturnValue(mockFindQuery);

      await expect(
        service.updateProfile('user123', updateUserDto),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.updateProfile('user123', updateUserDto),
      ).rejects.toThrow('Email is already in use');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const updateUserDto = {
        fullName: 'Jane Smith',
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockUserModel.findByIdAndUpdate.mockReturnValue(mockQuery);

      await expect(
        service.updateProfile('nonexistent', updateUserDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateProfile('nonexistent', updateUserDto),
      ).rejects.toThrow('User with ID nonexistent not found');
    });

    it('should not include password in updated user', async () => {
      const updateUserDto = {
        fullName: 'Jane Smith',
      };

      const updatedUser = {
        ...mockUserWithoutPassword,
        fullName: 'Jane Smith',
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedUser),
      };

      mockUserModel.findByIdAndUpdate.mockReturnValue(mockQuery);

      const result = await service.updateProfile('user123', updateUserDto);

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUserWithoutPassword),
      };

      mockUserModel.findById.mockReturnValue(mockQuery);

      const result = await service.getProfile('user123');

      expect(mockUserModel.findById).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockUserWithoutPassword);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockUserModel.findById.mockReturnValue(mockQuery);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
