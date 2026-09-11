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
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];
    const traceId = RequestContextService.getTraceId();

    const result = await this.authService.login(validated, ipAddress, userAgent, traceId);
    res.status(StatusCodes.OK).json({ data: result });
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const validated = refreshSchema.parse(req.body) as RefreshDto;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip;
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
}
