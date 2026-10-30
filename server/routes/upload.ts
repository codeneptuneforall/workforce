import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const router = express.Router();
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../");
const uploadDir = path.resolve(root, "uploads/profiles");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Use memory storage so we can convert the file to a base64 data URL
// and return it instead of a local file path. This ensures profile
// pictures survive deploys because the data URL is stored in MongoDB
// alongside the employee record, not as a separate file on the server.
const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: any, cb: any) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPG, PNG, WebP, or GIF images are allowed"));
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 5 * 1024 * 1024 } 
});

router.post("/profile-picture", upload.single("photo"), async (req: any, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Convert the uploaded buffer to a base64 data URL.
    // This is stored in MongoDB as the employee's photoUrl, so it travels
    // with the record and survives deploys — no separate file on the server.
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    res.json({ url: dataUrl });
  } catch (e: any) {
    if (!res.headersSent) {
      res.status(400).json({ error: e.message || "Upload failed" });
    }
  }
});

// Handle Multer errors (e.g. file too large, unexpected field)
router.use((err: any, _req: any, res: any, _next: any) => {
  if (!res.headersSent) {
    res.status(400).json({ error: err.message || "Upload failed" });
  }
});

export default router;
