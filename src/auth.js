import { supabase } from './supabase.js';

let onSuccessCallback = null;
let onLogoutCallback = null;

export function setupAuth(onSuccess, onLogout) {
    onSuccessCallback = onSuccess;
    onLogoutCallback = onLogout;

    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const msgEl = document.getElementById('auth-msg');
    const btnSignup = document.getElementById('btn-signup');
    const btnLogout = document.getElementById('btn-logout');

    // 로그인
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        msgEl.textContent = '로그인 중...';
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            msgEl.textContent = '로그인 실패: ' + error.message;
        } else {
            msgEl.textContent = '';
            emailInput.value = '';
            passwordInput.value = '';
            if (onSuccessCallback) onSuccessCallback(data.user);
        }
    });

    // 회원가입
    btnSignup.addEventListener('click', async () => {
        if (!emailInput.value || !passwordInput.value) {
            msgEl.textContent = '이메일과 비밀번호를 입력해주세요.';
            return;
        }
        msgEl.textContent = '회원가입 처리 중...';

        const { data, error } = await supabase.auth.signUp({
            email: emailInput.value,
            password: passwordInput.value,
        });

        if (error) {
            msgEl.textContent = '가입 실패: ' + error.message;
        } else {
            // 이메일 확인이 비활성화되어 있다면 즉시 로그인 처리될 수 있음
            msgEl.className = 'text-sm text-center mt-2 text-green-600';
            msgEl.textContent = '가입이 완료되었습니다. (또는 이메일을 확인해주세요)';
            
            if (data.session) {
                if (onSuccessCallback) onSuccessCallback(data.user);
            }
        }
    });

    // 로그아웃
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
            if (onLogoutCallback) onLogoutCallback();
        });
    }
}

export async function checkSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session;
}
