import { supabase } from './supabase.js';
import { currentUserProfile } from './app.js';

let onNewFormCallback = null;
const projectListEl = document.getElementById('project-list');
const searchInput = document.getElementById('search-input');
let allForms = [];

export function setupDashboard(showFormViewCb) {
    onNewFormCallback = showFormViewCb;

    const btnNewForm = document.getElementById('btn-new-form');
    if (btnNewForm) {
        btnNewForm.addEventListener('click', () => {
            if (onNewFormCallback) onNewFormCallback(null); // 신규 작성 (ID 없음)
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderGroupedList(e.target.value);
        });
    }
}

// 설명: 대시보드 데이터 로드 (확인서 및 연결된 프로젝트, 작성자 정보 조회)
export async function loadDashboard() {
    if (!projectListEl) return;
    projectListEl.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><br>프로젝트 목록을 불러오는 중...</div>';
    
    try {
        const { data, error } = await supabase
            .from('cross_check_forms')
            .select(`
                id,
                project_id,
                package_no,
                item_name,
                inspection_date,
                created_by,
                author_email,
                created_at,
                pm_sign_user_id,
                projects ( id, name )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        allForms = data || [];
        renderGroupedList(searchInput ? searchInput.value : '');
    } catch (err) {
        console.error("대시보드 로드 오류:", err);
        projectListEl.innerHTML = `<div class="col-span-full text-center py-10 text-red-500 bg-red-50 rounded-lg border border-red-200">데이터를 불러오지 못했습니다: ${err.message}</div>`;
    }
}

// 설명: 프로젝트별로 확인서를 그룹화하여 렌더링
function renderGroupedList(searchQuery = '') {
    if (!projectListEl) return;
    projectListEl.innerHTML = '';
    
    const lowerQuery = searchQuery.trim().toLowerCase();
    const filtered = allForms.filter(f => {
        const pName = f.projects?.name || '';
        const pNo = f.package_no || '';
        const iName = f.item_name || '';
        const author = f.author_email || '';
        return pName.toLowerCase().includes(lowerQuery) || 
               pNo.toLowerCase().includes(lowerQuery) ||
               iName.toLowerCase().includes(lowerQuery) ||
               author.toLowerCase().includes(lowerQuery);
    });

    if (filtered.length === 0) {
        projectListEl.innerHTML = `
            <div class="col-span-full text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
                <i class="fas fa-folder-open text-4xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 text-sm font-medium">등록된 출하 검증 문서가 없습니다.</p>
                <p class="text-slate-400 text-xs mt-1">'새 문서 작성' 버튼을 눌러 첫 문서를 작성해 보세요.</p>
            </div>
        `;
        return;
    }

    // 프로젝트명 기준으로 그룹화 (Map 생성)
    const groupedMap = new Map();
    filtered.forEach(form => {
        const projectName = form.projects?.name || '미지정 프로젝트';
        if (!groupedMap.has(projectName)) {
            groupedMap.set(projectName, []);
        }
        groupedMap.get(projectName).push(form);
    });

    // 프로젝트 그룹별로 UI 카드 생성
    groupedMap.forEach((forms, projectName) => {
        const groupCard = document.createElement('div');
        groupCard.className = 'col-span-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-2';

        const totalCount = forms.length;
        const signedCount = forms.filter(f => !!f.pm_sign_user_id).length;

        // 프로젝트 헤더
        const headerEl = document.createElement('div');
        headerEl.className = 'bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center gap-3';
        headerEl.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                    <i class="fas fa-project-diagram"></i>
                </div>
                <div>
                    <h3 class="font-bold text-lg text-slate-900">${projectName}</h3>
                    <p class="text-xs text-slate-500 mt-0.5">
                        총 <span class="font-bold text-blue-600">${totalCount}</span>건의 확인서 등록됨 (최종 승인 완료: <span class="font-bold text-green-600">${signedCount}</span>건)
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${signedCount === totalCount ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
                    ${signedCount === totalCount ? '✓ 전체 출하 승인완료' : `진행 중 (${signedCount}/${totalCount})`}
                </span>
            </div>
        `;

        // 확인서 리스트 테이블
        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto';

        const tableEl = document.createElement('table');
        tableEl.className = 'w-full text-left text-sm';
        tableEl.innerHTML = `
            <thead class="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                    <th class="py-3 px-6">Package No.</th>
                    <th class="py-3 px-6">품목명 (Item)</th>
                    <th class="py-3 px-6">검사/출하일</th>
                    <th class="py-3 px-6">작성자</th>
                    <th class="py-3 px-6 text-center">승인 상태</th>
                    <th class="py-3 px-6 text-center">관리</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-800"></tbody>
        `;

        const tbody = tableEl.querySelector('tbody');

        forms.forEach(form => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-blue-50/40 transition-colors group';

            const isPmSigned = !!form.pm_sign_user_id;
            const dateStr = form.inspection_date ? form.inspection_date : '<span class="text-slate-400">미지정</span>';
            const authorStr = form.author_email ? form.author_email.split('@')[0] : '미지정';
            
            // 엄격한 권한 체크: 관리자(ADMIN)이거나 실제 작성자(created_by) 본인인 경우만 수정/삭제 허용
            const isAuthor = currentUserProfile && form.created_by && (form.created_by === currentUserProfile.id);
            const isAdmin = currentUserProfile && (currentUserProfile.role === 'ADMIN');
            const canManage = isAdmin || isAuthor;

            tr.innerHTML = `
                <td class="py-3.5 px-6 font-bold text-blue-700">
                    <i class="fas fa-box-open mr-1.5 text-blue-400"></i>${form.package_no || 'No Pkg'}
                </td>
                <td class="py-3.5 px-6 font-medium text-slate-800">${form.item_name || '품목명 없음'}</td>
                <td class="py-3.5 px-6 text-slate-600 text-xs">${dateStr}</td>
                <td class="py-3.5 px-6 text-slate-500 text-xs" title="${form.author_email || ''}">
                    <i class="fas fa-user-circle mr-1 text-slate-400"></i>${authorStr} ${isAuthor ? '<span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1">내 작성글</span>' : ''}
                </td>
                <td class="py-3.5 px-6 text-center">
                    <span class="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${isPmSigned ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">
                        ${isPmSigned ? '<i class="fas fa-check-circle mr-1"></i>승인완료' : '검증진행중'}
                    </span>
                </td>
                <td class="py-3.5 px-6 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button class="btn-open-form px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition shadow-sm" title="${canManage ? '수정 및 열람' : '조회 전용'}">
                            <i class="fas ${canManage ? 'fa-edit' : 'fa-eye'} mr-1"></i>${canManage ? '수정/열람' : '조회'}
                        </button>
                        ${canManage ? `
                            <button class="btn-delete-row px-2.5 py-1 text-red-500 hover:bg-red-50 hover:text-red-700 rounded text-xs font-semibold transition" title="확인서 삭제">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;

            // 조회/수정 버튼 클릭 이벤트
            const btnOpen = tr.querySelector('.btn-open-form');
            if (btnOpen) {
                btnOpen.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (onNewFormCallback) onNewFormCallback(form.id);
                });
            }

            // 행 자체 클릭 시에도 오픈
            tr.addEventListener('click', () => {
                if (onNewFormCallback) onNewFormCallback(form.id);
            });

            // 삭제 버튼 클릭 이벤트
            const btnDel = tr.querySelector('.btn-delete-row');
            if (btnDel) {
                btnDel.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await deleteFormFromDashboard(form.id, form.package_no || form.item_name || '확인서');
                });
            }

            tbody.appendChild(tr);
        });

        tableContainer.appendChild(tableEl);
        groupCard.appendChild(headerEl);
        groupCard.appendChild(tableContainer);
        projectListEl.appendChild(groupCard);
    });
}

// 설명: 대시보드 목록에서 즉시 삭제 처리
async function deleteFormFromDashboard(formId, itemName) {
    const targetForm = allForms.find(f => f.id === formId);
    const isAuthor = currentUserProfile && targetForm && targetForm.created_by && (targetForm.created_by === currentUserProfile.id);
    const isAdmin = currentUserProfile && (currentUserProfile.role === 'ADMIN');

    if (!isAdmin && !isAuthor) {
        alert('삭제 권한이 없습니다.\n관리자(ADMIN) 또는 본인이 작성한 확인서만 삭제할 수 있습니다.');
        return;
    }

    if (!confirm(`'${itemName}' 확인서를 정말로 삭제하시겠습니까?\n삭제된 문서는 복구할 수 없습니다.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('cross_check_forms')
            .delete()
            .eq('id', formId);

        if (error) throw error;

        alert('확인서가 성공적으로 삭제되었습니다.');
        loadDashboard(); // 목록 새로고침
    } catch (err) {
        console.error("삭제 실패:", err);
        alert("삭제 처리 중 오류가 발생했습니다: " + err.message);
    }
}
