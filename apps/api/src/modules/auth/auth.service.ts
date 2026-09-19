import { StatusCodes } from 'http-status-codes';
import { IAuthUserRepository, IRefreshTokenRepository } from './auth.repository.js';
import { IPasswordService } from '../../common/security/password.service.js';
import { ITokenService } from '../../common/security/token.service.js';
import { IAccountLockoutService } from '../../common/security/account-lockout.service.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import jwt from 'jsonwebtoken';
import { envConfig } from '../../config/env.config.js';
import { AuthMapper } from './auth.mapper.js';
import { AuthResponseDto, AuthUserDto, LoginDto } from './dto/auth.dto.js';
import { createUserLoggedInEvent, createUserLoggedOutEvent } from './auth.events.js';
import { logger } from '../../common/logger/logger.service.js';
import { IOtpService, otpService as defaultOtpService } from '../../common/security/otp.service.js';

export class AuthService {
  public constructor(
    private readonly userRepository: IAuthUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    private readonly lockoutService: IAccountLockoutService,
    private readonly eventBus: IEventBus,
    private readonly otpService: IOtpService = defaultOtpService,
  ) {}

  public async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
    correlationId: string = crypto.randomUUID(),
  ): Promise<AuthResponseDto> {
    const lockoutKey = `${dto.email}:${ipAddress || 'unknown'}`;

    // 1. Check if account is locked out via Redis sliding window
    const lockoutStatus = await this.lockoutService.isLocked(lockoutKey);
    if (lockoutStatus.locked) {
      throw new AppError(
        'ACCOUNT_LOCKED',
        `Account temporarily locked due to repeated failed login attempts. Try again in ${Math.ceil(
          (lockoutStatus.remainingSeconds || 900) / 60,
        )} minutes.`,
        StatusCodes.TOO_MANY_REQUESTS,
      );
    }

    // 2. Fetch User Aggregate
    const user = await this.userRepository.findByEmail(dto.email, dto.coachingCode);
    if (!user) {
      await this.lockoutService.recordFailedAttempt(lockoutKey);
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', StatusCodes.UNAUTHORIZED);
    }

    if (!user.isActive) {
      throw new AppError('ACCOUNT_INACTIVE', 'Your account has been deactivated. Please contact support.', StatusCodes.FORBIDDEN);
    }

    // 3. Verify Argon2id Password Hash
    const isPasswordValid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      const lockResult = await this.lockoutService.recordFailedAttempt(lockoutKey);
      if (lockResult.locked) {
        throw new AppError(
          'ACCOUNT_LOCKED',
          'Account locked due to 5 consecutive failed login attempts. Please wait 15 minutes.',
          StatusCodes.TOO_MANY_REQUESTS,
        );
      }
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', StatusCodes.UNAUTHORIZED);
    }

    // 4. Reset lockout counter on success
    await this.lockoutService.resetAttempts(lockoutKey);

    // 5. Transform User to DTO
    const userDto = AuthMapper.toUserDto(user);

    // 6. Generate RS256 Access Token
    const accessToken = this.tokenService.generateAccessToken({
      sub: userDto.id,
      coachingId: userDto.coachingId,
      email: userDto.email,
      roles: userDto.roles,
      permissions: userDto.permissions,
    });

    // 7. Generate Rotating Refresh Token
    const { rawToken, hashedToken, family } = this.tokenService.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    await this.refreshTokenRepository.create({
      userId: userDto.id,
      tokenHash: hashedToken,
      family,
      expiresAt,
      userAgent,
      ipAddress,
    });

    // 8. Update Last Login Timestamp
    await this.userRepository.updateLastLogin(userDto.id);

    // 9. Emit Domain Event
    await this.eventBus.publish(
      createUserLoggedInEvent(
        {
          userId: userDto.id,
          coachingId: userDto.coachingId,
          email: userDto.email,
          roles: userDto.roles,
          ipAddress,
        },
        correlationId,
      ),
    );

    return {
      user: userDto,
      tokens: {
        accessToken,
        refreshToken: rawToken,
        tokenType: 'Bearer',
        expiresIn: 15 * 60, // 15 minutes
      },
    };
  }

  public async refresh(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const hashedToken = this.tokenService.hashToken(rawRefreshToken);
    const storedToken = await this.refreshTokenRepository.findByTokenHash(hashedToken);

    if (!storedToken) {
      throw new AppError('INVALID_TOKEN', 'Refresh token is invalid or unrecognized', StatusCodes.UNAUTHORIZED);
    }

    // Reuse Detection: If token is already revoked, revoke its entire family to stop token theft!
    if (storedToken.isRevoked) {
      logger.warn(`[AuthService] Refresh token replay attack detected for family ${storedToken.family}`);
      await this.refreshTokenRepository.revokeFamily(storedToken.family);
      throw new AppError('TOKEN_REUSED', 'Token reuse detected. All sessions in this family revoked for security.', StatusCodes.UNAUTHORIZED);
    }

    // Check expiration
    if (storedToken.expiresAt.getTime() < Date.now()) {
      throw new AppError('TOKEN_EXPIRED', 'Refresh token has expired. Please login again.', StatusCodes.UNAUTHORIZED);
    }

    // Revoke the old token (one-time rotation)
    await this.refreshTokenRepository.revoke(storedToken.id);

    // Fetch user
    const user = await this.userRepository.findById(storedToken.userId);
    if (!user || !user.isActive) {
      throw new AppError('USER_INACTIVE', 'User associated with token no longer active', StatusCodes.UNAUTHORIZED);
    }

    const userDto = AuthMapper.toUserDto(user);

    // Generate new Access Token
    const newAccessToken = this.tokenService.generateAccessToken({
      sub: userDto.id,
      coachingId: userDto.coachingId,
      email: userDto.email,
      roles: userDto.roles,
      permissions: userDto.permissions,
    });

    // Generate rotated Refresh Token within the SAME family
    const { rawToken, hashedToken: newHashedToken } = this.tokenService.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.create({
      userId: userDto.id,
      tokenHash: newHashedToken,
      family: storedToken.family, // Preserve family for replay chain
      expiresAt,
      userAgent,
      ipAddress,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: rawToken,
      expiresIn: 15 * 60,
    };
  }

  public async logout(rawRefreshToken: string, correlationId: string = crypto.randomUUID()): Promise<void> {
    const hashedToken = this.tokenService.hashToken(rawRefreshToken);
    const storedToken = await this.refreshTokenRepository.findByTokenHash(hashedToken);
    if (storedToken) {
      await this.refreshTokenRepository.revoke(storedToken.id);
      await this.eventBus.publish(
        createUserLoggedOutEvent(
          {
            userId: storedToken.userId,
            reason: 'EXPLICIT_LOGOUT',
          },
          correlationId,
        ),
      );
    }
  }

  public async logoutAllDevices(userId: string, correlationId: string = crypto.randomUUID()): Promise<void> {
    await this.refreshTokenRepository.revokeAllForUser(userId);
    await this.eventBus.publish(
      createUserLoggedOutEvent(
        {
          userId,
          reason: 'ALL_DEVICES_LOGOUT',
        },
        correlationId,
      ),
    );
  }

  public async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User profile not found', StatusCodes.NOT_FOUND);
    }
    return AuthMapper.toUserDto(user);
  }

  public async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return { message: 'If an account exists with that email, a password reset link has been dispatched.' };
    }

    const resetToken = jwt.sign(
      { sub: user.id, email: user.email, type: 'PASSWORD_RESET' },
      envConfig.get('JWT_ACCESS_SECRET'),
      { expiresIn: '1h' },
    );

    // Generate development terminal OTP
    await this.otpService.generateOtp(user.email, 'PASSWORD_RESET', 600);

    logger.info(`[AuthService] Password reset token generated for ${user.email}: ${resetToken}`);
    return { message: 'If an account exists with that email, a password reset link has been dispatched.' };
  }

  public async sendOtp(
    identifier: string,
    purpose: 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | string = 'LOGIN',
  ): Promise<{ message: string; identifier: string }> {
    await this.otpService.generateOtp(identifier, purpose, 600);
    return {
      message: `OTP dispatched for ${purpose}. Check server terminal in development.`,
      identifier,
    };
  }

  public async verifyOtp(
    identifier: string,
    code: string,
    purpose: 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | string = 'LOGIN',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto | { message: string }> {
    const isValid = await this.otpService.verifyOtp(identifier, code, purpose);
    if (!isValid) {
      throw new AppError('INVALID_OR_EXPIRED_OTP', 'The entered OTP is invalid or has expired', StatusCodes.UNAUTHORIZED);
    }

    if (purpose === 'LOGIN') {
      const user = await this.userRepository.findByEmail(identifier);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'No account found associated with this email', StatusCodes.NOT_FOUND);
      }

      const userDto = AuthMapper.toUserDto(user);
      const accessToken = this.tokenService.generateAccessToken({
        sub: userDto.id,
        coachingId: userDto.coachingId,
        email: userDto.email,
        roles: userDto.roles,
        permissions: userDto.permissions,
      });

      const { rawToken, hashedToken, family } = this.tokenService.generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await this.refreshTokenRepository.create({
        userId: userDto.id,
        tokenHash: hashedToken,
        family,
        expiresAt,
        userAgent,
        ipAddress,
      });

      await this.userRepository.updateLastLogin(userDto.id);

      return {
        user: userDto,
        tokens: {
          accessToken,
          refreshToken: rawToken,
          tokenType: 'Bearer',
          expiresIn: 15 * 60,
        },
      };
    }

    return { message: `OTP verified successfully for ${purpose}.` };
  }

  public async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    let payload: any;
    try {
      payload = jwt.verify(token, envConfig.get('JWT_ACCESS_SECRET'));
    } catch {
      throw new AppError('INVALID_OR_EXPIRED_TOKEN', 'Password reset token is invalid or has expired', StatusCodes.BAD_REQUEST);
    }

    if (payload.type !== 'PASSWORD_RESET' || !payload.sub) {
      throw new AppError('INVALID_TOKEN_TYPE', 'Invalid token type', StatusCodes.BAD_REQUEST);
    }

    const newHash = await this.passwordService.hash(newPassword);
    await this.userRepository.updatePassword(payload.sub, newHash);
    await this.refreshTokenRepository.revokeAllForUser(payload.sub);

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  public async verifyEmail(token: string): Promise<{ message: string }> {
    try {
      jwt.verify(token, envConfig.get('JWT_ACCESS_SECRET'));
    } catch {
      throw new AppError('INVALID_OR_EXPIRED_TOKEN', 'Verification token is invalid or has expired', StatusCodes.BAD_REQUEST);
    }

    return { message: 'Email verified successfully.' };
  }
}
