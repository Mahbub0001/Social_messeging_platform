import React, { useState } from "react";
import { X, Upload, Loader2, Image, Video, Type } from "lucide-react";
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
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!user || !mediaFile || !mediaType) return;
    setUploading(true);
    setError(null);

    try {
      const mediaUrl = await storageService.uploadMedia(mediaFile, "chat-media");
      const { data: newStory, error: uploadError } = await storyService.uploadStory(
        user.id,
        mediaUrl,
        mediaType,
        caption.trim() || undefined
      );
      if (uploadError) {
        setError("Failed to upload story.");
      } else if (newStory) {
        useStore.getState().addStory(newStory);
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            Create Story
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          {preview ? (
            <div className="relative rounded-xl overflow-hidden bg-slate-950">
              {mediaType === "image" ? (
                <img src={preview} alt="Preview" className="w-full h-64 object-contain" />
              ) : (
                <video src={preview} className="w-full h-64 object-contain" controls />
              )}
              <button
                onClick={() => {
                  setPreview(null);
                  setMediaFile(null);
                  setMediaType(null);
                }}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition"
              >
                <X size={16} />
              </button>

              {mediaType && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs flex items-center gap-1">
                  {mediaType === "image" ? <Image size={12} /> : <Video size={12} />}
                  {mediaType === "image" ? "Photo" : "Video"}
                </div>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-violet-500/70 hover:bg-slate-800/30 transition-all group">
              <div className="w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                <Upload size={24} className="text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">Drag photos & videos here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse. Max 50MB.</p>
              </div>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}

          <div className="relative">
            <Type size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              className="w-full pl-9 pr-14 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              {caption.length}/200
            </span>
          </div>

          <button
            onClick={handleUpload}
            disabled={!mediaFile || uploading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sharing...
              </>
            ) : (
              "Share to My Story"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryUploadModal;
