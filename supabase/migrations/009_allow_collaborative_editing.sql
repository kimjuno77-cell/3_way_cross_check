-- ============================================================
-- 009: 3-Way Cross Check 다자간 협업을 위한 확인서 수정 권한 확대
-- ============================================================
-- 설명: 1단계(설계), 2단계(구매), 3단계(물류) 작성자가 서로 다른 경우에도
--       모든 담당자가 확인서에 정보를 입력하고 수정할 수 있도록
--       UPDATE 권한을 모든 인증된 사용자에게 허용합니다.
--       단, 데이터 보호를 위해 DELETE(삭제) 권한은 관리자(ADMIN) 또는
--       최초 작성자(created_by) 본인만 가능하도록 유지합니다.

-- 1. 기존 cross_check_forms 테이블의 UPDATE RLS 정책 삭제 후 재등록
DROP POLICY IF EXISTS "Admins or owners can update forms" ON public.cross_check_forms;
DROP POLICY IF EXISTS "Authenticated users can update forms" ON public.cross_check_forms;

-- 설명: 모든 인증된 사용자는 확인서 내용을 수정(UPDATE)할 수 있습니다 (협업 활성화).
CREATE POLICY "Authenticated users can update forms" 
ON public.cross_check_forms FOR UPDATE 
USING (auth.role() = 'authenticated');

-- 2. DELETE 정책 명시적 재확인 (관리자 또는 최초 등록자만 삭제 가능)
DROP POLICY IF EXISTS "Admins or owners can delete forms" ON public.cross_check_forms;

CREATE POLICY "Admins or owners can delete forms" 
ON public.cross_check_forms FOR DELETE 
USING (
    public.is_admin() OR (created_by IS NOT NULL AND created_by = auth.uid())
);
