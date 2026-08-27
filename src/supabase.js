import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== "https://your-project-url.supabase.co") {
    client = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn("Supabase 환경 변수가 설정되지 않았습니다.");
}

export const supabase = client;
