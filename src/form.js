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
    
    // 설명: 1~3단계 및 PM 서명 버튼 이벤트 리스너 등록
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

    // 설명: 세부 체크리스트 항목 동적 추가 버튼 리스너
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

    // 설명: 체크리스트 항목 삭제 및 서명 취소 이벤트 위임 처리
    const formView = document.getElementById('form-view');
    if (formView) {
        formView.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.btn-remove');
            if (removeBtn) {
                const li = removeBtn.closest('li');
                if (li) {
                    li.style.opacity = '0';
                    setTimeout(() => li.remove(), 200);
                }
            }

            const cancelSignBtn = e.target.closest('.btn-cancel-sign');
            if (cancelSignBtn) {
                e.preventDefault();
                const targetBtnId = cancelSignBtn.getAttribute('data-btn-id');
                const targetStatusId = cancelSignBtn.getAttribute('data-status-id');
                if (targetBtnId && targetStatusId) {
                    await handleCancelSign(targetBtnId, targetStatusId);
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

// 설명: 현재 로그인한 사용자가 해당 문서를 수정(편집)할 수 있는지 검사
// [방안 2]: 1단계(설계), 2단계(구매), 3단계(물류) 작성자가 서로 다른 다자간 협업을 위해
// 로그인한 인증 사용자라면 누구나 확인서를 수정하고 서명할 수 있도록 허용합니다.
export function checkCanEdit(form) {
    if (!currentUserProfile) return false;
    // 설명: 로그인한 모든 팀원은 문서를 열어 자신의 단계 내용을 기재하고 저장할 수 있습니다.
    return true;
}

// 설명: 현재 로그인한 사용자가 해당 문서를 영구 삭제할 수 있는지 검사
// [방안 2]: 데이터 무결성 및 실수 방지를 위해 삭제는 '관리자(ADMIN)' 또는 '최초 작성자(created_by)'만 가능하도록 안전하게 제한합니다.
export function checkCanDelete(form) {
    if (!currentUserProfile) return false;
    // 관리자는 모든 문서 삭제 가능
    if (currentUserProfile.role === 'ADMIN') return true;
    // 신규 작성 폼은 삭제할 데이터베이스 행이 없음
    if (!form || !form.id) return false;
    // 최초 작성자 본인만 삭제 가능
    if (form.created_by && form.created_by === currentUserProfile.id) return true;
    return false;
}

// 설명: 읽기 전용 모드 또는 편집 모드로 폼 UI 전환
function setFormReadOnlyMode(isReadOnly, canDelete = false) {
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
            // 설명: 문서가 이미 저장되어 있고, 삭제 권한(관리자 또는 최초 작성자)이 있는 경우에만 삭제 버튼 노출
            if (formId && canDelete) {
                btnDelete.classList.remove('hidden');
            } else {
                btnDelete.classList.add('hidden');
            }
        }

        // 입력창 활성화
        document.querySelectorAll('#form-view input').forEach(el => el.disabled = false);
        document.querySelectorAll('.btn-add').forEach(el => el.classList.remove('hidden'));
    }
}

// 설명: 빈 폼으로 초기화 (신규 작성 시 호출)
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

    // 편집 모드로 설정 (신규 폼은 아직 생성 전이므로 삭제 버튼은 숨김)
    setFormReadOnlyMode(false, false);
}

// 설명: 서명 영역 UI를 기본 대기 상태로 초기화
function resetSignUI(statusId, btnId) {
    const stEl = document.getElementById(statusId);
    const btEl = document.getElementById(btnId);
    if (stEl) {
        stEl.innerHTML = '<span class="text-slate-400">대기 중</span>';
        stEl.className = 'text-xs text-slate-400';
    }
    if (btEl) btEl.classList.remove('hidden');
}

