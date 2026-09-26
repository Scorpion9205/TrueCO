import { describe, it, expect, beforeEach } from 'vitest';
import { OtpService } from '../../common/security/otp.service.js';

describe('OtpService (Development Terminal OTP)', () => {
  let otpService: OtpService;

  beforeEach(() => {
    otpService = new OtpService();
  });

  it('generates a 6-digit numeric OTP and verifies it successfully', async () => {
    const email = 'satyapaltiwari920@gmail.com';
    const otp = await otpService.generateOtp(email, 'SIGNUP', 60);

    expect(otp).toBeDefined();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);

    const isValid = await otpService.verifyOtp(email, otp, 'SIGNUP');
    expect(isValid).toBe(true);
  });

  it('invalidates OTP after single use (one-time)', async () => {
    const email = 'teacher@vargly.in';
    const otp = await otpService.generateOtp(email, 'LOGIN', 60);

    const firstAttempt = await otpService.verifyOtp(email, otp, 'LOGIN');
    expect(firstAttempt).toBe(true);

    // Second attempt should fail
    const secondAttempt = await otpService.verifyOtp(email, otp, 'LOGIN');
    expect(secondAttempt).toBe(false);
  });

  it('rejects an incorrect OTP code', async () => {
    const email = 'student@vargly.in';
    await otpService.generateOtp(email, 'PASSWORD_RESET', 60);

    const isValid = await otpService.verifyOtp(email, '000000', 'PASSWORD_RESET');
    expect(isValid).toBe(false);
  });

  it('burns the OTP after too many wrong guesses, even if the right code follows', async () => {
    const email = 'bruteforce@vargly.in';
    const otp = await otpService.generateOtp(email, 'LOGIN', 60);
    const wrong = otp === '111111' ? '222222' : '111111';

    for (let i = 0; i < OtpService.MAX_VERIFY_ATTEMPTS; i++) {
      expect(await otpService.verifyOtp(email, wrong, 'LOGIN')).toBe(false);
    }

    expect(await otpService.verifyOtp(email, otp, 'LOGIN')).toBe(false);
  });

  it('rejects verification with wrong purpose', async () => {
    const email = 'director@vargly.in';
    const otp = await otpService.generateOtp(email, 'SIGNUP', 60);

    const isValid = await otpService.verifyOtp(email, otp, 'LOGIN');
    expect(isValid).toBe(false);
  });
});
