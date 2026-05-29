import { supabase, isMockMode } from "../lib/supabase";

class StorageServiceClass {
  /**
   * Uploads a file and returns its publicly accessible URL
   * @param file The File object to upload
   * @param bucketName The name of the storage bucket
   */
  public async uploadMedia(file: File, bucketName: string = "chat-media"): Promise<string> {
    if (isMockMode) {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 800));

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to encode file to base64."));
          }
        };
        reader.onerror = () => {
          reject(new Error("File reading error."));
        };
        reader.readAsDataURL(file);
      });
    } else {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Upload file to Supabase Storage bucket
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      if (!data?.publicUrl) {
        throw new Error("Could not retrieve public URL for uploaded file.");
      }

      return data.publicUrl;
    }
  }
}

export const storageService = new StorageServiceClass();
export default storageService;
