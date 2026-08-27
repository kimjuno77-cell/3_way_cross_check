import { supabase } from './supabase.js';
import { currentUserProfile } from './app.js';

const adminUserList = document.getElementById('admin-user-list');

export async function loadAdminData() {
    if (!currentUserProfile || currentUserProfile.role !== 'ADMIN') {
        adminUserList.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">접근 권한이 없습니다.</td></tr>';
        return;
    }

    adminUserList.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">데이터를 불러오는 중...</td></tr>';
    
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        renderAdminList(data);
    } catch(err) {
        console.error(err);
        adminUserList.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">데이터 로드 실패: ${err.message}</td></tr>`;
    }
}

function renderAdminList(users) {
    adminUserList.innerHTML = '';
    if (!users || users.length === 0) {
        adminUserList.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">가입한 사용자가 없습니다.</td></tr>';
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        
        const isApproved = u.is_approved;
        const roleBadge = u.role === 'ADMIN' 
            ? '<span class="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded">ADMIN</span>' 
            : '<span class="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded">USER</span>';

        tr.innerHTML = `
            <td class="p-4 border-b border-slate-200 font-medium">${u.email}</td>
            <td class="p-4 border-b border-slate-200">${roleBadge}</td>
            <td class="p-4 border-b border-slate-200 text-slate-500 text-xs">${new Date(u.created_at).toLocaleString()}</td>
            <td class="p-4 border-b border-slate-200 text-center">
                <button class="btn-toggle-approve px-3 py-1 text-xs font-bold rounded shadow-sm transition-colors ${isApproved ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}" data-id="${u.id}" data-current="${isApproved}">
                    ${isApproved ? '<i class="fas fa-check"></i> 승인됨' : '대기중 (클릭하여 승인)'}
                </button>
            </td>
        `;

        // 버튼 이벤트 리스너
        const btn = tr.querySelector('.btn-toggle-approve');
        // 본인 계정은 상태 변경 못하도록 처리
        if (u.id === currentUserProfile.id) {
            btn.disabled = true;
            btn.className = "px-3 py-1 text-xs font-bold rounded bg-slate-100 text-slate-400 cursor-not-allowed";
            btn.innerHTML = "본인";
        } else {
            btn.addEventListener('click', async () => {
                await toggleApproval(u.id, !isApproved);
            });
        }

        adminUserList.appendChild(tr);
    });
}

async function toggleApproval(userId, newStatus) {
    if (!confirm(newStatus ? '해당 사용자를 승인하시겠습니까?' : '해당 사용자의 승인을 취소하시겠습니까?')) return;
    
    try {
        const { error } = await supabase
            .from('user_profiles')
            .update({ is_approved: newStatus })
            .eq('id', userId);

        if (error) throw error;
        
        // 상태 변경 후 새로고침
        loadAdminData();
    } catch(err) {
        console.error("승인 상태 변경 실패", err);
        alert("승인 상태 변경에 실패했습니다: " + err.message);
    }
}
