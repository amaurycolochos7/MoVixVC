// supabase/functions/upload-kyc/index.ts
// Edge Function: Upload KYC documents to Google Drive
// Receives: INE_FRENTE, INE_ATRAS, SELFIE
// Creates folder: KYC_{ROL}_{user_id}_{NOMBRE}
// Updates: kyc_submissions table + users.kyc_status='pending'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// File validation constants
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const REQUIRED_FILES = ["ine_front", "ine_back", "selfie"] as const;

// Google Drive API types
interface DriveFile {
    id: string;
    webViewLink: string;
}

interface UploadResult {
    file_id: string;
    url: string;
}

// Get Google Drive access token using Service Account
async function getGoogleAccessToken(): Promise<string> {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    // Create JWT for Google OAuth
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/drive.file",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    };

    // Base64URL encode
    const encodeBase64Url = (obj: object) => {
        const json = JSON.stringify(obj);
        const base64 = btoa(json);
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };

    const headerB64 = encodeBase64Url(header);
    const payloadB64 = encodeBase64Url(payload);
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Sign with RS256
    const privateKey = serviceAccount.private_key;
    const encoder = new TextEncoder();
    const data = encoder.encode(unsignedToken);

    // Import the private key
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKey
        .replace(pemHeader, "")
        .replace(pemFooter, "")
        .replace(/\n/g, "");
    const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, data);
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const jwt = `${unsignedToken}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Failed to get access token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

// Create folder in Google Drive
async function createDriveFolder(
    accessToken: string,
    folderName: string,
    parentFolderId: string
): Promise<DriveFile> {
    const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentFolderId],
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create folder: ${error}`);
    }

    return await response.json();
}

