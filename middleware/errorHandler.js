module.exports = {
  handleRouteErrors: (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  },

  globalErrorHandler: (err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).render('error', {
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
};