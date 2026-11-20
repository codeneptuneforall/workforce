import express from "express";
import multer from "multer";
import { requireAuth } from "../auth";
import { EmployeeModel } from "../models";
import { invalidateCache } from "../store";
import { deleteAsset, publicImageUrl, StorageUnavailableError, uploadProfilePhoto } from "../storage/cloudinary";

const router = express.Router();

// Files are held in memory only long enough to stream them to Cloudinary.
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

/**
 * Upload the signed-in employee's own profile photo.
 *
 * The file goes to Cloudinary (<root>/profiles/<employeeId>, replaced in place) and
 * only its path is saved on the employee record (`photo`); the API builds the URL
 * whenever it sends employee data. This endpoint is the only writer of `photo`, and
 * the target is always the caller's own employee record, never a client-supplied id.
 */
router.post("/profile-picture", requireAuth, upload.single("photo"), async (req: any, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const employeeId = req.user?.employeeId;
    if (!employeeId) return res.status(400).json({ error: "Your account has no employee profile to attach a photo to." });

    const { asset } = await uploadProfilePhoto(String(employeeId), req.file.buffer);
    const photo = { publicId: asset.publicId, version: asset.version, format: asset.format };
    // Store the path and drop any old base64/external photoUrl.
    const result = await EmployeeModel.updateOne({ _id: String(employeeId) }, { $set: { photo }, $unset: { photoUrl: 1 } });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Employee record not found." });
    invalidateCache();

    res.json({ url: publicImageUrl(photo) });
  } catch (e: any) {
    if (res.headersSent) return;
    if (e instanceof StorageUnavailableError) return res.status(503).json({ error: e.message });
    console.error("[upload] profile picture failed:", e?.message ?? e);
    res.status(502).json({ error: "Could not store the photo. Please try again." });
  }
});

/** Remove the signed-in employee's own profile photo (record and Cloudinary file). */
router.delete("/profile-picture", requireAuth, async (req: any, res: any) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return res.status(400).json({ error: "Your account has no employee profile." });
    const employee: any = await EmployeeModel.findById(String(employeeId)).select({ photo: 1 }).lean();
    if (!employee) return res.status(404).json({ error: "Employee record not found." });

    await EmployeeModel.updateOne({ _id: String(employeeId) }, { $unset: { photo: 1, photoUrl: 1 } });
    invalidateCache();
    if (employee.photo?.publicId) {
      void deleteAsset({ publicId: employee.photo.publicId, resourceType: "image", deliveryType: "upload" });
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[upload] remove profile picture failed:", e?.message ?? e);
    if (!res.headersSent) res.status(500).json({ error: "Could not remove the photo. Please try again." });
  }
});

// Handle Multer errors (e.g. file too large, unexpected field)
router.use((err: any, _req: any, res: any, _next: any) => {
  if (!res.headersSent) {
    res.status(400).json({ error: err.message || "Upload failed" });
  }
});

export default router;