// Upload file to Google Drive
async function uploadFileToDrive(
    accessToken: string,
    file: File,
    fileName: string,
    folderId: string
): Promise<UploadResult> {
    // Prepare multipart upload
    const metadata = {
        name: fileName,
        parents: [folderId],
    };

    const boundary = "boundary_" + Date.now();
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileArrayBuffer);

    // Build multipart body
    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const filePart = `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`;
    const endBoundary = `\r\n--${boundary}--`;

    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart);
    const filePartBytes = encoder.encode(filePart);
    const endBytes = encoder.encode(endBoundary);

    const body = new Uint8Array(
        metadataBytes.length + filePartBytes.length + fileBytes.length + endBytes.length
    );
    body.set(metadataBytes, 0);
    body.set(filePartBytes, metadataBytes.length);
    body.set(fileBytes, metadataBytes.length + filePartBytes.length);
    body.set(endBytes, metadataBytes.length + filePartBytes.length + fileBytes.length);

    const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body: body,
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upload file ${fileName}: ${error}`);
    }

    const result: DriveFile = await response.json();
    return {
        file_id: result.id,
        url: result.webViewLink,
    };
}

// Validate file
function validateFile(file: File | null, fieldName: string): void {
    if (!file) {
        throw { code: "MISSING_FILE", field: fieldName };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw {
            code: "INVALID_FILE_TYPE",
            field: fieldName,
            message: `File must be JPEG, PNG, or WebP`,
        };
    }
    if (file.size > MAX_FILE_SIZE) {
        throw {
            code: "FILE_TOO_LARGE",
            field: fieldName,
            message: `File must be less than 5MB`,
        };
    }
}

// Sanitize name for folder
function sanitizeName(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special chars
        .replace(/\s+/g, "_") // Replace spaces with underscores
        .substring(0, 50); // Limit length
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Only allow POST
    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ success: false, error: "METHOD_NOT_ALLOWED" }),
            { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        // 1. Authenticate user
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw { code: "UNAUTHORIZED", message: "Missing authorization header" };
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Client with user's JWT (for auth check)
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Admin client for database writes (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            throw { code: "UNAUTHORIZED", message: "Invalid or expired token" };
        }

        // 2. Get user profile and validate eligibility
        const { data: profile, error: profileError } = await supabaseClient
            .from("users")
            .select("role, full_name, kyc_status")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            throw { code: "USER_NOT_FOUND", message: "User profile not found" };
        }

        // Only taxi and mandadito can submit KYC
        if (!["taxi", "mandadito"].includes(profile.role)) {
            throw {
                code: "INVALID_ROLE",
                message: "Only drivers can submit KYC documents",
            };
        }

        // Check if already submitted
        if (profile.kyc_status !== "not_submitted" && profile.kyc_status !== "rejected") {
            throw {
                code: "KYC_ALREADY_SUBMITTED",
                message: `KYC is already ${profile.kyc_status}`,
                current_status: profile.kyc_status,
            };
        }

        // 3. Parse and validate form data
        const formData = await req.formData();

        const files = {
            ine_front: formData.get("ine_front") as File | null,
            ine_back: formData.get("ine_back") as File | null,
            selfie: formData.get("selfie") as File | null,
        };

        // Validate all files
        for (const fieldName of REQUIRED_FILES) {
            validateFile(files[fieldName], fieldName);
        }

        // 4. Initialize Google Drive
        const parentFolderId = Deno.env.get("GOOGLE_DRIVE_KYC_FOLDER");
        if (!parentFolderId) {
            throw { code: "CONFIG_ERROR", message: "GOOGLE_DRIVE_KYC_FOLDER not configured" };
        }

        const accessToken = await getGoogleAccessToken();

        // 5. Create folder in Drive
        const sanitizedName = sanitizeName(profile.full_name);
        const folderName = `KYC_${profile.role.toUpperCase()}_${user.id}_${sanitizedName}`;

        console.log(`Creating Drive folder: ${folderName}`);
        const folder = await createDriveFolder(accessToken, folderName, parentFolderId);

        // 6. Upload all files
        console.log("Uploading INE_FRENTE...");
        const ineFrontResult = await uploadFileToDrive(
            accessToken,
            files.ine_front!,
            "INE_FRENTE" + getFileExtension(files.ine_front!),
            folder.id
        );

        console.log("Uploading INE_ATRAS...");
        const ineBackResult = await uploadFileToDrive(
            accessToken,
            files.ine_back!,
            "INE_ATRAS" + getFileExtension(files.ine_back!),
            folder.id
        );

        console.log("Uploading SELFIE...");
        const selfieResult = await uploadFileToDrive(
            accessToken,
            files.selfie!,
            "SELFIE" + getFileExtension(files.selfie!),
            folder.id
        );

        // 7. Save to database (using admin client to bypass RLS)

        // Delete any existing KYC submission (for re-submit after rejection)
        await supabaseAdmin.from("kyc_submissions").delete().eq("user_id", user.id);

        // Insert new KYC submission
        const { error: insertError } = await supabaseAdmin.from("kyc_submissions").insert({
            user_id: user.id,
            drive_folder_id: folder.id,
            drive_folder_url: folder.webViewLink,
            ine_front_file_id: ineFrontResult.file_id,
            ine_front_url: ineFrontResult.url,
            ine_back_file_id: ineBackResult.file_id,
            ine_back_url: ineBackResult.url,
            selfie_file_id: selfieResult.file_id,
            selfie_url: selfieResult.url,
        });

        if (insertError) {
            console.error("Failed to insert KYC submission:", insertError);
            throw { code: "DATABASE_ERROR", message: "Failed to save KYC data" };
        }

        // Update user status
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({
                kyc_status: "pending",
                kyc_submitted_at: new Date().toISOString(),
                kyc_rejection_reason: null, // Clear any previous rejection reason
            })
            .eq("id", user.id);

        if (updateError) {
            console.error("Failed to update user KYC status:", updateError);
            throw { code: "DATABASE_ERROR", message: "Failed to update KYC status" };
        }

        // 8. Return success
        console.log(`KYC submitted successfully for user ${user.id}`);
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    folder_url: folder.webViewLink,
                    kyc_status: "pending",
                },
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error: unknown) {
        console.error("KYC upload error:", error);

        const errorObj = error as { code?: string; message?: string; field?: string };
        const statusCode = errorObj.code === "UNAUTHORIZED" ? 401 : 400;

        return new Response(
            JSON.stringify({
                success: false,
                error: errorObj.code || "INTERNAL_ERROR",
                message: errorObj.message || "An unexpected error occurred",
                field: errorObj.field,
            }),
            {
                status: statusCode,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});

// Helper: Get file extension from File object
function getFileExtension(file: File): string {
    const mimeToExt: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    };
    return mimeToExt[file.type] || ".jpg";
}
