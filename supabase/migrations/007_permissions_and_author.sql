-- ============================================================
-- 007: 작성자(created_by, author_email) 컬럼 추가 및 권한별 RLS 정책 설정
-- ============================================================

-- 1. cross_check_forms 테이블에 작성자 컬럼 추가
ALTER TABLE public.cross_check_forms 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

ALTER TABLE public.cross_check_forms 
ADD COLUMN IF NOT EXISTS author_email TEXT;

-- 2. 기존 cross_check_forms RLS 정책 업데이트
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.cross_check_forms;
DROP POLICY IF EXISTS "Users can read all forms" ON public.cross_check_forms;
DROP POLICY IF EXISTS "Users can insert own forms" ON public.cross_check_forms;
DROP POLICY IF EXISTS "Admins or owners can update forms" ON public.cross_check_forms;
DROP POLICY IF EXISTS "Admins or owners can delete forms" ON public.cross_check_forms;

-- 모든 인증된 사용자는 확인서를 조회할 수 있음
CREATE POLICY "Users can read all forms" 
ON public.cross_check_forms FOR SELECT 
USING (auth.role() = 'authenticated');

-- 모든 인증된 사용자는 확인서를 신규 작성할 수 있음
CREATE POLICY "Users can insert own forms" 
ON public.cross_check_forms FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 관리자(ADMIN) 또는 작성자 본인만 수정할 수 있음
CREATE POLICY "Admins or owners can update forms" 
ON public.cross_check_forms FOR UPDATE 
USING (
    public.is_admin() OR (created_by IS NOT NULL AND created_by = auth.uid())
);

-- 관리자(ADMIN) 또는 작성자 본인만 삭제할 수 있음
CREATE POLICY "Admins or owners can delete forms" 
ON public.cross_check_forms FOR DELETE 
USING (
    public.is_admin() OR (created_by IS NOT NULL AND created_by = auth.uid())
);
