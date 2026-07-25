import React, { useState } from "react";
import { X, Upload, Image as ImageIcon, Video as VideoIcon, Loader2 } from "lucide-react";
import { useStore } from "../hooks/useStore";
import { storyService } from "../services/storyService";
import { storageService } from "../services/storageService";

interface StoryUploadModalProps {
  onClose: () => void;
  onUploadComplete: () => void;
}

export const StoryUploadModal: React.FC<StoryUploadModalProps> = ({ onClose, onUploadComplete }) => {
  const user = useStore((state) => state.user);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.type.startsWith("image/")) {
      setMediaType("image");
    } else if (file.type.startsWith("video/")) {
      setMediaType("video");
    } else {
      setError("Please select an image or video file.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File size must be under 50MB.");
      return;
    }

    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleUpload = async () => {
    if (!user || !mediaFile || !mediaType) return;

    setUploading(true);
    setError(null);

    try {
      const mediaUrl = await storageService.uploadMedia(mediaFile, "chat-media");
      const { error: uploadError } = await storyService.uploadStory(
        user.id,
        mediaUrl,
        mediaType,
        caption.trim() || undefined
      );

      if (uploadError) {
        setError("Failed to upload story.");
      } else {
        onUploadComplete();
        onClose();
      }
    } catch (err) {
      setError("Failed to upload story. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-bold dark:text-white">Add to Story</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"
          >
            <X size={20} className="dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 rounded-xl text-red-600 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {preview ? (
            <div className="relative">
              {mediaType === "image" ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <video
                  src={preview}
                  className="w-full h-64 object-cover rounded-lg"
                  controls
                />
              )}
              <button
                onClick={() => {
                  setPreview(null);
                  setMediaFile(null);
                  setMediaType(null);
                }}
                className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg cursor-pointer hover:border-violet-500 dark:hover:border-violet-500 transition">
              <Upload size={40} className="text-gray-400 dark:text-gray-500" />
              <div className="text-center">
                <p className="text-sm font-medium dark:text-white">Click to upload media</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Photos or videos. Max 50MB.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium dark:text-gray-300">
                  <ImageIcon size={14} /> Image
                </span>
                <span className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium dark:text-gray-300">
                  <VideoIcon size={14} /> Video
                </span>
              </div>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}

          <div>
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!mediaFile || uploading}
            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading...
              </>
            ) : (
              "Share to Story"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryUploadModal;
