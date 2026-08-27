import { supabase } from './supabase.js';
import { setupAuth, checkSession } from './auth.js';
import { setupDashboard, loadDashboard } from './dashboard.js';
import { setupForm } from './form.js';

// 화면(View) 요소 캐싱
const authView = document.getElementById('auth-view');
const appLayout = document.getElementById('app-layout');
const dashboardView = document.getElementById('dashboard-view');
const formView = document.getElementById('form-view');
const userEmailDisplay = document.getElementById('user-email-display');

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

    // 세션 체크
    const session = await checkSession();
    if (session) {
        onLoginSuccess(session.user);
    } else {
        showAuthView();
    }
}

// 뷰 전환 헬퍼 함수들
function showAuthView() {
    authView.classList.remove('hidden');
    appLayout.classList.add('hidden');
}

function showDashboardView() {
    authView.classList.add('hidden');
    appLayout.classList.remove('hidden');
    dashboardView.classList.remove('hidden');
    formView.classList.add('hidden');
    
    // 대시보드 진입 시 데이터 새로고침
    loadDashboard();
}

function showFormView(formId = null) {
    authView.classList.add('hidden');
    appLayout.classList.remove('hidden');
    dashboardView.classList.add('hidden');
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
function onLoginSuccess(user) {
    userEmailDisplay.textContent = user.email;
    showDashboardView();
}

function onLogout() {
    showAuthView();
}

document.addEventListener('DOMContentLoaded', initApp);

// 다른 모듈에서 뷰 전환이 필요할 때 쓸 수 있도록 export
export { showDashboardView, showFormView };
