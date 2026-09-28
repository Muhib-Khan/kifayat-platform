import * as Sentry from "@sentry/react";

// Initialize Sentry for error monitoring
try {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [Sentry.browserTracingIntegration()],

      // Only add the Sentry trace / baggage headers to localhost, the site, and
      // same-origin requests.
      tracePropagationTargets: [
        "localhost",
        "kifayat.co",
        "www.kifayat.co",
        /^\//,
      ],

      // Set traces sample rate to 1.0% for production
      tracesSampleRate: 0.01,

      // Filter out common errors that don't need tracking
      beforeSend(event, hint) {
        // Ignore errors from browser extensions
        if (event.exception) {
          const error = hint.originalException as Error | undefined;
          if (error && error.message && error.message.includes('Extension')) {
            return null;
          }
        }
        return event;
      },
      
      // Add custom context
      initialScope: {
        tags: {
          framework: "react",
          build: import.meta.env.VITE_BUILD_ID || "dev",
        },
      },
    });
    console.log("Sentry initialized successfully");
  }
} catch (error) {
  console.error("Failed to initialize Sentry:", error);
}

export const captureException = (error: Error, context?: Record<string, any>) => {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: context,
      });
    }
  } catch (e) {
    console.error("Failed to capture exception:", e);
  }
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = "info") => {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureMessage(message, level);
    }
  } catch (e) {
    console.error("Failed to capture message:", e);
  }
};

export const setUser = (user: { id: string; email?: string; username?: string }) => {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.setUser(user);
    }
  } catch (e) {
    console.error("Failed to set user:", e);
  }
};

export const clearUser = () => {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.setUser(null);
    }
  } catch (e) {
    console.error("Failed to clear user:", e);
  }
};