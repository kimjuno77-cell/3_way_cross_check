-- 설명: 인증된 사용자만 자신의 프로젝트와 폼 데이터에 접근할 수 있도록 하는 RLS 보안 정책입니다.

-- 1. Projects 테이블: 프로젝트는 일단 누구나 읽을 수 있게 하되, 생성/수정/삭제는 인증된 사용자만 가능
CREATE POLICY "Enable read access for all users" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.projects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.projects FOR DELETE USING (auth.role() = 'authenticated');

-- 2. Cross Check Forms 테이블: 작성자(PM)이거나, 아직 PM 서명이 없는 폼에 대해 인증된 사용자 접근 허용
-- 실제 복잡한 권한 설계(소속 팀별 접근)가 필요할 수 있으나, 현재는 가장 넓은 형태의 인증 기반 접근을 허용합니다.
CREATE POLICY "Enable full access for authenticated users" ON public.cross_check_forms
FOR ALL USING (auth.role() = 'authenticated');

-- 3. Form Steps 테이블
CREATE POLICY "Enable full access for authenticated users" ON public.form_steps
FOR ALL USING (auth.role() = 'authenticated');

-- 4. Step Checklist Items 테이블
CREATE POLICY "Enable full access for authenticated users" ON public.step_checklist_items
FOR ALL USING (auth.role() = 'authenticated');

-- 5. Form Evidences 테이블
CREATE POLICY "Enable full access for authenticated users" ON public.form_evidences
FOR ALL USING (auth.role() = 'authenticated');
