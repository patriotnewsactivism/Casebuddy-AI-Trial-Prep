-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Insert storage buckets (using INSERT with ON CONFLICT for idempotency)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-files',
  'case-files',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/webm',
    'text/plain',
    'text/csv'
  ]
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-files',
  'evidence-files',
  false,
  104857600, -- 100MB limit for evidence
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transcription-audio',
  'transcription-audio',
  false,
  524288000, -- 500MB limit for audio files
  ARRAY[
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
    'audio/x-m4a',
    'video/mp4',
    'video/webm'
  ]
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  false,
  10485760, -- 10MB limit for templates
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE POLICIES FOR case-files BUCKET
-- ============================================================================

-- Users can upload files to their own directory
CREATE POLICY "case_files_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own files
CREATE POLICY "case_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own files
CREATE POLICY "case_files_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'case-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'case-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "case_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STORAGE POLICIES FOR evidence-files BUCKET
-- ============================================================================

CREATE POLICY "evidence_files_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "evidence_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "evidence_files_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'evidence-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'evidence-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "evidence_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidence-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STORAGE POLICIES FOR transcription-audio BUCKET
-- ============================================================================

CREATE POLICY "transcription_audio_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transcription-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "transcription_audio_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'transcription-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "transcription_audio_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'transcription-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'transcription-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "transcription_audio_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'transcription-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STORAGE POLICIES FOR document-templates BUCKET
-- ============================================================================

CREATE POLICY "document_templates_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "document_templates_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "document_templates_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "document_templates_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STORAGE BUCKET COMMENTS
-- ============================================================================
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads with user-isolated access';
COMMENT ON POLICY "case_files_upload_own" ON storage.objects IS 'Users can upload files to their own directory in case-files bucket';
COMMENT ON POLICY "evidence_files_upload_own" ON storage.objects IS 'Users can upload files to their own directory in evidence-files bucket';
