import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import healthRoutes from "./routes/health.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/health", healthRoutes);

export default app;
