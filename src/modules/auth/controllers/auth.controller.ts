import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { LoginDTO, CreateUserDTO } from '../models/user.model';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const loginData: LoginDTO = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const device = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.login(loginData, ip, device);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  });

  register = asyncHandler(async (req: Request, res: Response) => {
    const userData: CreateUserDTO = req.body;
    const user = await this.authService.register(userData);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  });

  profile = asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: req.user
    });
  });
}