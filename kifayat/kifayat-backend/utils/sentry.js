const Sentry = require("@sentry/node");
const logger = require("./logger");

// Initialize Sentry for error monitoring
if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    
    // Set traces sample rate to 1.0% for production
    tracesSampleRate: 0.01,
    
    // Capture 10% of errors for performance monitoring
    profilesSampleRate: 0.1,
    
    // Filter out common errors that don't need tracking
    beforeSend(event, hint) {
      // Ignore errors from client disconnects
      if (event.exception) {
        const error = hint.originalException;
        if (error && error.message) {
          // Ignore common client errors
          const ignoredErrors = [
            'ECONNRESET',
            'ETIMEDOUT',
            'EPIPE',
            'socket hang up',
          ];
          
          if (ignoredErrors.some(ignored => error.message.includes(ignored))) {
            return null;
          }
        }
      }
      return event;
    },
    
    // Add custom context
    initialScope: {
      tags: {
        framework: "express",
        version: require('../package.json').version,
      },
    },
    
    // Integrate with Express
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: null }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    
    // Before send, add additional context
    beforeBreadcrumb(breadcrumb) {
      // Filter out health check requests
      if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
        if (breadcrumb.data.url.includes('/api/health')) {
          return null;
        }
      }
      return breadcrumb;
    },
  });

  logger.info("Sentry initialized for error monitoring");
} else {
  logger.info("Sentry not initialized - missing SENTRY_DSN or not in production");
}

// Helper functions for manual error tracking
const captureException = (error, context = {}) => {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  // Always log locally
  logger.error("Exception captured", { error: error.message, stack: error.stack, context });
};

const captureMessage = (message, level = "info") => {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
    Sentry.captureMessage(message, level);
  }
  // Always log locally
  logger.log(level.toUpperCase(), message);
};

const setUser = (user) => {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
    Sentry.setUser(user);
  }
};

const clearUser = () => {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === "production") {
    Sentry.setUser(null);
  }
};

module.exports = {
  captureException,
  captureMessage,
  setUser,
  clearUser,
  Sentry
};