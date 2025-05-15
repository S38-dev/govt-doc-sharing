// tests/authController.test.js

// Shared mocks
const mockQuery = jest.fn();
const mockHash = jest.spyOn(require('bcryptjs'), 'hash');
const mockCompare = jest.spyOn(require('bcryptjs'), 'compare');
const mockSign = jest.spyOn(require('jsonwebtoken'), 'sign');

// Mock modules before requiring controller
jest.mock('../config/db', () => ({ db: { query: mockQuery } }));
jest.mock('../services/emailService', () => ({ sendOTPEmail: jest.fn() }));
jest.mock('../services/otpStore', () => ({
  generateOTP: jest.fn().mockReturnValue('123456'),
  verifyOTP: jest.fn(),
  cleanup: jest.fn()
}));

const { db } = require('../config/db');
const { sendOTPEmail } = require('../services/emailService');
const otpStore = require('../services/otpStore');
const authController = require('../controllers/authController');

// Helpers
const mockReq = (body = {}) => ({ body, cookies: {}, params: {} });
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('renders error on invalid aadhaar', async () => {
      const req = mockReq({ name: 'A', email: 'a@b.com', password: 'pass', aadhaar_number: '123' });
      const res = mockRes();

      await authController.register(req, res);
      expect(res.render).toHaveBeenCalledWith('auth/register', expect.objectContaining({
        error: 'Invalid Aadhaar number (12 digits required)',
        prevInput: req.body
      }));
    });

    it('renders error when user exists', async () => {
      const req = mockReq({ name: 'A', email: 'a@b.com', password: 'pass', aadhaar_number: '123456789012' });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [ { id: 1 } ] });

      await authController.register(req, res);
      expect(res.render).toHaveBeenCalledWith('auth/register', expect.objectContaining({
        error: 'User already exists',
        prevInput: req.body
      }));
    });

    it('creates user and redirects on success', async () => {
      const req = mockReq({ name: 'A', email: 'a@b.com', password: 'pass', aadhaar_number: '123456789012' });
      const res = mockRes();
      mockQuery
        .mockResolvedValueOnce({ rows: [] })              // exists check
        .mockResolvedValueOnce({ rows: [ { id: 2 } ] });  // insert
      mockHash.mockResolvedValueOnce('hashed');
      mockSign.mockReturnValue('token123');

      await authController.register(req, res);
      expect(mockHash).toHaveBeenCalledWith('pass', 10);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), expect.any(Array));
      expect(res.cookie).toHaveBeenCalledWith('jwt', 'token123', expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith('/documents');
    });

    it('handles db error gracefully', async () => {
      const req = mockReq({ name: 'A', email: 'a@b.com', password: 'pass', aadhaar_number: '123456789012' });
      const res = mockRes();
      mockQuery.mockRejectedValueOnce(new Error('DB failure'));

      await authController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith('auth/register', expect.objectContaining({
        error: 'Registration failed. Please try again.',
      }));
    });
  });

  describe('login', () => {
    it('renders error for invalid credentials (no user)', async () => {
      const req = mockReq({ email: 'x@y.com', password: 'pass' });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await authController.login(req, res);
      expect(res.render).toHaveBeenCalledWith('auth/login', expect.objectContaining({
        error: 'Invalid credentials',
        prevInput: { email: 'x@y.com' }
      }));
    });

    it('renders error for wrong password', async () => {
      const req = mockReq({ email: 'x@y.com', password: 'pass' });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [ { id: 1, password: 'hashed' } ] });
      mockCompare.mockResolvedValueOnce(false);

      await authController.login(req, res);
      expect(res.render).toHaveBeenCalledWith('auth/login', expect.objectContaining({
        error: 'Invalid credentials',
        prevInput: { email: 'x@y.com' }
      }));
    });

    it('sets cookie and redirects on success', async () => {
      const req = mockReq({ email: 'x@y.com', password: 'pass' });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [ { id: 1, password: 'hashed' } ] });
      mockCompare.mockResolvedValueOnce(true);
      mockSign.mockReturnValue('tokenXYZ');

      await authController.login(req, res);
      expect(res.cookie).toHaveBeenCalledWith('jwt', 'tokenXYZ', expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith('/documents');
    });
  });

  describe('forgotPassword', () => {
    it('renders error when no account found', async () => {
      const req = mockReq({ email: 'none@x.com' });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await authController.forgotPassword(req, res);
      expect(res.render).toHaveBeenCalledWith('auth/forgot-password', expect.objectContaining({
        error: 'No account found with that email',
        prevInput: { email: 'none@x.com' }
      }));
    });

    it('sends OTP and renders reset page on success', async () => {
      const req = mockReq({ email: 'u@x.com' });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [ {} ] });

      await authController.forgotPassword(req, res);
      expect(otpStore.generateOTP).toHaveBeenCalledWith('u@x.com');
      expect(sendOTPEmail).toHaveBeenCalledWith('u@x.com', '123456');
      expect(res.render).toHaveBeenCalledWith('auth/reset-password', expect.objectContaining({
        email: 'u@x.com',
        success: 'OTP sent to your email!'
      }));
    });
  });

  describe('resetPassword', () => {
    it('renders error when passwords do not match', async () => {
      const req = mockReq({ email: 'u@x.com', otp: '123', password: 'a', confirmPassword: 'b' });
      const res = mockRes();

      await authController.resetPassword(req, res);
      expect(res.render).toHaveBeenCalledWith('auth/reset-password', expect.objectContaining({
        error: 'Passwords do not match'
      }));
    });

    it('renders error on invalid OTP', async () => {
      const req = mockReq({ email: 'u@x.com', otp: '000000', password: 'pass', confirmPassword: 'pass' });
      const res = mockRes();
      otpStore.verifyOTP.mockReturnValueOnce(false);

      await authController.resetPassword(req, res);
      expect(res.render).toHaveBeenCalledWith('auth/reset-password', expect.objectContaining({
        error: 'Invalid or expired OTP'
      }));
    });

    it('updates password and renders login', async () => {
      const req = mockReq({ email: 'u@x.com', otp: '123456', password: 'pass', confirmPassword: 'pass' });
      const res = mockRes();
      otpStore.verifyOTP.mockReturnValueOnce(true);
      mockHash.mockResolvedValueOnce('newhash');
      mockQuery.mockResolvedValueOnce({});

      await authController.resetPassword(req, res);
      expect(mockQuery).toHaveBeenCalledWith('UPDATE users SET password = $1 WHERE email = $2', ['newhash','u@x.com']);
      expect(otpStore.cleanup).toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('auth/login', expect.objectContaining({
        success: 'Password updated successfully! Please login'
      }));
    });
  });

  describe('logout', () => {
    it('clears cookie and redirects', () => {
      const req = {};
      const res = mockRes();
      authController.logout(req, res);
      expect(res.clearCookie).toHaveBeenCalledWith('jwt');
      expect(res.redirect).toHaveBeenCalledWith('/');
    });
  });
});
