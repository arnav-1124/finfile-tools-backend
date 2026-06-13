import express from "express";

import cors from "./config/cors.js";
import healthRoutes from "./modules/health/health.routes.js";
import pdfImageToExcelRoutes from "./modules/pdfImageToExcel/routes/pdfImageToExcel.routes.js";

const app = express();

app.use(cors);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);
app.use("/api/v1/tools/pdf-image-to-excel", pdfImageToExcelRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

export default app;
