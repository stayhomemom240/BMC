import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const configuredAppOrigin = process.env.APP_ORIGIN
  ? new URL(process.env.APP_ORIGIN).origin
  : null;

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Keep response security headers while leaving CSP to the web host.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const publicLeadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many assessment submissions. Please try again shortly.",
    });
  },
});

const publicConsultationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many consultation requests. Please try again shortly.",
    });
  },
});

const requireSameOriginWrites: RequestHandler = (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  const host = req.get("x-forwarded-host") ?? req.get("host");
  if (!origin || !host) {
    res.status(403).json({ error: "A same-origin request is required." });
    return;
  }

  let parsedOrigin: string;
  try {
    parsedOrigin = new URL(origin).origin;
  } catch {
    res.status(403).json({ error: "A same-origin request is required." });
    return;
  }

  const forwardedOrigin = `${req.protocol}://${host}`;
  const expectedOrigin = configuredAppOrigin ?? forwardedOrigin;
  if (parsedOrigin !== expectedOrigin) {
    logger.warn(
      { event: "cross_origin_write_rejected", method: req.method, path: req.path },
      "Rejected a cross-origin API write",
    );
    res.status(403).json({ error: "A same-origin request is required." });
    return;
  }

  next();
};

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.use("/api", requireSameOriginWrites);
app.use("/api/public/leads", publicLeadRateLimit);
app.use("/api/public/consultation-requests", publicConsultationRateLimit);
app.use("/api", router);

const apiErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const isPayloadTooLarge =
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large";

  if (isPayloadTooLarge) {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }

  const databaseErrorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[0-9A-Z]{5}$/.test(error.code)
      ? error.code
      : undefined;
  const validationIssues =
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
      ? error.issues.map((issue: unknown) => {
          if (typeof issue !== "object" || issue === null) {
            return { code: "unknown", path: "" };
          }
          const code =
            "code" in issue && typeof issue.code === "string"
              ? issue.code
              : "unknown";
          const path =
            "path" in issue && Array.isArray(issue.path)
              ? issue.path
                  .filter(
                    (part: unknown): part is string | number =>
                      typeof part === "string" || typeof part === "number",
                  )
                  .join(".")
              : "";
          return { code, path };
        })
      : undefined;

  logger.error(
    {
      errorType: error instanceof Error ? error.name : "UnknownError",
      databaseErrorCode,
      validationIssues,
      method: req.method,
      path: req.path,
    },
    "Unhandled API error",
  );
  res.status(500).json({ error: "Internal server error." });
};

app.use(apiErrorHandler);

export default app;
