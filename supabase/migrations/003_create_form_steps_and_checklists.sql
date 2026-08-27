-- 설명: 3-Way Cross Check의 1~3단계(설계, 구매, 물류) 검증 결과와 상세 체크리스트를 관리하는 테이블입니다.

CREATE TABLE public.form_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.cross_check_forms(id) ON DELETE CASCADE,
    step_number INT NOT NULL CHECK (step_number IN (1, 2, 3)), -- 설명: 1: 설계, 2: 구매, 3: 물류
    document_no VARCHAR(100), -- 설명: DWG No, PO No, P/L No
    document_rev VARCHAR(50), -- 설명: BOM Rev 등 (주로 1단계에서 사용)
    evidence_secured BOOLEAN DEFAULT false, -- 설명: 입고증명서/출하실물사진 등 주요 증빙 확보 여부
    result_status VARCHAR(20) DEFAULT 'PENDING' CHECK (result_status IN ('PENDING', 'PASS', 'FAIL')),
    
    -- 설명: 각 단계를 서명한 담당자의 User ID 연동 (Supabase auth.users)
    manager_sign_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    manager_signed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- 설명: 하나의 확인서 폼에 대해 특정 단계(1, 2, 3)는 각각 하나만 존재해야 합니다.
    UNIQUE(form_id, step_number)
);

-- 설명: RLS 활성화
ALTER TABLE public.form_steps ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_form_steps_modtime
    BEFORE UPDATE ON public.form_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 설명: 각 단계별 세부 체크리스트 항목 (HTML에서 동적 추가/삭제 대응)
CREATE TABLE public.step_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES public.form_steps(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0, -- 설명: 화면상에 보여지는 체크리스트 순서 유지
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 설명: RLS 활성화
ALTER TABLE public.step_checklist_items ENABLE ROW LEVEL SECURITY;
