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

// 설명: 관리자 이메일 목록 (이 이메일로 로그인하면 DB 상태와 무관하게 항상 ADMIN 권한)
const ADMIN_EMAILS = ['yjkim@emko.co.kr'];

// 인증 콜백
async function onLoginSuccess(user) {
    userEmailDisplay.textContent = user.email;
    
    // 설명: 로그인한 이메일이 관리자 이메일 목록에 포함되는지 확인
    const isHardcodedAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());

    try {
        // 설명: user_profiles 테이블에서 프로필 정보 조회 시도
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        if (error) {
            // 설명: 최초 조회 실패 시 1초 대기 후 재시도 (회원가입 직후 트리거 지연 대비)
            await new Promise(r => setTimeout(r, 1000));
            const { data: retryData } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
            currentUserProfile = retryData;
        } else {
            currentUserProfile = data;
        }
    } catch(err) {
        // 설명: DB 조회 중 예외 발생 시 로그만 남기고 계속 진행
        console.error("프로필 조회 실패 (무시하고 계속 진행)", err);
        currentUserProfile = null;
    }

    // 설명: 프로필이 없거나 조회 실패해도, 하드코딩된 관리자 이메일이면 강제로 프로필 생성
    if (!currentUserProfile) {
        currentUserProfile = {
            id: user.id,
            email: user.email,
            role: isHardcodedAdmin ? 'ADMIN' : 'USER',
            is_approved: isHardcodedAdmin ? true : false,
        };
    }

    // 설명: 하드코딩된 관리자 이메일이면 DB 값과 무관하게 ADMIN + 승인 강제 적용
    if (isHardcodedAdmin) {
        currentUserProfile.role = 'ADMIN';
        currentUserProfile.is_approved = true;
    }

    // 설명: 권한에 따른 화면 분기
    if (currentUserProfile.role === 'ADMIN') {
        btnAdminPanel.classList.remove('hidden');
    } else {
        btnAdminPanel.classList.add('hidden');
    }

    // 설명: 승인 상태에 따라 대시보드 또는 대기 화면으로 분기
    if (currentUserProfile.is_approved) {
        showDashboardView();
    } else {
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
