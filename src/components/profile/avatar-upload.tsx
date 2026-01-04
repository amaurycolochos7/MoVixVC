"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { User, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
    currentAvatarUrl: string | null;
    userId: string;
    onUploadComplete: () => void;
}

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({ currentAvatarUrl, userId, onUploadComplete }: AvatarUploadProps) {
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error("Solo se permiten imágenes JPG, PNG o WebP");
            return;
        }

        // Validate size
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`La imagen debe ser menor a ${MAX_SIZE_MB}MB`);
            return;
        }

        // Show preview
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        // Upload
        await uploadFile(file);
    };

    const uploadFile = async (file: File) => {
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/avatar.${fileExt}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(fileName);

            // Update user profile
            const { error: updateError } = await supabase
                .from("users")
                .update({ avatar_url: urlData.publicUrl })
                .eq("id", userId);

            if (updateError) throw updateError;

            toast.success("Foto actualizada");
            onUploadComplete();

        } catch (err) {
            console.error("Upload error:", err);
            toast.error("Error al subir la imagen");
            // Revert preview
            setPreviewUrl(currentAvatarUrl);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="relative">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <User className="h-8 w-8 text-primary" />
                )}

                {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                )}
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-white hover:bg-primary/90"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
            >
                <Camera className="h-3.5 w-3.5" />
            </Button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
            />
        </div>
    );
}
