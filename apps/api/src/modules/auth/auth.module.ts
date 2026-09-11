import { Router } from 'express';
import { PrismaAuthUserRepository, PrismaRefreshTokenRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { createAuthRoutes } from './auth.routes.js';
import { passwordService } from '../../common/security/password.service.js';
import { tokenService } from '../../common/security/token.service.js';
import { accountLockoutService } from '../../common/security/account-lockout.service.js';
import { eventBus } from '../../events/event-bus.js';
import { AuthSubscribers } from './auth.subscribers.js';

export class AuthModule {
  public static init(): { router: Router; service: AuthService } {
    const userRepo = new PrismaAuthUserRepository();
    const refreshRepo = new PrismaRefreshTokenRepository();

    const service = new AuthService(
      userRepo,
      refreshRepo,
      passwordService,
      tokenService,
      accountLockoutService,
      eventBus,
    );

    const controller = new AuthController(service);
    const router = createAuthRoutes(controller);

    // Register event subscribers
    AuthSubscribers.register(eventBus);

    return { router, service };
  }
}
