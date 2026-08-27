import { supabase } from './supabase.js';
import { setupAuth, checkSession } from './auth.js';
import { setupDashboard, loadDashboard } from './dashboard.js';
import { setupForm } from './form.js';

// 화면(View) 요소 캐싱
const authView = document.getElementById('auth-view');
const appLayout = document.getElementById('app-layout');
const dashboardView = document.getElementById('dashboard-view');
const formView = document.getElementById('form-view');
const pendingView = document.getElementById('pending-view');
const adminView = document.getElementById('admin-view');
const userEmailDisplay = document.getElementById('user-email-display');
const btnAdminPanel = document.getElementById('btn-admin-panel');
const btnPendingLogout = document.getElementById('btn-pending-logout');
const btnBackFromAdmin = document.getElementById('btn-back-from-admin');

// 현재 접속자 프로필 정보 캐싱
let currentUserProfile = null;

// 앱 초기화
async function initApp() {
    if (!supabase) {
        alert('Supabase가 설정되지 않았습니다. .env 파일을 확인해주세요.');
        return;
    }

    // 각 모듈별 이벤트 리스너 세팅
    setupAuth(onLoginSuccess, onLogout);
    setupDashboard(showFormView);
    setupForm(showDashboardView); // 저장 완료시 또는 뒤로가기 클릭시 대시보드로 복귀

    if (btnPendingLogout) {
        btnPendingLogout.addEventListener('click', async () => {
            await supabase.auth.signOut();
            onLogout();
        });
    }

    if (btnAdminPanel) {
        btnAdminPanel.addEventListener('click', () => {
            showAdminView();
        });
    }
    
    if (btnBackFromAdmin) {
        btnBackFromAdmin.addEventListener('click', () => {
            showDashboardView();
        });
    }

    // 세션 체크
    const session = await checkSession();
    if (session) {
        await onLoginSuccess(session.user);
    } else {
        showAuthView();
    }
}

// 뷰 전환 헬퍼 함수들
function hideAllViews() {
    dashboardView.classList.add('hidden');
    formView.classList.add('hidden');
    pendingView.classList.add('hidden');
    adminView.classList.add('hidden');
}

function showAuthView() {
    authView.classList.remove('hidden');
    appLayout.classList.add('hidden');
    btnAdminPanel.classList.add('hidden');
}

function showPendingView() {
    authView.classList.add('hidden');
    appLayout.classList.remove('hidden');
    hideAllViews();
    pendingView.classList.remove('hidden');
}

async function showAdminView() {
    authView.classList.add('hidden');
    appLayout.classList.remove('hidden');
    hideAllViews();
    adminView.classList.remove('hidden');
    
    const { loadAdminData } = await import('./admin.js');
    loadAdminData();
}

function showDashboardView() {
    authView.classList.add('hidden');
    appLayout.classList.remove('hidden');
    hideAllViews();
    dashboardView.classList.remove('hidden');
    
    // 대시보드 진입 시 데이터 새로고침
    loadDashboard();
}

async function showFormView(formId = null) {
    authView.classList.add('hidden');
    appLayout.classList.remove('hidden');
    hideAllViews();
    formView.classList.remove('hidden');

    // 폼 모듈에게 렌더링 지시
    const { loadFormContent, clearFormContent } = await import('./form.js');
    if (formId) {
        loadFormContent(formId);
    } else {
        clearFormContent();
    }
}

// 인증 콜백
async function onLoginSuccess(user) {
    userEmailDisplay.textContent = user.email;
    
    try {
        // 프로필 정보 조회
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        if (error) {
            // 회원가입 직후(트리거 실행 타이밍) 조회가 안 될 수 있으므로, 약간 대기 후 재조회
            await new Promise(r => setTimeout(r, 1000));
            const { data: retryData } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
            currentUserProfile = retryData;
        } else {
            currentUserProfile = data;
        }

        if (!currentUserProfile) {
            // 트리거 실패나 오류 상황
            showPendingView();
            return;
        }

        // 권한에 따른 분기
        if (currentUserProfile.role === 'ADMIN') {
            btnAdminPanel.classList.remove('hidden');
        } else {
            btnAdminPanel.classList.add('hidden');
        }

        if (currentUserProfile.is_approved) {
            showDashboardView();
        } else {
            showPendingView();
        }
    } catch(err) {
        console.error("프로필 조회 실패", err);
        showPendingView();
    }
}

function onLogout() {
    currentUserProfile = null;
    showAuthView();
}

document.addEventListener('DOMContentLoaded', initApp);

// 다른 모듈에서 뷰 전환이 필요할 때 쓸 수 있도록 export
export { showDashboardView, showFormView, currentUserProfile };
