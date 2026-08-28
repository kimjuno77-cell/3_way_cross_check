import { supabase } from './supabase.js';

let backToDashCallback = null;

export function setupForm(backCb) {
    backToDashCallback = backCb;

    const btnBack = document.getElementById('btn-back-dashboard');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (backToDashCallback) backToDashCallback();
        });
    }

    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', saveFormData);
    }
    
    // 서명 버튼들
    const signBtns = ['btn-sign1', 'btn-sign2', 'btn-sign3', 'btn-sign-pm'];
    signBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                await handleSignOff(id);
            });
        }
    });

    // 기존의 항목 추가 이벤트 리스너 (위임)
    document.querySelectorAll('.btn-add').forEach(btn => {
        // 기존 리스너가 중복되지 않도록 주의해야하지만 현재 아키텍처상 1회 실행됨
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

    // 항목 삭제 (위임)
    document.getElementById('form-view').addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove');
        if (removeBtn) {
            const li = removeBtn.closest('li');
            if (li) {
                li.style.opacity = '0';
                setTimeout(() => li.remove(), 200);
            }
        }
    });
}

// 설명: 새 문서 작성 시 각 단계별로 기본 표시되는 체크리스트 항목 목록
const DEFAULT_CHECKLIST = {
    'step1-list': [
        'BOM 수량과 설계 도면 수량 일치 여부 확인',
        '자재 규격(Spec) 도면 대비 일치 여부 확인',
        '최신 Rev. 도면 적용 여부 확인',
    ],
    'step2-list': [
        '발주서(PO) 품목 및 수량과 BOM 일치 여부 확인',
        '납품된 자재의 입고 검수 완료 여부 확인',
        '발주 잔량 또는 미납 품목 유무 확인',
    ],
    'step3-list': [
        'Packing List 품목/수량과 실물 일치 여부 확인',
        '포장 상태 및 라벨링 적정성 확인',
        '출하 전 외관 검사(파손/오염) 완료 여부 확인',
    ],
};

// 설명: 특정 리스트에 체크리스트 항목 배열을 렌더링하는 헬퍼 함수
function renderChecklistItems(listId, items) {
    const ul = document.getElementById(listId);
    items.forEach(text => {
        const li = document.createElement('li');
        li.className = "flex items-start group relative mb-2";
        li.innerHTML = `
            <input type="checkbox" class="e-checkbox mr-2">
            <input type="text" value="${text}" class="list-input flex-1">
            <button type="button" class="btn-remove no-print opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 py-1 px-2 rounded hover:bg-red-50 transition-all" title="항목 삭제">
                <i class="fas fa-times"></i>
            </button>
        `;
        ul.appendChild(li);
    });
}

// 빈 폼으로 초기화
export function clearFormContent() {
    document.getElementById('current_form_id').value = '';
    document.getElementById('current_project_id').value = '';
    
    document.getElementById('project_name').value = '';
    document.getElementById('package_no').value = '';
    document.getElementById('item_name').value = '';
    document.getElementById('inspection_date').value = '';

    // 설명: 기존 리스트 초기화 후 기본 항목 삽입
    ['step1-list', 'step2-list', 'step3-list'].forEach(id => {
        document.getElementById(id).innerHTML = '';
        if (DEFAULT_CHECKLIST[id]) {
            renderChecklistItems(id, DEFAULT_CHECKLIST[id]);
        }
    });
    
    ['step1_doc_no', 'step1_doc_rev', 'step2_doc_no', 'step3_doc_no'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = '';
    });

    ['step2_evidence', 'step3_evidence'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).checked = false;
    });

    document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    document.querySelectorAll('.ev-chk').forEach(c => c.checked = false);
    
    if(document.getElementById('ev_other_chk')) document.getElementById('ev_other_chk').checked = false;
    if(document.getElementById('ev_other_text')) document.getElementById('ev_other_text').value = '';

    // 서명란 초기화
    resetSignUI('sign1-status', 'btn-sign1');
    resetSignUI('sign2-status', 'btn-sign2');
    resetSignUI('sign3-status', 'btn-sign3');
    resetSignUI('sign-pm-status', 'btn-sign-pm');
}