// 설명: 서명 완료 상태 UI 렌더링 및 서명 취소 버튼 노출 제어
function setSignUI(statusId, btnId, isSigned, signerName = '', signedAt = null, signerUserId = null) {
    const stEl = document.getElementById(statusId);
    const btEl = document.getElementById(btnId);
    if (isSigned) {
        const dateStr = signedAt ? new Date(signedAt).toLocaleDateString() : '';
        const nameText = signerName ? signerName : '서명 완료';

        // 설명: 서명 취소 권한 검증: 관리자(ADMIN)이거나 실제 서명한 사용자 본인
        const isSigner = currentUserProfile && signerUserId && (signerUserId === currentUserProfile.id);
        const isAdmin = currentUserProfile && (currentUserProfile.role === 'ADMIN');
        const canCancel = isAdmin || isSigner;

        if (stEl) {
            stEl.innerHTML = `
                <div class="font-bold text-slate-900 text-sm tracking-wider">${nameText}</div>
                <div class="text-[10px] text-blue-600 font-semibold mt-0.5">✓ 서명완료 ${dateStr ? `(${dateStr})` : ''}</div>
                ${canCancel ? `
                    <button type="button" class="btn-cancel-sign no-print text-[11px] text-red-500 hover:text-red-700 hover:underline mt-1 block mx-auto cursor-pointer font-medium" data-btn-id="${btnId}" data-status-id="${statusId}">
                        <i class="fas fa-undo-alt mr-0.5"></i>서명 취소
                    </button>
                ` : ''}
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

        // 설명: 최초 작성자 정보 표시
        const authorInfoEl = document.getElementById('form-author-info');
        if (authorInfoEl) {
            const authorName = form.author_email || '미지정';
            const createdDate = new Date(form.created_at).toLocaleDateString();
            authorInfoEl.innerHTML = `<i class="fas fa-user-edit mr-1"></i>최초 작성자: <span class="text-slate-600 font-semibold">${authorName}</span> (${createdDate})`;
        }

        // 설명: PM 최종 서명 데이터 바인딩
        setSignUI('sign-pm-status', 'btn-sign-pm', !!form.pm_sign_user_id, form.pm_signer_name, form.pm_signed_at, form.pm_sign_user_id);

        // 설명: 1~3단계 상세 데이터 및 서명 바인딩
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

                // 결과 라디오 버튼 바인딩
                if (step.result_status && step.result_status !== 'PENDING') {
                    const radio = document.querySelector(`input[name="res${sNum}"][value="${step.result_status}"]`);
                    if (radio) radio.checked = true;
                }

                // 각 단계 서명 바인딩
                setSignUI(`sign${sNum}-status`, `btn-sign${sNum}`, !!step.manager_sign_user_id, step.manager_signer_name, step.manager_signed_at, step.manager_sign_user_id);

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

        // 설명: 증빙 항목 바인딩
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

        // 설명: 권한 검사 - 수정 권한은 모든 팀원에게 허용, 삭제 권한은 관리자 또는 최초 작성자에게만 허용
        const canEdit = checkCanEdit(form);
        const canDelete = checkCanDelete(form);
        setFormReadOnlyMode(!canEdit, canDelete);

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
        // 1. Project 처리 (동일 프로젝트명이 있으면 재사용, 없으면 신규 생성)
        if (!projectId) {
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

        // 2. 동일 프로젝트 내 Package No. 중복 검증
        const packageNo = document.getElementById('package_no').value.trim();
        const itemName = document.getElementById('item_name').value.trim();

        if (packageNo) {
            let dupQuery = supabase
                .from('cross_check_forms')
                .select('id, package_no')
                .eq('project_id', projectId)
                .eq('package_no', packageNo);

            // 설명: 기존 문서를 수정하는 경우 자기 자신(현재 formId)은 중복 검사에서 제외
            if (formId) {
                dupQuery = dupQuery.neq('id', formId);
            }

            const { data: duplicateForms, error: dupErr } = await dupQuery;
            if (dupErr) throw dupErr;

            if (duplicateForms && duplicateForms.length > 0) {
                alert(`⚠️ [Package No. 중복 경고]\n\n해당 프로젝트('${projectName}')에 이미 동일한 Package No.('${packageNo}')가 등록되어 있습니다.\n\n동일한 번호로는 중복 등록할 수 없으니 다른 Package No.를 입력해 주세요.`);
                const pkgInput = document.getElementById('package_no');
                if (pkgInput) {
                    pkgInput.focus();
                    pkgInput.classList.add('border-red-500', 'bg-red-50');
                    setTimeout(() => pkgInput.classList.remove('border-red-500', 'bg-red-50'), 3000);
                }
                return;
            }
        }

        // 3. Form 처리 (신규 작성 시에만 최초 작성자 created_by 등록)
        const formData = {
            project_id: projectId,
            package_no: packageNo,
            item_name: itemName,
            inspection_date: document.getElementById('inspection_date').value || null
        };

        if (!formId) {
            // 설명: 최초 신규 작성 시에만 작성자 정보 저장
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
            // 설명: 기존 확인서 수정 시에는 created_by를 변경하지 않고 공통 정보만 UPDATE
            const { error: formErr } = await supabase
                .from('cross_check_forms')
                .update(formData)
                .eq('id', formId);
            if (formErr) throw formErr;
        }

        // 4. Step & Checklists 처리 (기존 서명 정보를 안전하게 보존하며 필드 및 체크리스트 갱신)
        await saveStepData(1, formId, 'step1_doc_no', 'step1_doc_rev', null, 'res1', 'step1-list');
        await saveStepData(2, formId, 'step2_doc_no', null, 'step2_evidence', 'res2', 'step2-list');
        await saveStepData(3, formId, 'step3_doc_no', null, 'step3_evidence', 'res3', 'step3-list');

        // 5. Form Evidences 처리
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

// 설명: 단계별(1, 2, 3단계) 검증 데이터 및 체크리스트를 안전하게 저장
async function saveStepData(stepNum, formId, docNoId, docRevId, evidenceId, radioName, listId) {
    const docNo = document.getElementById(docNoId)?.value || null;
    const docRev = docRevId ? (document.getElementById(docRevId)?.value || null) : null;
    const evSecured = evidenceId ? document.getElementById(evidenceId)?.checked : false;
    
    const radioSelected = document.querySelector(`input[name="${radioName}"]:checked`);
    const resStatus = radioSelected ? radioSelected.value : 'PENDING';

    // 설명: 기존 step 데이터가 있는지 먼저 조회하여 기존 서명(manager_sign_user_id, manager_signer_name, manager_signed_at)을 보존
    const { data: existingStep } = await supabase
        .from('form_steps')
        .select('id')
        .eq('form_id', formId)
        .eq('step_number', stepNum)
        .maybeSingle();

    let stepId;
    if (existingStep) {
        // 기존 step이 있으면 서명 정보는 유지한 채 문서번호/결과 상태만 UPDATE
        const { data: updatedStep, error: stepErr } = await supabase
            .from('form_steps')
            .update({
                document_no: docNo,
                document_rev: docRev,
                evidence_secured: evSecured,
                result_status: resStatus
            })
            .eq('id', existingStep.id)
            .select()
            .single();
            
        if (stepErr) throw stepErr;
        stepId = updatedStep.id;
    } else {
        // 신규 step 생성
        const { data: newStep, error: stepErr } = await supabase
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
        stepId = newStep.id;
    }
    
    // 해당 step의 체크리스트 항목만 안전하게 갱신
    await supabase.from('step_checklist_items').delete().eq('step_id', stepId);

    const listItems = document.querySelectorAll(`#${listId} li`);
    const chkInserts = Array.from(listItems).map((li, index) => {
        const checkbox = li.querySelector('input[type="checkbox"]');
        const textInput = li.querySelector('input[type="text"]');
        return {
            step_id: stepId,
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

    // 설명: 삭제 전 현재 문서의 최초 작성자 정보를 확인하여 권한 검증
    try {
        const { data: form, error: fetchErr } = await supabase
            .from('cross_check_forms')
            .select('created_by')
            .eq('id', formId)
            .single();

        if (fetchErr) throw fetchErr;

        const isAuthor = currentUserProfile && form && form.created_by && (form.created_by === currentUserProfile.id);
        const isAdmin = currentUserProfile && (currentUserProfile.role === 'ADMIN');

        if (!isAdmin && !isAuthor) {
            alert('삭제 권한이 없습니다.\n확인서 삭제는 관리자(ADMIN) 또는 최초 작성자 본인만 가능합니다.');
            return;
        }
    } catch (err) {
        console.error("권한 검증 오류:", err);
    }

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

    // 설명: 단계별 명칭 안내
    const stepTitleMap = {
        'btn-sign1': '1단계 (설계 담당자)',
        'btn-sign2': '2단계 (구매 담당자)',
        'btn-sign3': '3단계 (물류 담당자)',
        'btn-sign-pm': '최종 출하 승인 (PM / 부서장)'
    };
    const stepTitle = stepTitleMap[btnId] || '서명';

    // 설명: 서명할 이름 또는 이니셜 입력 받기
    const defaultSignerName = (currentUserProfile && currentUserProfile.email) 
        ? currentUserProfile.email.split('@')[0] 
        : '';
    const signerInput = prompt(`[${stepTitle}] 서명을 진행합니다.\n서명란에 기재할 성명 또는 이니셜을 입력하세요:`, defaultSignerName);

    if (signerInput === null) {
        // 사용자가 취소를 누른 경우 중단
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

            setSignUI('sign-pm-status', 'btn-sign-pm', true, signerName, nowIso, user.id);
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
                
            setSignUI(`sign${stepNum}-status`, btnId, true, signerName, nowIso, user.id);
        }
        alert(`'${signerName}' 님의 서명이 성공적으로 등록되었습니다.`);
    } catch (err) {
        console.error("서명 오류:", err);
        alert("서명 처리 중 오류가 발생했습니다: " + err.message);
    }
}

// ---------------------------------------------------
// 서명 취소 (Sign Cancellation) 핸들러
// ---------------------------------------------------
async function handleCancelSign(btnId, statusId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("로그인이 필요합니다.");
        return;
    }
    const formId = document.getElementById('current_form_id').value;
    if (!formId) return;

    // 단계명 확인
    const stepTitleMap = {
        'btn-sign1': '1단계 (설계)',
        'btn-sign2': '2단계 (구매)',
        'btn-sign3': '3단계 (물류)',
        'btn-sign-pm': '최종 출하 승인 (PM)'
    };
    const stepTitle = stepTitleMap[btnId] || '서명';

    // 설명: 서명 취소 권한 사전 검증
    try {
        let signUserId = null;
        if (btnId === 'btn-sign-pm') {
            const { data: form } = await supabase.from('cross_check_forms').select('pm_sign_user_id').eq('id', formId).single();
            signUserId = form?.pm_sign_user_id;
        } else {
            const stepMap = { 'btn-sign1': 1, 'btn-sign2': 2, 'btn-sign3': 3 };
            const stepNum = stepMap[btnId];
            const { data: step } = await supabase.from('form_steps').select('manager_sign_user_id').eq('form_id', formId).eq('step_number', stepNum).single();
            signUserId = step?.manager_sign_user_id;
        }

        const isSigner = currentUserProfile && signUserId && (signUserId === currentUserProfile.id);
        const isAdmin = currentUserProfile && (currentUserProfile.role === 'ADMIN');

        if (!isAdmin && !isSigner) {
            alert("서명 취소 권한이 없습니다.\n관리자(ADMIN) 또는 서명 당사자 본인만 서명을 취소할 수 있습니다.");
            return;
        }
    } catch (err) {
        console.error("서명 권한 검증 오류:", err);
    }

    if (!confirm(`[${stepTitle}] 등록된 서명을 정말로 취소하시겠습니까?\n취소 후 필요시 다시 서명할 수 있습니다.`)) {
        return;
    }

    try {
        if (btnId === 'btn-sign-pm') {
            await supabase.from('cross_check_forms').update({ 
                pm_sign_user_id: null,
                pm_signer_name: null,
                pm_signed_at: null
            }).eq('id', formId);

            resetSignUI('sign-pm-status', 'btn-sign-pm');
        } else {
            const stepMap = { 'btn-sign1': 1, 'btn-sign2': 2, 'btn-sign3': 3 };
            const stepNum = stepMap[btnId];

            await supabase.from('form_steps')
                .update({ 
                    manager_sign_user_id: null,
                    manager_signer_name: null,
                    manager_signed_at: null
                })
                .eq('form_id', formId)
                .eq('step_number', stepNum);

            resetSignUI(`sign${stepNum}-status`, btnId);
        }
        alert(`[${stepTitle}] 서명이 성공적으로 취소되었습니다.`);
    } catch (err) {
        console.error("서명 취소 처리 오류:", err);
        alert("서명 취소 중 오류가 발생했습니다: " + err.message);
    }
}
