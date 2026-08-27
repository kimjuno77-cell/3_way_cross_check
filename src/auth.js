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

    // 비밀번호 변경 모달 처리
    const btnChangePw = document.getElementById('btn-change-pw');
    const pwModal = document.getElementById('pw-modal');
    const pwForm = document.getElementById('pw-form');
    const btnPwCancel = document.getElementById('btn-pw-cancel');
    const pwMsg = document.getElementById('pw-msg');
    const pwNew = document.getElementById('pw-new');
    const pwConfirm = document.getElementById('pw-confirm');

    if (btnChangePw && pwModal && pwForm) {
        btnChangePw.addEventListener('click', () => {
            pwModal.classList.remove('hidden');
            pwMsg.textContent = '';
            pwNew.value = '';
            pwConfirm.value = '';
        });

        btnPwCancel.addEventListener('click', () => {
            pwModal.classList.add('hidden');
        });

        pwForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (pwNew.value !== pwConfirm.value) {
                pwMsg.textContent = '비밀번호가 일치하지 않습니다.';
                return;
            }
            if (pwNew.value.length < 6) {
                pwMsg.textContent = '비밀번호는 6자리 이상이어야 합니다.';
                return;
            }

            pwMsg.className = 'text-xs text-blue-600';
            pwMsg.textContent = '변경 중...';

            const { error } = await supabase.auth.updateUser({ password: pwNew.value });
            if (error) {
                pwMsg.className = 'text-xs text-red-500';
                pwMsg.textContent = '변경 실패: ' + error.message;
            } else {
                alert('비밀번호가 성공적으로 변경되었습니다.');
                pwModal.classList.add('hidden');
            }
        });
    }
}

export async function checkSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session;
}