function resetSignUI(statusId, btnId) {
    document.getElementById(statusId).textContent = '대기 중';
    document.getElementById(statusId).className = 'text-xs text-slate-400';
    document.getElementById(btnId).classList.remove('hidden');
}
function setSignUI(statusId, btnId, isSigned) {
    if (isSigned) {
        document.getElementById(statusId).textContent = '서명 완료';
        document.getElementById(statusId).className = 'text-xs font-bold text-blue-600';
        document.getElementById(btnId).classList.add('hidden');
    } else {
        resetSignUI(statusId, btnId);
    }
}

// ---------------------------------------------------
// 폼 데이터 로드 (READ)
// ---------------------------------------------------
export async function loadFormContent(formId) {
    clearFormContent();
    document.getElementById('current_form_id').value = formId;

    try {
        const { data: form, error } = await supabase
            .from('cross_check_forms')
            .select(`
                *,
                projects ( name ),
                form_steps (
                    *,
                    step_checklist_items (*)
                ),
                form_evidences (*)
            `)
            .eq('id', formId)
            .single();

        if (error) throw error;

        document.getElementById('current_project_id').value = form.project_id;
        document.getElementById('project_name').value = form.projects?.name || '';
        document.getElementById('package_no').value = form.package_no || '';
        document.getElementById('item_name').value = form.item_name || '';
        document.getElementById('inspection_date').value = form.inspection_date || '';

        setSignUI('sign-pm-status', 'btn-sign-pm', !!form.pm_sign_user_id);

        if (form.form_steps) {
            form.form_steps.forEach(step => {
                const sNum = step.step_number;
                
                // 기본 필드 바인딩
                if (sNum === 1) {
                    document.getElementById('step1_doc_no').value = step.document_no || '';
                    document.getElementById('step1_doc_rev').value = step.document_rev || '';
                } else if (sNum === 2) {
                    document.getElementById('step2_doc_no').value = step.document_no || '';
                    document.getElementById('step2_evidence').checked = step.evidence_secured;
                } else if (sNum === 3) {
                    document.getElementById('step3_doc_no').value = step.document_no || '';
                    document.getElementById('step3_evidence').checked = step.evidence_secured;
                }

                // 결과 바인딩
                if (step.result_status && step.result_status !== 'PENDING') {
                    const radio = document.querySelector(`input[name="res${sNum}"][value="${step.result_status}"]`);
                    if (radio) radio.checked = true;
                }

                // 서명 바인딩
                setSignUI(`sign${sNum}-status`, `btn-sign${sNum}`, !!step.manager_sign_user_id);

                // 체크리스트 바인딩
                if (step.step_checklist_items && step.step_checklist_items.length > 0) {
                    const ul = document.getElementById(`step${sNum}-list`);
                    // sort by sort_order
                    step.step_checklist_items.sort((a,b) => a.sort_order - b.sort_order).forEach(chk => {
                        const li = document.createElement('li');
                        li.className = "flex items-start group relative mb-2";
                        li.innerHTML = `
                            <input type="checkbox" class="e-checkbox mr-2" ${chk.is_checked ? 'checked' : ''}>
                            <input type="text" value="${chk.content || ''}" class="list-input flex-1">
                            <button type="button" class="btn-remove no-print opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 py-1 px-2 rounded hover:bg-red-50 transition-all" title="항목 삭제">
                                <i class="fas fa-times"></i>
                            </button>
                        `;
                        ul.appendChild(li);
                    });
                }
            });
        }

        if (form.form_evidences) {
            form.form_evidences.forEach(ev => {
                if (ev.is_other) {
                    const otherChk = document.getElementById('ev_other_chk');
                    const otherTxt = document.getElementById('ev_other_text');
                    if (otherChk) otherChk.checked = ev.is_checked;
                    if (otherTxt) otherTxt.value = ev.other_description || '';
                } else {
                    const chk = document.querySelector(`.ev-chk[value="${ev.evidence_name}"]`);
                    if (chk) chk.checked = ev.is_checked;
                }
            });
        }
    } catch (err) {
        console.error("데이터 로드 오류:", err);
        alert("데이터 로드 중 오류가 발생했습니다.");
    }
}


