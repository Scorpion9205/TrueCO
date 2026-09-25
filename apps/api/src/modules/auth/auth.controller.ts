import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from './auth.service.js';
import { loginSchema, refreshSchema } from './validators/auth.validator.js';
import { LoginDto, RefreshDto } from './dto/auth.dto.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  public login = async (req: Request, res: Response): Promise<void> => {
    const validated = loginSchema.parse(req.body) as LoginDto;
    const ipAddress = req.ip; // resolved from X-Forwarded-For only for trusted proxies (TRUST_PROXY)
    const userAgent = req.headers['user-agent'];
    const traceId = RequestContextService.getTraceId();

    const result = await this.authService.login(validated, ipAddress, userAgent, traceId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const validated = refreshSchema.parse(req.body) as RefreshDto;
    const ipAddress = req.ip; // resolved from X-Forwarded-For only for trusted proxies (TRUST_PROXY)
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.refresh(validated.refreshToken, ipAddress, userAgent);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const validated = refreshSchema.parse(req.body) as RefreshDto;
    const traceId = RequestContextService.getTraceId();

    await this.authService.logout(validated.refreshToken, traceId);
    res.status(StatusCodes.OK).json({ data: { message: 'Logged out successfully' } });
  };

  public logoutAllDevices = async (_req: Request, res: Response): Promise<void> => {
    const userId = RequestContextService.getUserId();
    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const traceId = RequestContextService.getTraceId();
    await this.authService.logoutAllDevices(userId, traceId);
    res.status(StatusCodes.OK).json({ data: { message: 'All active sessions revoked successfully' } });
  };

  public getMe = async (_req: Request, res: Response): Promise<void> => {
    const userId = RequestContextService.getUserId();
    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const result = await this.authService.getMe(userId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const validated = (await import('./validators/auth.validator.js')).forgotPasswordSchema.parse(req.body);
    const result = await this.authService.forgotPassword(validated.email, validated.coachingCode);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    const validated = (await import('./validators/auth.validator.js')).resetPasswordSchema.parse(req.body);
    const result = await this.authService.resetPassword(validated.token, validated.newPassword);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public changePassword = async (req: Request, res: Response): Promise<void> => {
    const userId = RequestContextService.getUserId();
    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }
    const validated = (await import('./validators/auth.validator.js')).changePasswordSchema.parse(req.body);
    const result = await this.authService.changePassword(
      userId,
      validated.currentPassword,
      validated.newPassword,
    );
    res.status(StatusCodes.OK).json({ data: result });
  };

  public verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const validated = (await import('./validators/auth.validator.js')).verifyEmailSchema.parse(req.body);
    const result = await this.authService.verifyEmail(validated.token);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public sendOtp = async (req: Request, res: Response): Promise<void> => {
    const { identifier, purpose } = req.body;
    if (!identifier) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: { code: 'INVALID_INPUT', message: 'identifier is required' } });
      return;
    }
    const result = await this.authService.sendOtp(identifier, purpose);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const { identifier, code, purpose, coachingCode } = req.body;
    if (!identifier || !code) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: { code: 'INVALID_INPUT', message: 'identifier and code are required' } });
      return;
    }
    const ipAddress = req.ip; // resolved from X-Forwarded-For only for trusted proxies (TRUST_PROXY)
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.verifyOtp(identifier, code, purpose, ipAddress, userAgent, coachingCode);
    res.status(StatusCodes.OK).json({ data: result });
  };
}
