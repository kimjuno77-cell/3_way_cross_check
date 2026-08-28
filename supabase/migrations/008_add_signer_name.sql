-- ============================================================
-- 008: 서명자 이름/이니셜(signer_name) 컬럼 추가
-- ============================================================

-- 1. cross_check_forms (최종 승인자 서명명)
ALTER TABLE public.cross_check_forms 
ADD COLUMN IF NOT EXISTS pm_signer_name VARCHAR(100);

-- 2. form_steps (1~3단계 담당자 서명명)
ALTER TABLE public.form_steps 
ADD COLUMN IF NOT EXISTS manager_signer_name VARCHAR(100);
