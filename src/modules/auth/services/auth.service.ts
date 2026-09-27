import { UserRepository } from '../repositories/user.repository';
import { User, LoginDTO, AuthResponse, CreateUserDTO } from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async login(loginData: LoginDTO, ip: string, device: string): Promise<AuthResponse> {
    const user = await this.userRepo.findByUsername(loginData.username);
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is locked
    if (user.status === 'locked') {
      if (user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
        throw new AppError('Account is locked. Please try again later.', 403);
      } else {
        await this.userRepo.resetFailedAttempts(user.id);
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginData.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.userRepo.incrementFailedAttempts(user.id);
      throw new AppError('Invalid credentials', 401);
    }

    // Reset failed attempts on successful login
    await this.userRepo.resetFailedAttempts(user.id);
    await this.userRepo.updateLastLogin(user.id, ip, device);

    // Get user roles and permissions
    const roles = await this.userRepo.getUserRoles(user.id);
    const permissions = await this.userRepo.getUserPermissions(user.id);
    const allowedPages = user.allowedPages || [];

    // Generate tokens
    const accessToken = this.generateAccessToken(user, permissions, allowedPages);
    const refreshToken = this.generateRefreshToken(user);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 7 * 24 * 60 * 60,
      token_type: 'Bearer',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        roles: roles,
        permissions: permissions,
        allowedPages: allowedPages,
        lastLogin: user.lastLoginAt
      }
    };
  }

  async register(userData: CreateUserDTO): Promise<User> {
    // Check if user exists
    const existingUser = await this.userRepo.findByEmail(userData.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const existingUsername = await this.userRepo.findByUsername(userData.username);
    if (existingUsername) {
      throw new AppError('Username already taken', 409);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);

    // Create user
    const user = await this.userRepo.create({
      ...userData,
      passwordHash,
      status: userData.status || 'active',
      failedLoginAttempts: 0,
      sessionTimeout: 60,
      version: 1,
      roles: userData.roleIds || [],
      permissions: [],
      allowedPages: (userData as any).allowedPages || []
    });

    logger.info(`User registered: ${user.username} (${user.id})`);
    return user;
  }

  private generateAccessToken(user: User, permissions: string[], allowedPages: string[] = []): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        roles: user.roles || [],
        permissions: permissions,
        allowedPages: allowedPages
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
  }

  private generateRefreshToken(user: User): string {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );
  }
}