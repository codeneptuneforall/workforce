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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const id = (req as any).user?.employeeId || (req as any).user?.id || "unknown";
    const name = `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

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

router.post("/profile-picture", upload.single("photo"), (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/uploads/profiles/${req.file.filename}`;
    res.json({ url });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Upload failed" });
  }
});

export default router;
