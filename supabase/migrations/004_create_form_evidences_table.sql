-- 설명: 최종 첨부 증빙 리스트(설계 도면, BOM List, PO 등)의 체크 상태를 저장합니다.
--       파일 첨부 없이 체크박스(Y/N)만 저장하도록 요구사항이 반영되었습니다.

CREATE TABLE public.form_evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.cross_check_forms(id) ON DELETE CASCADE,
    evidence_name VARCHAR(100) NOT NULL, -- 설명: 예) '최신 설계 도면', '자재 BOM List'
    is_checked BOOLEAN DEFAULT false,
    is_other BOOLEAN DEFAULT false,      -- 설명: '기타' 항목인지 여부 식별
    other_description VARCHAR(255),      -- 설명: 기타 항목일 때 사용자가 입력하는 텍스트 란
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 설명: RLS 활성화
ALTER TABLE public.form_evidences ENABLE ROW LEVEL SECURITY;
