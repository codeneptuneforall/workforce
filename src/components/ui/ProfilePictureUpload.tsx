import { useState } from "react";
import { CameraIcon, UploadIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import { BASE } from "../../api/client";

export function ProfilePictureUpload({ 
  currentPhotoUrl, 
  onUpload, 
  size = "lg" 
}: { 
  currentPhotoUrl?: string | null; 
  onUpload: (url: string) => void; 
  size?: "sm" | "md" | "lg";
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sizes = {
    sm: "h-10 w-10",
    md: "h-16 w-16", 
    lg: "h-24 w-24"
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      
      const res = await fetch(`${BASE}/api/upload/profile-picture`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const text = await res.text();
      let data: any = {};
      if (text) {
        try { data = JSON.parse(text); } catch { data = {}; }
      }
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      
      onUpload(data.url);
      setPreview(null);
    } catch (err: any) {
      setError(err.message);
      setPreview(null);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const photoUrl = preview || currentPhotoUrl;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <div className={cn("rounded-full overflow-hidden bg-brand-100 ring-4 ring-white shadow-md", sizes[size])}>
          {photoUrl ? (
            <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <CameraIcon className="h-8 w-8 text-brand-600" />
            </div>
          )}
        </div>
        <label 
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-brand-600 p-1.5 text-white cursor-pointer shadow-md transition hover:bg-brand-700",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <UploadIcon className="h-3.5 w-3.5" />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {uploading && <p className="text-xs text-ink-muted">Uploading...</p>}
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
