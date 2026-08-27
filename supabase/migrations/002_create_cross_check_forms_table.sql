-- 설명: 개별 3-Way Cross Check 확인서의 메인 정보를 저장하는 테이블을 생성합니다.
--       사용자 요청에 따라 최종 승인자(PM) 서명은 로그인한 사용자의 User ID(UUID)와 연동되도록 auth.users를 참조합니다.

CREATE TABLE public.cross_check_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    package_no VARCHAR(100),
    item_name VARCHAR(255),
    inspection_date DATE,
    
    -- 설명: 최종 출하 승인을 진행한 사용자(PM / 부서장)의 User ID 연동 (Supabase auth.users)
    pm_sign_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    pm_signed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 설명: RLS (Row Level Security) 활성화
ALTER TABLE public.cross_check_forms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_cross_check_forms_modtime
    BEFORE UPDATE ON public.cross_check_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
