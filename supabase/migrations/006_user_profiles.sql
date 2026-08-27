-- 설명: 사용자 프로필(역할 및 승인 여부)을 관리하는 테이블과 자동화 트리거 생성

-- 1. user_profiles 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER',
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS 정책 설정
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 누구나 자신의 프로필은 읽을 수 있음
CREATE POLICY "Users can view own profile" 
ON public.user_profiles FOR SELECT 
USING (auth.uid() = id);

-- ADMIN 역할인 사용자만 모든 프로필을 읽을 수 있음
CREATE POLICY "Admins can view all profiles" 
ON public.user_profiles FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'
    )
);

-- ADMIN 역할인 사용자만 승인 상태를 업데이트할 수 있음
CREATE POLICY "Admins can update profiles" 
ON public.user_profiles FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'
    )
);

-- 3. 회원가입 시 자동 삽입 트리거 함수 (Trigger Function)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- 최고 관리자 이메일 검증
  IF NEW.email = 'yjkim@emko.co.kr' THEN
    INSERT INTO public.user_profiles (id, email, role, is_approved)
    VALUES (NEW.id, NEW.email, 'ADMIN', true);
  ELSE
    INSERT INTO public.user_profiles (id, email, role, is_approved)
    VALUES (NEW.id, NEW.email, 'USER', false);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. auth.users 테이블에 트리거 연결
-- 이미 존재할 경우 삭제 후 재생성 (안전한 마이그레이션)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