// ---------------------------------------------------
// 폼 데이터 저장 (INSERT/UPSERT)
// ---------------------------------------------------
async function saveFormData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("로그인이 필요합니다.");
        return;
    }

    const projectName = document.getElementById('project_name').value;
    if (!projectName) {
        alert("프로젝트명을 입력해 주세요.");
        return;
    }

    let formId = document.getElementById('current_form_id').value;
    let projectId = document.getElementById('current_project_id').value;

    try {
        // 1. Project 처리 (없으면 생성, 있으면 패스)
        if (!projectId) {
            const { data: proj, error: projErr } = await supabase
                .from('projects')
                .insert([{ name: projectName }])
                .select().single();
            if (projErr) throw projErr;
            projectId = proj.id;
            document.getElementById('current_project_id').value = projectId;
        } else {
            // 이름이 변경되었을 수 있으므로 업데이트
            await supabase.from('projects').update({ name: projectName }).eq('id', projectId);
        }

        // 2. Form 처리
        const formData = {
            project_id: projectId,
            package_no: document.getElementById('package_no').value,
            item_name: document.getElementById('item_name').value,
            inspection_date: document.getElementById('inspection_date').value || null
        };

        if (!formId) {
            // 새 폼 Insert
            const { data: form, error: formErr } = await supabase
                .from('cross_check_forms')
                .insert([formData])
                .select().single();
            if (formErr) throw formErr;
            formId = form.id;
            document.getElementById('current_form_id').value = formId;
        } else {
            // 기존 폼 Update
            const { error: formErr } = await supabase
                .from('cross_check_forms')
                .update(formData)
                .eq('id', formId);
            if (formErr) throw formErr;
        }

        // 3. Step & Checklists 처리
        // 기존 로직을 덮어쓰기 위해 해당 form_id의 데이터 삭제 후 재생성 (간단한 Upsert 전략)
        await supabase.from('form_steps').delete().eq('form_id', formId);
        
        await saveStepData(1, formId, 'step1_doc_no', 'step1_doc_rev', null, 'res1', 'step1-list');
        await saveStepData(2, formId, 'step2_doc_no', null, 'step2_evidence', 'res2', 'step2-list');
        await saveStepData(3, formId, 'step3_doc_no', null, 'step3_evidence', 'res3', 'step3-list');

        // 4. Form Evidences 처리
        await supabase.from('form_evidences').delete().eq('form_id', formId);
        
        const evidenceElements = document.querySelectorAll('.ev-chk');
        const evidenceInserts = Array.from(evidenceElements).map(el => ({
            form_id: formId,
            evidence_name: el.value,
            is_checked: el.checked,
            is_other: false
        }));

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
        if (backToDashCallback) backToDashCallback();

    } catch (err) {
        console.error("저장 오류:", err);
        alert("데이터 저장 중 오류가 발생했습니다: " + err.message);
    }
}

async function saveStepData(stepNum, formId, docNoId, docRevId, evidenceId, radioName, listId) {
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
            result_status: resStatus
        }])
        .select()
        .single();
        
    if (stepErr) throw stepErr;
    
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

// ---------------------------------------------------
// 서명하기 (Sign-off) 핸들러
// ---------------------------------------------------
async function handleSignOff(btnId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("로그인이 필요합니다.");
        return;
    }
    const formId = document.getElementById('current_form_id').value;
    if (!formId) {
        alert("먼저 폼을 'DB 저장'한 뒤에 서명을 진행해 주세요.");
        return;
    }

    try {
        if (btnId === 'btn-sign-pm') {
            await supabase.from('cross_check_forms').update({ pm_sign_user_id: user.id }).eq('id', formId);
            setSignUI('sign-pm-status', 'btn-sign-pm', true);
        } else {
            const stepMap = { 'btn-sign1': 1, 'btn-sign2': 2, 'btn-sign3': 3 };
            const stepNum = stepMap[btnId];
            
            // update form_steps
            await supabase.from('form_steps')
                .update({ manager_sign_user_id: user.id })
                .eq('form_id', formId)
                .eq('step_number', stepNum);
                
            setSignUI(`sign${stepNum}-status`, btnId, true);
        }
        alert("서명이 완료되었습니다.");
    } catch (err) {
        console.error("서명 오류:", err);
        alert("서명 처리 중 오류가 발생했습니다.");
    }
}
