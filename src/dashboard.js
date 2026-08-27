import { supabase } from './supabase.js';

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
            renderList(e.target.value);
        });
    }
}

export async function loadDashboard() {
    projectListEl.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500">데이터를 불러오는 중...</div>';
    
    try {
        // cross_check_forms 와 연결된 projects 정보를 가져옵니다.
        const { data, error } = await supabase
            .from('cross_check_forms')
            .select(`
                id,
                package_no,
                item_name,
                inspection_date,
                created_at,
                projects ( name )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        allForms = data || [];
        renderList();
    } catch (err) {
        console.error(err);
        projectListEl.innerHTML = `<div class="col-span-full text-center py-10 text-red-500">데이터를 불러오지 못했습니다: ${err.message}</div>`;
    }
}

function renderList(searchQuery = '') {
    projectListEl.innerHTML = '';
    
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = allForms.filter(f => {
        const pName = f.projects?.name || '';
        const pNo = f.package_no || '';
        return pName.toLowerCase().includes(lowerQuery) || pNo.toLowerCase().includes(lowerQuery);
    });

    if (filtered.length === 0) {
        projectListEl.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500">검색 결과가 없습니다.</div>';
        return;
    }

    filtered.forEach(form => {
        const card = document.createElement('div');
        card.className = 'bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col gap-2';
        
        const dateStr = form.inspection_date ? form.inspection_date : '미정';
        const pName = form.projects?.name || '알 수 없음';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">${form.package_no || 'No Pkg'}</span>
                <span class="text-xs text-slate-400">${new Date(form.created_at).toLocaleDateString()}</span>
            </div>
            <h3 class="font-bold text-lg text-slate-800 mt-2 truncate" title="${pName}">${pName}</h3>
            <p class="text-sm text-slate-600 truncate"><i class="fas fa-box text-slate-400 mr-1"></i> ${form.item_name || '품목명 없음'}</p>
            <p class="text-sm text-slate-600"><i class="fas fa-calendar-alt text-slate-400 mr-1"></i> 검사/출하: ${dateStr}</p>
        `;

        // 카드 클릭 시 폼 뷰로 이동 (form_id 전달)
        card.addEventListener('click', () => {
            if (onNewFormCallback) onNewFormCallback(form.id);
        });

        projectListEl.appendChild(card);
    });
}
