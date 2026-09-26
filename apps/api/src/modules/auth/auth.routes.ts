import { Router } from 'express';
import { createRouter } from '../../common/http/async-router.js';
import { AuthController } from './auth.controller.js';
import { authenticateMiddleware } from '../../common/middleware/auth.middleware.js';
import { rateLimit, bodyFieldKey } from '../../common/middleware/rate-limit.middleware.js';

export function createAuthRoutes(controller: AuthController): Router {
  const router = createRouter();

  // Per-IP limits on every unauthenticated credential endpoint; OTP/reset requests are also
  // limited per target identifier so one address cannot be flooded from many IPs.
  const loginLimit = rateLimit({ name: 'auth-login', windowSeconds: 60, max: 10 });
  const refreshLimit = rateLimit({ name: 'auth-refresh', windowSeconds: 60, max: 30 });
  const otpIpLimit = rateLimit({ name: 'auth-otp-ip', windowSeconds: 600, max: 10 });
  const otpTargetLimit = rateLimit({ name: 'auth-otp-target', windowSeconds: 600, max: 3, keyGenerator: bodyFieldKey('identifier') });
  const verifyOtpLimit = rateLimit({ name: 'auth-verify-otp', windowSeconds: 600, max: 10 });
  const resetIpLimit = rateLimit({ name: 'auth-reset-ip', windowSeconds: 900, max: 5 });
  const resetTargetLimit = rateLimit({ name: 'auth-reset-target', windowSeconds: 900, max: 3, keyGenerator: bodyFieldKey('email') });
  const tokenLimit = rateLimit({ name: 'auth-token', windowSeconds: 900, max: 10 });

  router.post('/login', loginLimit, controller.login);
  router.post('/refresh', refreshLimit, controller.refresh);
  router.post('/logout', refreshLimit, controller.logout);
  router.post('/logout-all', authenticateMiddleware, controller.logoutAllDevices);
  // Limited like sign-in: it checks a password, so it must not be usable for guessing one
  router.post('/change-password', authenticateMiddleware, loginLimit, controller.changePassword);
  router.get('/me', authenticateMiddleware, controller.getMe);
  router.post('/forgot-password', resetIpLimit, resetTargetLimit, controller.forgotPassword);
  router.post('/reset-password', tokenLimit, controller.resetPassword);
  router.post('/verify-email', tokenLimit, controller.verifyEmail);
  // One-time codes are generated but not delivered yet (no SMS/WhatsApp sender), and a verified
  // LOGIN code issues a full session. Until delivery exists and the flow is reviewed with it,
  // the endpoints stay off rather than being an unused way in. Enable with ENABLE_OTP_LOGIN=true.
  if (process.env.ENABLE_OTP_LOGIN === 'true') {
    router.post('/send-otp', otpIpLimit, otpTargetLimit, controller.sendOtp);
    router.post('/verify-otp', verifyOtpLimit, controller.verifyOtp);
  }

  return router;
}
