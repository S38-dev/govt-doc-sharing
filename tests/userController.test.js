// tests/userController.test.js

// Shared mocks
const mockQuery = jest.fn();
const mockCompare = jest.spyOn(require('bcryptjs'), 'compare');
const mockHash = jest.spyOn(require('bcryptjs'), 'hash');
const mockSendOTPEmail = jest.spyOn(require('../services/emailService'), 'sendOTPEmail');

// Mock db and services before import
jest.mock('../config/db', () => ({ db: { query: mockQuery } }));

const { db } = require('../config/db');
const userController = require('../controllers/userController');

// Helpers
const mockReq = (overrides = {}) => ({
  user: { id: 1, email: 'u@x.com', name: 'Test' },
  body: {},
  app: { locals: {} },
  ...overrides
});
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

describe('User Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getProfile', () => {
    it('renders profile on success', async () => {
      const req = mockReq();
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [{ id:1,name:'Test',email:'u@x.com',aadhaar_number:'123',created_at:new Date() }] });

      await userController.getProfile(req, res);
      expect(res.render).toHaveBeenCalledWith('users/profile', expect.objectContaining({ user: expect.any(Object), message: null }));
    });

    it('renders 404 if user not found', async () => {
      const req = mockReq();
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await userController.getProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.render).toHaveBeenCalledWith('error', { error: 'User not found' });
    });

    it('handles DB error', async () => {
      const req = mockReq();
      const res = mockRes();
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await userController.getProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith('error', { error: 'Failed to get profile' });
    });
  });

  describe('updateProfile', () => {
    it('renders error if email in use', async () => {
      const req = mockReq({ body:{ name:'N', email:'e@x.com' }});
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[{id:2}] });

      await userController.updateProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('error', { error:'Email already in use' });
    });

    it('updates and renders profile', async () => {
      const req = mockReq({ body:{ name:'N', email:'e@x.com' }});
      const res = mockRes();
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{id:1,name:'N',email:'e@x.com',aadhaar_number:'123'}] });

      await userController.updateProfile(req, res);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET name'), ['N','e@x.com',1]);
      expect(res.render).toHaveBeenCalledWith('profile', { user: expect.objectContaining({ name:'N',email:'e@x.com' }) });
    });
  });

  describe('initiatePasswordChange', () => {
    it('renders initiate page', async () => {
      const req = mockReq();
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[{id:1,email:'u@x.com'}] });

      await userController.initiatePasswordChange(req, res);
      expect(res.render).toHaveBeenCalledWith('users/initiate-password-change', { user: expect.any(Object), error:null });
    });

    it('handles error by redirecting', async () => {
      const req = mockReq();
      const res = mockRes();
      mockQuery.mockRejectedValueOnce(new Error());

      await userController.initiatePasswordChange(req, res);
      expect(res.redirect).toHaveBeenCalledWith('/users/profile');
    });
  });

  describe('changePassword', () => {
    it('returns 404 if user not found', async () => {
      const req = mockReq({ body:{current_password:'a',new_password:'b'} });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[] });

      await userController.changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.render).toHaveBeenCalledWith('error',{error:'User not found'});
    });

    it('returns 401 if current password mismatch', async () => {
      const req = mockReq({ body:{current_password:'a',new_password:'b'} });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[{password:'h'}] });
      mockCompare.mockResolvedValueOnce(false);

      await userController.changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.render).toHaveBeenCalledWith('error',{error:'Current password incorrect'});
    });

    it('updates password on success', async () => {
      const req = mockReq({ body:{current_password:'a',new_password:'b'} });
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[{password:'h'}] });
      mockCompare.mockResolvedValueOnce(true);
      mockHash.mockResolvedValueOnce('nh');
      mockQuery.mockResolvedValueOnce({});

      await userController.changePassword(req, res);
      expect(mockQuery).toHaveBeenCalledWith('UPDATE users SET password = $1 WHERE id = $2',['nh',1]);
      expect(res.render).toHaveBeenCalledWith('profile',{message:'Password updated successfully'});
    });
  });

  describe('sendOTP & verifyOTP', () => {
    it('sendOTP sets and emails OTP', async () => {
      const req = mockReq();
      const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[{id:1,email:'u@x.com'}] });

      await userController.sendOTP(req, res);
      expect(req.app.locals.otp).toHaveProperty('code');
      expect(mockSendOTPEmail).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/users/verify-otp');
    });

    it('verifyOTP error expired or missing', async () => {
      const req = mockReq({ body:{otp:'1',newPassword:'p'} });
      const res = mockRes();
      req.app.locals.otp = undefined;

      await userController.verifyOTP(req, res);
      expect(res.render).toHaveBeenCalledWith('users/verify-otp',{error:'OTP expired. Please request new OTP.'});
    });

    it('verifyOTP invalid code', async () => {
      const req = mockReq({ body:{otp:'1',newPassword:'p'} });
      const res = mockRes();
      req.app.locals.otp = { code:'2',expires:Date.now()+1000,userId:1 };

      await userController.verifyOTP(req, res);
      expect(res.render).toHaveBeenCalledWith('users/verify-otp',{error:'Invalid OTP. Please try again.'});
    });

    it('verifyOTP success', async () => {
      const req = mockReq({ body:{otp:'1',newPassword:'p'} });
      const res = mockRes();
      const now = Date.now();
      req.app.locals.otp = { code:'1',expires:now+1000,userId:1 };
      mockHash.mockResolvedValueOnce('h');
      mockQuery.mockResolvedValueOnce({});

      await userController.verifyOTP(req, res);
      expect(mockQuery).toHaveBeenCalledWith('UPDATE users SET password = $1 WHERE id = $2',['h',1]);
      expect(res.render).toHaveBeenCalledWith('users/profile',{user:req.user,message:'Password changed successfully!'});
    });
  });

  describe('getAuditLogs', () => {
    it('renders logs on success', async () => {
      const req = mockReq(); const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[{action:'a',document_title:'d'}] });

      await userController.getAuditLogs(req, res);
      expect(res.render).toHaveBeenCalledWith('audit-logs',{logs:expect.any(Array)});
    });
  });

  describe('getSharedDocuments', () => {
    it('renders shared docs', async () => {
      const req = mockReq(); const res = mockRes();
      mockQuery.mockResolvedValueOnce({ rows:[{id:1,title:'t'}] });

      await userController.getSharedDocuments(req, res);
      expect(res.render).toHaveBeenCalledWith('shared-documents',{documents:expect.any(Array)});
    });
  });
});
