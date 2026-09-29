import { UserRepository } from '../repositories/user.repository';
import { User, LoginDTO, AuthResponse, CreateUserDTO } from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async login(loginData: LoginDTO, ip: string, device: string): Promise<AuthResponse> {
    // ✅ FIX: findByUsernameOrThrow بدل findByUsername — لو القراءة فشلت
    // فعليًا (تايم آوت/عطل شبكة عابر) بترمي الخطأ هنا بدل ما ترجّع null
    // بصمت، فبنقدر نفرّق بين "المستخدم مش موجود فعلاً" (401) و"تعذر
    // الاتصال بالخادم مؤقتًا" (503: نفس رسالة "الخادم لا يستجيب" اللي
    // المستخدم شايفها فعلاً، بدل رسالة "بياناتك غلط" المضلّلة).
    let user;
    try {
      user = await this.userRepo.findByUsernameOrThrow(loginData.username);
    } catch (error) {
      logger.error(`Login lookup failed for "${loginData.username}": ${error}`);
      throw new AppError('تعذر الاتصال بالخادم، برجاء المحاولة مرة أخرى بعد قليل', 503);
    }
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is locked
    if (user.status === 'locked') {
      if (user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()) {
        throw new AppError('Account is locked. Please try again later.', 403);
      } else {
        await this.userRepo.resetFailedAttempts(user.id);
        // ✅ نحدّث النسخة في الذاكرة كمان عشان باقي الدالة (roles/permissions
        // تحت) تشتغل على حالة الحساب الفعلية من غير ما نحتاج نعيد قراءته
        user.status = 'active';
        user.failedLoginAttempts = 0;
        user.accountLockedUntil = undefined;
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginData.password, user.passwordHash);
    if (!isPasswordValid) {
      // ده لازم ينتظر (await) عشان عداد المحاولات/القفل يفضل دقيق حتى لو
      // المستخدم قفل المتصفح فورًا بعد الخطأ
      await this.userRepo
        .incrementFailedAttempts(user.id)
        .catch(err => logger.warn(`Could not record failed login attempt for ${user!.id}: ${err}`));
      throw new AppError('Invalid credentials', 401);
    }

    // ✅ FIX: أهم تسريع لتسجيل الدخول — كانت الدالة بتعمل 4 نداءات إضافية
    // متتالية لقاعدة البيانات بعد التحقق من كلمة السر (resetFailedAttempts،
    // updateLastLogin، getUserRoles، getUserPermissions)، وكل نداء منهم في
    // الحقيقة HTTP request لسيرفرات Cloudflare (مش استعلام محلي سريع)،
    // وبعضها (update) بيعمل قراءة قبل الكتابة وقراءة تانية بعدها = 3 نداءات
    // لوحده. ده كان بيضيف تأخير حقيقي محسوس على كل عملية دخول ناجحة.
    // roles/permissions/allowedPages أصلاً موجودين في السجل اللي جبناه فوق
    // من غير ما نحتاج نعيد قراءته تاني، وتحديث "آخر دخول" مجرد إحصائية
    // (وقت/IP/جهاز) مش لازم المستخدم يستناها قبل ما ياخد التوكن بتاعه —
    // فبنبعتها في الخلفية (من غير await) بعد ما نجهّز الرد.
    const roles = user.roles || [];
    const permissions = user.permissions || [];
    const allowedPages = user.allowedPages || [];

    // Generate tokens
    const accessToken = this.generateAccessToken(user, permissions, allowedPages);
    const refreshToken = this.generateRefreshToken(user);

    void this.userRepo
      .update(user.id, {
        failedLoginAttempts: 0,
        accountLockedUntil: undefined,
        status: 'active',
        lastLoginAt: new Date().toISOString(),
        lastLoginIP: ip,
        lastLoginDevice: device
      })
      .catch(err => logger.warn(`Could not update last-login stats for ${user!.id}: ${err}`));

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

  // ✅ بيانات البروفايل من قاعدة البيانات مباشرة (مش من التوكن): التوكن مافيهوش
  // الاسم الكامل ولا رقم الهاتف، وبيفضل قديم لحد ما يخلص. كده الصفحة دايمًا
  // تعرض القيم الفعلية المحفوظة، ومن غير passwordHash أبدًا.
  async getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const { passwordHash, ...profile } = user;
    return profile;
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