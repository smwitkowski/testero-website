-- Foundation only: PMLE serving, session snapshots and billing stay unchanged.
BEGIN;
ALTER TABLE public.exam_domains
 ADD COLUMN exam TEXT NOT NULL DEFAULT 'GCP_PM_ML_ENG';
ALTER TABLE public.exam_domains DROP CONSTRAINT exam_domains_code_key;
ALTER TABLE public.exam_domains
 ADD CONSTRAINT exam_domains_exam_code_key UNIQUE (exam, code),
 ADD CONSTRAINT exam_domains_id_exam_key UNIQUE (id, exam);
-- Replace, rather than add a second relationship: PostgREST nesting stays unambiguous.
ALTER TABLE public.questions DROP CONSTRAINT questions_domain_id_fkey;
ALTER TABLE public.questions
 ADD CONSTRAINT questions_domain_id_fkey FOREIGN KEY (domain_id, exam)
 REFERENCES public.exam_domains(id, exam) ON DELETE RESTRICT;
ALTER TABLE public.questions
 ADD COLUMN question_type TEXT NOT NULL DEFAULT 'single_select'
 CHECK (question_type IN ('single_select', 'multiple_select')),
 ADD CONSTRAINT questions_multiple_select_not_live
 CHECK (question_type = 'single_select' OR status IS DISTINCT FROM 'ACTIVE');
COMMENT ON COLUMN public.questions.question_type IS
 'single_select: exactly one correct answer. multiple_select: exact-set scoring; not servable until phase 3.';
-- IDs and all existing domain names/codes and question content remain intact.
-- Codes match shared/cert_context.py; weights/provenance are frozen from reviewed guides.
INSERT INTO public.exam_domains (exam, code, name, description) VALUES
 ('cloud-engineer', 'cloud-engineer:standard:1', 'Setting up a cloud solution environment', 'Standard guide section 1; weight 20.0%; guide SHA256 a7c7295e3594c2b2dc9fc449772ed24e0f8102809837ddec9a8b807968e407c6'),
 ('cloud-engineer', 'cloud-engineer:standard:2', 'Planning and implementing a cloud solution', 'Standard guide section 2; weight 30.0%; guide SHA256 a7c7295e3594c2b2dc9fc449772ed24e0f8102809837ddec9a8b807968e407c6'),
 ('cloud-engineer', 'cloud-engineer:standard:3', 'Ensuring the successful operation of a cloud solution', 'Standard guide section 3; weight 30.0%; guide SHA256 a7c7295e3594c2b2dc9fc449772ed24e0f8102809837ddec9a8b807968e407c6'),
 ('cloud-engineer', 'cloud-engineer:standard:4', 'Configuring access and security', 'Standard guide section 4; weight 20.0%; guide SHA256 a7c7295e3594c2b2dc9fc449772ed24e0f8102809837ddec9a8b807968e407c6'),
 ('cloud-architect', 'cloud-architect:standard:1', 'Designing and planning a cloud solution architecture', 'Standard guide section 1; weight 25.0%; guide SHA256 40e12f019a5804ec5da4813cf3ce58ad84ff99443b3ba5fc3c96212d0627aaeb'),
 ('cloud-architect', 'cloud-architect:standard:2', 'Managing and provisioning a cloud solution infrastructure', 'Standard guide section 2; weight 17.5%; guide SHA256 40e12f019a5804ec5da4813cf3ce58ad84ff99443b3ba5fc3c96212d0627aaeb'),
 ('cloud-architect', 'cloud-architect:standard:3', 'Designing for security and compliance', 'Standard guide section 3; weight 17.5%; guide SHA256 40e12f019a5804ec5da4813cf3ce58ad84ff99443b3ba5fc3c96212d0627aaeb'),
 ('cloud-architect', 'cloud-architect:standard:4', 'Analyzing and optimizing technical and business processes', 'Standard guide section 4; weight 15.0%; guide SHA256 40e12f019a5804ec5da4813cf3ce58ad84ff99443b3ba5fc3c96212d0627aaeb'),
 ('cloud-architect', 'cloud-architect:standard:5', 'Managing implementation', 'Standard guide section 5; weight 12.5%; guide SHA256 40e12f019a5804ec5da4813cf3ce58ad84ff99443b3ba5fc3c96212d0627aaeb'),
 ('cloud-architect', 'cloud-architect:standard:6', 'Ensuring solution and operations excellence', 'Standard guide section 6; weight 12.5%; guide SHA256 40e12f019a5804ec5da4813cf3ce58ad84ff99443b3ba5fc3c96212d0627aaeb'),
 ('data-engineer', 'data-engineer:standard:1', 'Designing data processing systems', 'Standard guide section 1; weight 22.0%; guide SHA256 2894c67e980d162e8198c1feb69cee8f450c50b65394e91bc36a983504658281'),
 ('data-engineer', 'data-engineer:standard:2', 'Ingesting and processing the data', 'Standard guide section 2; weight 25.0%; guide SHA256 2894c67e980d162e8198c1feb69cee8f450c50b65394e91bc36a983504658281'),
 ('data-engineer', 'data-engineer:standard:3', 'Storing the data', 'Standard guide section 3; weight 20.0%; guide SHA256 2894c67e980d162e8198c1feb69cee8f450c50b65394e91bc36a983504658281'),
 ('data-engineer', 'data-engineer:standard:4', 'Preparing and using data for analysis', 'Standard guide section 4; weight 15.0%; guide SHA256 2894c67e980d162e8198c1feb69cee8f450c50b65394e91bc36a983504658281'),
 ('data-engineer', 'data-engineer:standard:5', 'Maintaining and automating data workloads', 'Standard guide section 5; weight 18.0%; guide SHA256 2894c67e980d162e8198c1feb69cee8f450c50b65394e91bc36a983504658281')
ON CONFLICT (exam, code) DO NOTHING;
COMMIT;
