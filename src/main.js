import { createClient } from '@supabase/supabase-js';

// Supabase 초기화
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 클라이언트 생성 (URL/KEY가 설정되지 않았을 때를 위한 예외 처리 포함)
let supabase;
if (supabaseUrl && supabaseKey && supabaseUrl !== "https://your-project-url.supabase.co") {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn("Supabase 환경 변수가 설정되지 않았습니다. .env 파일을 확인해 주세요.");
}

// -----------------------------------------
// UI 이벤트 리스너 설정 (동적 항목 추가/삭제)
// -----------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 항목 삭제 (이벤트 위임)
    document.body.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove');
        if (removeBtn) {
            const li = removeBtn.closest('li');
            if (li) {
                li.style.opacity = '0';
                setTimeout(() => li.remove(), 200);
            }
        }
    });

    // 항목 추가
    document.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', () => {
            const listId = btn.getAttribute('data-list');
            const ul = document.getElementById(listId);
            const li = document.createElement('li');
            li.className = "flex items-start group relative mb-2 opacity-0 transition-opacity duration-300";
            li.innerHTML = `
                <input type="checkbox" class="e-checkbox mr-2">
                <input type="text" placeholder="새로운 체크 항목을 입력하세요" class="list-input flex-1">
                <button type="button" class="btn-remove no-print opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 py-1 px-2 rounded hover:bg-red-50 transition-all" title="항목 삭제">
                    <i class="fas fa-times"></i>
                </button>
            `;
            ul.appendChild(li);
            setTimeout(() => li.classList.remove('opacity-0'), 10);
            li.querySelector('input[type="text"]').focus();
        });
    });

    // 저장 버튼 클릭 이벤트
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', saveFormData);
    }
});

// -----------------------------------------
// 데이터베이스 저장 로직 (Supabase Insert)
// -----------------------------------------
async function saveFormData() {
    if (!supabase) {
        alert("Supabase가 초기화되지 않았습니다. .env에 URL과 KEY를 기입 후 다시 시도해 주세요.");
        return;
    }

    try {
        const projectName = document.getElementById('project_name').value;
        if (!projectName) {
            alert("프로젝트명을 입력해 주세요.");
            return;
        }

        // 임시로 user_id 처리 (테스트용)
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user ? user.id : null; 
        // 실제 운영 시 user가 null일 경우 에러 처리 필요
        
        console.log("저장 시작...");
        
        // 1. Projects 테이블 저장
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .insert([{ name: projectName }])
            .select()
            .single();
            
        if (projErr) throw projErr;
        const projectId = project.id;

        // 2. Forms 테이블 저장
        const { data: form, error: formErr } = await supabase
            .from('cross_check_forms')
            .insert([{
                project_id: projectId,
                package_no: document.getElementById('package_no').value,
                item_name: document.getElementById('item_name').value,
                inspection_date: document.getElementById('inspection_date').value || null,
                pm_sign_user_id: userId // 테스트/시연용으로 현재 세션 유저 사용 (없으면 null)
            }])
            .select()
            .single();
            
        if (formErr) throw formErr;
        const formId = form.id;

        // 3. Step & Checklists 저장
        await saveStep(1, formId, userId, 'step1_doc_no', 'step1_doc_rev', null, 'res1', 'step1-list');
        await saveStep(2, formId, userId, 'step2_doc_no', null, 'step2_evidence', 'res2', 'step2-list');
        await saveStep(3, formId, userId, 'step3_doc_no', null, 'step3_evidence', 'res3', 'step3-list');

        // 4. Form Evidences 저장
        const evidenceElements = document.querySelectorAll('.ev-chk');
        const evidenceInserts = Array.from(evidenceElements).map(el => ({
            form_id: formId,
            evidence_name: el.value,
            is_checked: el.checked,
            is_other: false
        }));

        // 기타 체크박스 처리
        const evOtherChk = document.getElementById('ev_other_chk');
        if (evOtherChk) {
            evidenceInserts.push({
                form_id: formId,
                evidence_name: '기타',
                is_checked: evOtherChk.checked,
                is_other: true,
                other_description: document.getElementById('ev_other_text').value
            });
        }

        const { error: evErr } = await supabase.from('form_evidences').insert(evidenceInserts);
        if (evErr) throw evErr;

        alert("데이터가 성공적으로 저장되었습니다!");
        
    } catch (error) {
        console.error("데이터 저장 오류:", error);
        alert("데이터 저장 중 오류가 발생했습니다: " + error.message);
    }
}

// 개별 Step 및 하위 Checklist 저장 헬퍼 함수
async function saveStep(stepNum, formId, userId, docNoId, docRevId, evidenceId, radioName, listId) {
    const docNo = document.getElementById(docNoId)?.value || null;
    const docRev = docRevId ? (document.getElementById(docRevId)?.value || null) : null;
    const evSecured = evidenceId ? document.getElementById(evidenceId)?.checked : false;
    
    const radioSelected = document.querySelector(`input[name="${radioName}"]:checked`);
    const resStatus = radioSelected ? radioSelected.value : 'PENDING';

    const { data: step, error: stepErr } = await supabase
        .from('form_steps')
        .insert([{
            form_id: formId,
            step_number: stepNum,
            document_no: docNo,
            document_rev: docRev,
            evidence_secured: evSecured,
            result_status: resStatus,
            manager_sign_user_id: userId
        }])
        .select()
        .single();
        
    if (stepErr) throw stepErr;
    
    // 체크리스트 저장
    const listItems = document.querySelectorAll(`#${listId} li`);
    const chkInserts = Array.from(listItems).map((li, index) => {
        const checkbox = li.querySelector('input[type="checkbox"]');
        const textInput = li.querySelector('input[type="text"]');
        return {
            step_id: step.id,
            content: textInput ? textInput.value : '',
            is_checked: checkbox ? checkbox.checked : false,
            sort_order: index
        };
    });

    if (chkInserts.length > 0) {
        const { error: chkErr } = await supabase.from('step_checklist_items').insert(chkInserts);
        if (chkErr) throw chkErr;
    }
}
