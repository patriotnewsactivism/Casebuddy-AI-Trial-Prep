/**
 * Google Drive Service — stub
 * Full Drive integration requires Google Cloud credentials.
 * Set googleClientId and googleApiKey in Settings to enable.
 */

export const openDrivePicker = async (
  _clientId: string,
  _apiKey: string,
  onStatus?: (msg: string) => void,
): Promise<File[]> => {
  onStatus?.('Google Drive integration not configured');
  console.warn('[driveService] Google Drive integration requires GAPI credentials.');
  return [];
};

export const uploadToDrive = async (
  _clientId: string,
  _folderName: string,
  _fileName: string,
  _content: File | string,
  _mimeType: string,
): Promise<void> => {
  console.warn('[driveService] uploadToDrive: Google Drive not configured — skipping upload.');
};
