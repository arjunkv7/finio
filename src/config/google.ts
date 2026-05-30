// Google OAuth 2.0 credentials from Google Cloud Console
// Setup steps:
//
// 1. Get your debug SHA-1 fingerprint — run this in a terminal:
//    keytool -keystore ~/.android/debug.keystore -list -v \
//      -alias androiddebugkey -storepass android -keypass android
//
// 2. Go to console.cloud.google.com → your project → enable "Google Drive API"
//
// 3. Credentials → Create Credentials → OAuth 2.0 Client ID
//    Application type: Android  (NOT Web application)
//    Package name:     com.finio.app
//    SHA-1:            paste from step 1
//
// 4. Copy the generated Client ID below (ends in .apps.googleusercontent.com)

export const GOOGLE_ANDROID_CLIENT_ID =
  '657425659676-puavhnckbcctji7hogr3of7r67rhvjnn.apps.googleusercontent.com';

// Drive file scope — app can only read/write files it creates
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
