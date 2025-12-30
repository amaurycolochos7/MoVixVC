# Google Drive Setup for MoVix KYC

## Overview

This guide explains how to set up Google Drive integration for the KYC verification system. The Edge Function uploads driver documents (INE and selfie) to a designated Google Drive folder.

## Prerequisites

- Google Cloud Platform account
- Access to create Service Accounts
- A Google Drive folder for storing KYC documents

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note the **Project ID**

## Step 2: Enable Google Drive API

1. Navigate to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click **Enable**

## Step 3: Create Service Account

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Fill in:
   - Service account name: `movix-kyc-uploader`
   - Service account ID: `movix-kyc-uploader`
4. Click **Create and Continue**
5. Skip optional permissions, click **Done**

## Step 4: Generate Service Account Key

1. Click on the newly created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create** (downloads the key file)
6. **Keep this file secure!** It contains sensitive credentials.

The downloaded JSON file looks like:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "movix-kyc-uploader@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

## Step 5: Create KYC Root Folder in Google Drive

1. Open [Google Drive](https://drive.google.com/)
2. Create a new folder: `MoVix_KYC_Documents`
3. Right-click the folder → **Share**
4. Add the service account email (found in JSON: `client_email`)
   - Example: `movix-kyc-uploader@your-project.iam.gserviceaccount.com`
5. Set permission to **Editor**
6. Click **Share**

## Step 6: Get Folder ID

1. Open the KYC folder in Google Drive
2. Look at the URL:
   ```
   https://drive.google.com/drive/folders/1abc123xyz...
   ```
3. Copy the folder ID: `1abc123xyz...`

## Step 7: Configure Supabase Environment Variables

### For Local Development

Create `.env` file in `supabase/functions/`:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_DRIVE_KYC_FOLDER=1abc123xyz...
```

### For Production (Supabase Dashboard)

1. Go to your Supabase project
2. Navigate to **Settings** → **Edge Functions**
3. Add secrets:

| Name | Value |
|------|-------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire contents of the JSON key file (minified) |
| `GOOGLE_DRIVE_KYC_FOLDER` | Folder ID from Step 6 |

**Important:** Minify the JSON by removing newlines:

```bash
# Linux/Mac
cat your-key-file.json | jq -c .

# Windows PowerShell
Get-Content your-key-file.json | ConvertFrom-Json | ConvertTo-Json -Compress
```

## Step 8: Deploy Edge Function

```bash
cd movix

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy function
supabase functions deploy upload-kyc
```

## Testing the Integration

### Local Testing

```bash
# Start Supabase locally
supabase start

# Start function in serve mode
supabase functions serve upload-kyc --env-file ./supabase/functions/.env
```

### Test Upload with cURL

```bash
curl -X POST http://localhost:54321/functions/v1/upload-kyc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "ine_front=@/path/to/ine_front.jpg" \
  -F "ine_back=@/path/to/ine_back.jpg" \
  -F "selfie=@/path/to/selfie.jpg"
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "folder_url": "https://drive.google.com/drive/folders/...",
    "kyc_status": "pending"
  }
}
```

## Folder Structure in Drive

After KYC submissions, the folder structure will be:

```
MoVix_KYC_Documents/
├── KYC_TAXI_uuid1_Juan_Perez/
│   ├── INE_FRENTE.jpg
│   ├── INE_ATRAS.jpg
│   └── SELFIE.jpg
├── KYC_MANDADITO_uuid2_Maria_Lopez/
│   ├── INE_FRENTE.png
│   ├── INE_ATRAS.png
│   └── SELFIE.png
└── ...
```

## Troubleshooting

### Error: "Failed to get access token"

- Verify `GOOGLE_SERVICE_ACCOUNT_JSON` is valid JSON
- Check that the service account has Drive API enabled
- Ensure private key newlines are preserved (`\n` not `\\n`)

### Error: "Failed to create folder"

- Verify `GOOGLE_DRIVE_KYC_FOLDER` is correct
- Ensure service account was shared on the folder with Editor permissions
- Check that the folder hasn't been deleted or moved to trash

### Error: "FILE_TOO_LARGE"

- Files must be under 5MB
- Compress images before uploading if needed

### Error: "INVALID_FILE_TYPE"

- Only JPEG, PNG, and WebP are allowed
- Ensure file extension matches content type

## Security Considerations

1. **Never commit** the Service Account JSON to version control
2. **Use secrets** in Supabase Dashboard for production
3. **Limit folder sharing** to only the service account (don't share with "Anyone with link")
4. **Monitor Drive usage** in Google Cloud Console for unexpected activity
5. **Consider retention policy** for old KYC documents
