import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FinFile Tools backend is healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;
