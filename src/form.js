import { supabase } from './supabase.js';
import { currentUserProfile } from './app.js';

let backToDashCallback = null;

// 설명: 새 문서 작성 시 각 단계별로 기본 표시되는 체크리스트 항목 목록
const DEFAULT_CHECKLIST = {
    'step1-list': [
        '최신 리비전 도면 및 최신 BOM 적용 확인',
        '도면 상 요구 수량(Quantity) 산출 정확성',
        'Anchor, Support, Loose Part 누락 방지 점검',
    ],
    'step2-list': [
        '1단계 BOM 수량과 실제 발주(PO) 수량 일치',
        '발주 자재 사양(재질 등) 설계 요구조건 부합',
        '(부분납) 누적 입고 수량 및 잔여 수량 파악',
    ],
    'step3-list': [
        '발주/입고 수량과 Packing List 수량 최종 일치',
        '출하 전 실물 육안 대조 검사 (포장 전 상태)',
        '포장(Packing) 상태 및 육안상 파손 여부 확인',
    ],
};

// 설명: 폼 초기화 및 이벤트 리스너 등록
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

    const btnDelete = document.getElementById('btn-delete-form');
    if (btnDelete) {
        btnDelete.addEventListener('click', deleteCurrentForm);
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

    // 항목 추가 이벤트 리스너
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

    // 항목 삭제 (위임)
    const formView = document.getElementById('form-view');
    if (formView) {
        formView.addEventListener('click', (e) => {
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
}

// 설명: 특정 리스트에 체크리스트 항목 배열을 렌더링하는 헬퍼 함수
function renderChecklistItems(listId, items) {
    const ul = document.getElementById(listId);
    if (!ul) return;
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

// 설명: 현재 로그인한 사용자가 해당 문서를 수정/삭제할 수 있는지 검사
export function checkCanEdit(form) {
    if (!currentUserProfile) return false;
    // 관리자(ADMIN)는 모든 문서 수정/삭제 가능
    if (currentUserProfile.role === 'ADMIN') return true;
    // 신규 작성 문서(ID 없음)는 누구나 작성/수정 가능
    if (!form || !form.id) return true;
    // 본인이 작성한 문서인 경우
    if (form.created_by && form.created_by === currentUserProfile.id) return true;
    // 기존에 작성자 정보가 없는 문서의 경우
    if (!form.created_by) return true;
    return false;
}

// 설명: 읽기 전용 모드 또는 편집 모드로 폼 UI 전환
function setFormReadOnlyMode(isReadOnly) {
    const readonlyBadge = document.getElementById('form-readonly-badge');
    const btnSave = document.getElementById('btn-save');
    const btnDelete = document.getElementById('btn-delete-form');

    if (isReadOnly) {
        if (readonlyBadge) readonlyBadge.classList.remove('hidden');
        if (btnSave) btnSave.classList.add('hidden');
        if (btnDelete) btnDelete.classList.add('hidden');

        // 입력창 비활성화
        document.querySelectorAll('#form-view input').forEach(el => el.disabled = true);
        document.querySelectorAll('.btn-add, .btn-remove').forEach(el => el.classList.add('hidden'));
    } else {
        if (readonlyBadge) readonlyBadge.classList.add('hidden');
        if (btnSave) btnSave.classList.remove('hidden');

        const formId = document.getElementById('current_form_id').value;
        if (btnDelete) {
            if (formId) btnDelete.classList.remove('hidden');
            else btnDelete.classList.add('hidden');
        }

        // 입력창 활성화
        document.querySelectorAll('#form-view input').forEach(el => el.disabled = false);
        document.querySelectorAll('.btn-add').forEach(el => el.classList.remove('hidden'));
    }
}

// 빈 폼으로 초기화 (신규 작성)
export function clearFormContent() {
    document.getElementById('current_form_id').value = '';
    document.getElementById('current_project_id').value = '';
    
    document.getElementById('project_name').value = '';
    document.getElementById('package_no').value = '';
    document.getElementById('item_name').value = '';
    document.getElementById('inspection_date').value = '';

    const authorInfoEl = document.getElementById('form-author-info');
    if (authorInfoEl) authorInfoEl.textContent = '';

    // 기존 리스트 초기화 후 기본 업무 항목 삽입
    ['step1-list', 'step2-list', 'step3-list'].forEach(id => {
        const ul = document.getElementById(id);
        if (ul) ul.innerHTML = '';
        if (DEFAULT_CHECKLIST[id]) {
            renderChecklistItems(id, DEFAULT_CHECKLIST[id]);
        }
    });
    
    ['step1_doc_no', 'step1_doc_rev', 'step2_doc_no', 'step3_doc_no'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    ['step2_evidence', 'step3_evidence'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    document.querySelectorAll('.ev-chk').forEach(c => c.checked = false);
    
    if (document.getElementById('ev_other_chk')) document.getElementById('ev_other_chk').checked = false;
    if (document.getElementById('ev_other_text')) document.getElementById('ev_other_text').value = '';

    // 서명란 초기화
    resetSignUI('sign1-status', 'btn-sign1');
    resetSignUI('sign2-status', 'btn-sign2');
    resetSignUI('sign3-status', 'btn-sign3');
    resetSignUI('sign-pm-status', 'btn-sign-pm');

    // 편집 모드로 설정
    setFormReadOnlyMode(false);
}

function resetSignUI(statusId, btnId) {
    const stEl = document.getElementById(statusId);
    const btEl = document.getElementById(btnId);
    if (stEl) {
        stEl.innerHTML = '<span class="text-slate-400">대기 중</span>';
        stEl.className = 'text-xs text-slate-400';
    }
    if (btEl) btEl.classList.remove('hidden');
}

function setSignUI(statusId, btnId, isSigned, signerName = '', signedAt = null) {
    const stEl = document.getElementById(statusId);
    const btEl = document.getElementById(btnId);
    if (isSigned) {
        const dateStr = signedAt ? new Date(signedAt).toLocaleDateString() : '';
        const nameText = signerName ? signerName : '서명 완료';
        if (stEl) {
            stEl.innerHTML = `
                <div class="font-bold text-slate-900 text-sm tracking-wider">${nameText}</div>
                <div class="text-[10px] text-blue-600 font-semibold mt-0.5">✓ 서명완료 ${dateStr ? `(${dateStr})` : ''}</div>
            `;
            stEl.className = 'text-center py-1';
        }
        if (btEl) btEl.classList.add('hidden');
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

        // 작성자 정보 표시
        const authorInfoEl = document.getElementById('form-author-info');
        if (authorInfoEl) {
            const authorName = form.author_email || '미지정';
            const createdDate = new Date(form.created_at).toLocaleDateString();
            authorInfoEl.innerHTML = `<i class="fas fa-user-edit mr-1"></i>작성자: <span class="text-slate-600 font-semibold">${authorName}</span> (${createdDate})`;
        }

        // 서명 데이터 바인딩
        setSignUI('sign-pm-status', 'btn-sign-pm', !!form.pm_sign_user_id, form.pm_signer_name, form.pm_signed_at);

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

                // 서명 바인딩 (서명자 성명 및 일시 전달)
                setSignUI(`sign${sNum}-status`, `btn-sign${sNum}`, !!step.manager_sign_user_id, step.manager_signer_name, step.manager_signed_at);

                // 체크리스트 바인딩
                if (step.step_checklist_items && step.step_checklist_items.length > 0) {
                    const ul = document.getElementById(`step${sNum}-list`);
                    if (ul) {
                        ul.innerHTML = '';
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

        // 권한 검사: 관리자이거나 본인 작성글이 아니면 읽기 전용
        const canEdit = checkCanEdit(form);
        setFormReadOnlyMode(!canEdit);

    } catch (err) {
        console.error("데이터 로드 오류:", err);
        alert("데이터 로드 중 오류가 발생했습니다: " + err.message);
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

    const projectName = document.getElementById('project_name').value.trim();
    if (!projectName) {
        alert("프로젝트명을 입력해 주세요.");
        return;
    }

    let formId = document.getElementById('current_form_id').value;
    let projectId = document.getElementById('current_project_id').value;

    try {
        // 1. Project 처리 (동일 프로젝트명이 있으면 재사용, 없으면 생성)
        if (!projectId) {
            // 먼저 동일한 이름의 프로젝트가 있는지 확인
            const { data: existingProjects } = await supabase
                .from('projects')
                .select('id, name')
                .eq('name', projectName)
                .limit(1);

            if (existingProjects && existingProjects.length > 0) {
                projectId = existingProjects[0].id;
            } else {
                const { data: newProj, error: projErr } = await supabase
                    .from('projects')
                    .insert([{ name: projectName }])
                    .select().single();
                if (projErr) throw projErr;
                projectId = newProj.id;
            }
            document.getElementById('current_project_id').value = projectId;
        } else {
            await supabase.from('projects').update({ name: projectName }).eq('id', projectId);
        }

        // 2. Form 처리
        const formData = {
            project_id: projectId,
            package_no: document.getElementById('package_no').value.trim(),
            item_name: document.getElementById('item_name').value.trim(),
            inspection_date: document.getElementById('inspection_date').value || null
        };

        if (!formId) {
            // 신규 작성 시 작성자 정보 추가
            formData.created_by = user.id;
            formData.author_email = user.email;

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
// 폼 데이터 삭제 (DELETE)
// ---------------------------------------------------
async function deleteCurrentForm() {
    const formId = document.getElementById('current_form_id').value;
    if (!formId) return;

    if (!confirm('정말로 이 출하 확인서 문서를 삭제하시겠습니까?\n삭제된 데이터는 영구적으로 복구할 수 없습니다.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('cross_check_forms')
            .delete()
            .eq('id', formId);

        if (error) throw error;

        alert('확인서가 성공적으로 삭제되었습니다.');
        if (backToDashCallback) backToDashCallback();

    } catch (err) {
        console.error("문서 삭제 오류:", err);
        alert("문서 삭제 중 오류가 발생했습니다: " + err.message);
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
        alert("먼저 폼을 '저장'한 뒤에 서명을 진행해 주세요.");
        return;
    }

    // 단계별 명칭 안내
    const stepTitleMap = {
        'btn-sign1': '1단계 (설계 담당자)',
        'btn-sign2': '2단계 (구매 담당자)',
        'btn-sign3': '3단계 (물류 담당자)',
        'btn-sign-pm': '최종 출하 승인 (PM / 부서장)'
    };
    const stepTitle = stepTitleMap[btnId] || '서명';

    // 서명할 이름 또는 이니셜 입력 받기
    const defaultSignerName = (currentUserProfile && currentUserProfile.email) 
        ? currentUserProfile.email.split('@')[0] 
        : '';
    const signerInput = prompt(`[${stepTitle}] 서명을 진행합니다.\n서명란에 기재할 성명 또는 이니셜을 입력하세요:`, defaultSignerName);

    if (signerInput === null) {
        // 취소 누름
        return;
    }

    const signerName = signerInput.trim() || defaultSignerName || '서명자';
    const nowIso = new Date().toISOString();

    try {
        if (btnId === 'btn-sign-pm') {
            await supabase.from('cross_check_forms').update({ 
                pm_sign_user_id: user.id,
                pm_signer_name: signerName,
                pm_signed_at: nowIso
            }).eq('id', formId);

            setSignUI('sign-pm-status', 'btn-sign-pm', true, signerName, nowIso);
        } else {
            const stepMap = { 'btn-sign1': 1, 'btn-sign2': 2, 'btn-sign3': 3 };
            const stepNum = stepMap[btnId];
            
            await supabase.from('form_steps')
                .update({ 
                    manager_sign_user_id: user.id,
                    manager_signer_name: signerName,
                    manager_signed_at: nowIso
                })
                .eq('form_id', formId)
                .eq('step_number', stepNum);
                
            setSignUI(`sign${stepNum}-status`, btnId, true, signerName, nowIso);
        }
        alert(`'${signerName}' 님의 서명이 성공적으로 등록되었습니다.`);
    } catch (err) {
        console.error("서명 오류:", err);
        alert("서명 처리 중 오류가 발생했습니다: " + err.message);
    }
}
