// tests/documentController.test.js

// Create a shared mock for db.query
const mockQuery = jest.fn();

// Mock config/db module before importing any controllers
jest.mock('../config/db', () => ({
  db: { query: mockQuery }
}));

// Mock email service fully
jest.mock('../services/emailService', () => ({
  sendShareNotification: jest.fn().mockResolvedValue(true)
}));

const { db } = require('../config/db');           // db.query === mockQuery
const emailService = require('../services/emailService');
const documentController = require('../controllers/documentController');

// Helper factories
const mockReq = (overrides = {}) => ({
  user: { id: 1, name: 'Test User' },
  file: { filename: 'test.pdf' },
  body: {},
  params: {},
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

describe('Document Controller', () => {
  beforeEach(() => mockQuery.mockReset());
  afterEach(() => jest.clearAllMocks());

  describe('getDashboard', () => {
    it('renders dashboard on success', async () => {
      const req = mockReq();
      const res = mockRes();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Doc1', description: 'Desc', file_path: '/uploads/test.pdf', document_type: 'pdf', created_at: new Date() }] });

      await documentController.getDashboard(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, title, description'),
        [1]
      );
      expect(res.render).toHaveBeenCalledWith('documents/dashboard', expect.objectContaining({
        documents: expect.any(Array),
        user: req.user,
        error: null
      }));
    });

    it('redirects on DB error', async () => {
      const req = mockReq();
      const res = mockRes();

      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await documentController.getDashboard(req, res);
      expect(res.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('uploadDocument', () => {
    it('inserts document and redirects', async () => {
      const req = mockReq({ body: { title: 'Doc1', description: 'Desc', document_type: 'pdf' } });
      const res = mockRes();

      mockQuery.mockResolvedValueOnce({}); // INSERT

      await documentController.uploadDocument(req, res);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documents'),
        [1, 'Doc1', 'Desc', '/uploads/test.pdf', 'pdf']
      );
      expect(res.redirect).toHaveBeenCalledWith('/documents');
    });

    it('renders dashboard with error on missing file', async () => {
      const req = mockReq({ file: null });
      const res = mockRes();

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await documentController.uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('documents/dashboard', expect.objectContaining({ error: 'No file uploaded' }));
    });
  });

  describe('showSharePage', () => {
    it('renders share page when document exists', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Doc1', description: 'Desc', file_path: '/uploads/test.pdf', document_type: 'pdf', created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, permissions: ['read'], expiry_date: null, shared_with_email: 'a@b.com' }] });

      await documentController.showSharePage(req, res);
      expect(res.render).toHaveBeenCalledWith('documents/share', expect.objectContaining({
        document: expect.any(Object),
        shares: expect.any(Array),
        error: null,
        prevInput: {}
      }));
    });

    it('redirects when document not found', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await documentController.showSharePage(req, res);
      expect(res.redirect).toHaveBeenCalledWith('/documents');
    });
  });

  describe('handleShare', () => {
    it('inserts share, sends email, and redirects', async () => {
      const req = mockReq({ body: { document_id: '1', shared_with: 'a@b.com', permissions: 'read', expiry_date: null } });
      const res = mockRes();

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ title: 'Doc1', file_path: '/uploads/test.pdf' }] });

      await documentController.handleShare(req, res);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO document_shares'), expect.any(Array));
      expect(emailService.sendShareNotification).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/documents/share/1');
    });

    it('renders share page with error when user not found', async () => {
      const req = mockReq({ body: { document_id: '1', shared_with: 'x@y.com', permissions: 'read', expiry_date: null } });
      const res = mockRes();

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Doc1', description: 'Desc', file_path: '/uploads/test.pdf', document_type: 'pdf', created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [] });

      await documentController.handleShare(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.render).toHaveBeenCalledWith('documents/share', expect.objectContaining({ error: 'User not found' }));
    });
  });

  describe('deleteDocument', () => {
    it('deletes document and shares then redirects', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      mockQuery
        .mockResolvedValueOnce({ rows: [{ file_path: '/uploads/test.pdf' }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      jest.spyOn(require('fs'), 'unlink').mockImplementation((_, cb) => cb(null));

      await documentController.deleteDocument(req, res);
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM document_shares WHERE document_id=$1', ['1']);
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM documents WHERE id=$1', ['1']);
      expect(res.redirect).toHaveBeenCalledWith('/documents');
    });

    it('redirects when document not found', async () => {
      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await documentController.deleteDocument(req, res);
      expect(res.redirect).toHaveBeenCalledWith('/documents');
    });
  });
});