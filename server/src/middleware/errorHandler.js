import { env } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  console.error(err);

  const status = err.status || err.statusCode || 500;

  res.status(status).json({
    error: {
      message: err.message || "Internal Server Error",
      ...(env.nodeEnv !== "production" && { stack: err.stack }),
    },
  });
};
