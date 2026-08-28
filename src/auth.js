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
    const btnOpenSignup = document.getElementById('btn-open-signup');
    const signupModal = document.getElementById('signup-modal');
    const signupForm = document.getElementById('signup-form');
    const btnSignupCancel = document.getElementById('btn-signup-cancel');
    const signupEmail = document.getElementById('signup-email');
    const signupPassword = document.getElementById('signup-password');
    const signupPasswordConfirm = document.getElementById('signup-password-confirm');
    const signupMsg = document.getElementById('signup-msg');
    const btnLogout = document.getElementById('btn-logout');

    // 로그인
    if (authForm) {
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
    }

    // 회원가입 모달 열기
    if (btnOpenSignup && signupModal) {
        btnOpenSignup.addEventListener('click', () => {
            signupModal.classList.remove('hidden');
            signupMsg.textContent = '';
            signupEmail.value = '';
            signupPassword.value = '';
            signupPasswordConfirm.value = '';
        });
    }

    // 회원가입 모달 닫기
    if (btnSignupCancel && signupModal) {
        btnSignupCancel.addEventListener('click', () => {
            signupModal.classList.add('hidden');
        });
    }

    // 회원가입 폼 제출
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (signupPassword.value !== signupPasswordConfirm.value) {
                signupMsg.className = 'text-xs text-red-500';
                signupMsg.textContent = '비밀번호가 일치하지 않습니다.';
                return;
            }
            if (signupPassword.value.length < 6) {
                signupMsg.className = 'text-xs text-red-500';
                signupMsg.textContent = '비밀번호는 최소 6자 이상이어야 합니다.';
                return;
            }

            signupMsg.className = 'text-xs text-blue-600';
            signupMsg.textContent = '회원가입 처리 중...';

            const { data, error } = await supabase.auth.signUp({
                email: signupEmail.value,
                password: signupPassword.value,
            });

            if (error) {
                signupMsg.className = 'text-xs text-red-500';
                signupMsg.textContent = '가입 실패: ' + error.message;
            } else {
                signupMsg.className = 'text-xs text-green-600';
                signupMsg.textContent = '가입이 완료되었습니다! 잠시 후 로그인 처리됩니다.';
                
                // 가입 성공 후 약간 대기 후 로그인 처리 및 모달 닫기
                setTimeout(() => {
                    signupModal.classList.add('hidden');
                    if (data.session && onSuccessCallback) {
                        onSuccessCallback(data.user);
                    } else {
                        // 세션이 바로 생성되지 않는 설정일 경우(이메일 인증 등)
                        alert('가입이 완료되었습니다. 승인 또는 이메일 확인 후 이용 가능합니다.');
                    }
                }, 1500);
            }
        });
    }

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
