-- 설명: 프로젝트 기본 정보를 저장하기 위한 테이블을 생성합니다.
--       여러 프로젝트에 대해 각각의 Cross Check 확인서를 관리할 수 있게 해줍니다.

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 설명: RLS (Row Level Security) 활성화
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 설명: 데이터 변경 시 updated_at 컬럼을 자동으로 갱신하기 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_modtime
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
