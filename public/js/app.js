// Global State Management
let state = {
  supervisors: [],
  practitioners: [],
  currentUser: null,          // Logged-in user session
  currentPractitioner: null,  // If currentUser is a trainee
  currentSupervisor: null,    // If currentUser is a supervisor
  activePractitionerDetail: null, // Trainee being viewed in detail page
  currentView: 'dashboard',
  theme: 'light',
  notifications: [],
  config: {
    lateAlertDays: 3,
    minHours: 40
  }
};

// DOM Elements
const loginScreen = document.getElementById('view-login');
const appMainLayout = document.getElementById('app-main-layout');
const sidebarMenu = document.getElementById('sidebar-menu');
const userProfileWidget = document.getElementById('user-profile-widget');
const notificationsWidget = document.getElementById('notifications-widget');
const notificationsFeedList = document.getElementById('notifications-feed-list');
const btnReadAllNotifications = document.getElementById('btn-read-all-notifications');

// Panel Views
const panels = {
  dashboard: document.getElementById('view-dashboard'),
  practitioners: document.getElementById('view-practitioners'),
  supervisors: document.getElementById('view-supervisors'),
  detail: document.getElementById('view-detail'),
  exams: document.getElementById('view-national-exams'),
  admin: document.getElementById('view-system-admin'),
  departments: document.getElementById('view-departments')
};

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupGlobalEvents();
  
  // Check active session storage
  const savedUser = sessionStorage.getItem('currentUser');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    await reloadUserSession(user.id);
  } else {
    // Show login screen
    loginScreen.style.display = 'flex';
    appMainLayout.style.display = 'none';
  }
});
// Helper to check if supervisor has >= 3 years of experience from license date
function isSupervisorEligible(licenseDateStr) {
  if (!licenseDateStr) return false;
  const licenseDate = new Date(licenseDateStr);
  const today = new Date();
  
  // Calculate difference in years
  let years = today.getFullYear() - licenseDate.getFullYear();
  const m = today.getMonth() - licenseDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < licenseDate.getDate())) {
    years--;
  }
  return years >= 3;
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  state.theme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const icon = document.getElementById('theme-toggle').querySelector('i');
  if (theme === 'dark') {
    icon.className = 'fas fa-sun';
  } else {
    icon.className = 'fas fa-moon';
  }
}

// Setup global modal toggles & Event Listeners
function setupGlobalEvents() {
  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(state.theme === 'light' ? 'dark' : 'light');
  });

  // Login Form Submission
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorMsgDiv = document.getElementById('login-error-msg');
    errorMsgDiv.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('currentUser', JSON.stringify(data.user));
        
        state.currentUser = data.user;
        state.currentPractitioner = data.practitioner;
        state.currentSupervisor = data.supervisor;

        // Transition from Login to Main App
        loginScreen.style.display = 'none';
        appMainLayout.style.display = 'flex';
        
        await refreshData();
        renderHeaderProfile();
        await loadNotifications();
        renderSidebar();

        // Route accordingly
        if (state.currentUser.role === 'Học viên' && state.currentPractitioner) {
          await viewPractitionerDetail(state.currentPractitioner.id);
        } else if (state.currentUser.role === 'Người hướng dẫn') {
          switchView('practitioners');
        } else {
          switchView('dashboard');
        }
      } else {
        const err = await res.json();
        errorMsgDiv.innerText = err.error || 'Đăng nhập không thành công.';
        errorMsgDiv.style.display = 'block';
      }
    } catch (err) {
      errorMsgDiv.innerText = 'Lỗi kết nối máy chủ.';
      errorMsgDiv.style.display = 'block';
    }
  });

  // Logout Click
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      sessionStorage.removeItem('currentUser');
      window.location.reload();
    }
  });

  // Open Change Password Modal
  document.getElementById('btn-open-change-password').addEventListener('click', () => {
    document.getElementById('form-change-password').reset();
    document.getElementById('pw-error-msg').style.display = 'none';
    document.getElementById('modal-change-password').classList.add('active');
  });

  // Submit Change Password
  document.getElementById('form-change-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById('pw-old').value;
    const newPassword = document.getElementById('pw-new').value;
    const confirmPassword = document.getElementById('pw-confirm').value;
    const errorDiv = document.getElementById('pw-error-msg');
    
    errorDiv.style.display = 'none';
    if (newPassword !== confirmPassword) {
      errorDiv.innerText = 'Mật khẩu mới nhập lại không khớp.';
      errorDiv.style.display = 'block';
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: state.currentUser.id,
          oldPassword,
          newPassword
        })
      });

      if (res.ok) {
        alert('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.');
        document.getElementById('modal-change-password').classList.remove('active');
      } else {
        const err = await res.json();
        errorDiv.innerText = err.error || 'Cập nhật mật khẩu thất bại.';
        errorDiv.style.display = 'block';
      }
    } catch (err) {
      errorDiv.innerText = 'Lỗi kết nối máy chủ.';
      errorDiv.style.display = 'block';
    }
  });

  // Close modals when clicking 'x' or backdrop
  document.querySelectorAll('.modal').forEach(modal => {
    modal.querySelectorAll('.modal-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // Read all notifications
  btnReadAllNotifications.addEventListener('click', async () => {
    if (!state.currentUser) return;
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.currentUser.id })
      });
      await loadNotifications();
    } catch (err) {
      console.error(err);
    }
  });

  // Export Excel / CSV Reports
  document.getElementById('btn-export-e01')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/rotations');
      if (!res.ok) throw new Error('Không thể tải danh sách luân khoa');
      const rotations = await res.json();
      
      let csvContent = '\ufeff';
      csvContent += 'BÁO CÁO TIẾN ĐỘ LUÂN KHOA HỌC VIÊN\n';
      csvContent += 'Trung tâm Y tế khu vực Liên Chiểu - Đà Nẵng\n\n';
      csvContent += 'STT;Họ và tên;Văn bằng chuyên môn;Chức danh đăng ký;Khoa/Nội dung thực hành;Thời gian quy định;Ngày bắt đầu;Ngày kết thúc;Trạng thái luân khoa;Người hướng dẫn giai đoạn\n';
      
      rotations.forEach((r, idx) => {
        const sDate = r.start_date ? new Date(r.start_date).toLocaleDateString('vi-VN') : 'Chưa định ngày';
        const eDate = r.end_date ? new Date(r.end_date).toLocaleDateString('vi-VN') : 'Chưa định ngày';
        csvContent += `${idx + 1};${r.practitioner_name};${r.practitioner_degree};${r.practitioner_specialty};${r.name};${r.duration};${sDate};${eDate};${r.status};${r.supervisor_name || 'Chưa phân công'}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Bao_cao_tien_do_luan_khoa_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Lỗi xuất báo cáo: ' + err.message);
    }
  });
  document.getElementById('btn-export-e02')?.addEventListener('click', () => {
    try {
      let csvContent = '\ufeff';
      csvContent += 'DANH SÁCH TỔNG HỢP HỌC VIÊN THỰC HÀNH Y KHOA\n';
      csvContent += 'Trung tâm Y tế khu vực Liên Chiểu - Đà Nẵng\n\n';
      csvContent += 'STT;Họ và tên;Ngày sinh;Giới tính;Số điện thoại;Email;Văn bằng chuyên môn;Chức danh đăng ký;Khung pháp lý;Ngày bắt đầu;Người hướng dẫn chính;Trạng thái thực hành;Duyệt hồ sơ;Điểm thi năng lực;Kết quả thi năng lực\n';
      
      state.practitioners.forEach((p, idx) => {
        const dob = p.dob ? new Date(p.dob).toLocaleDateString('vi-VN') : 'N/A';
        const sDate = p.start_date ? new Date(p.start_date).toLocaleDateString('vi-VN') : 'N/A';
        const score = p.national_test_score !== null && p.national_test_score !== undefined ? p.national_test_score : 'Chưa có';
        csvContent += `${idx + 1};${p.name};${dob};${p.gender};${p.phone || ''};${p.email || ''};${p.degree};${p.specialty};${p.program === 'ND96' ? 'NĐ 96/2023/NĐ-CP' : 'TT 21/2020/TT-BYT'};${sDate};${p.supervisor_name || 'Chưa phân công'};${p.status};${p.profile_status};${score};${p.national_test_result}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Bao_cao_tong_hop_hoc_vien_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Lỗi xuất báo cáo: ' + err.message);
    }
  });

  // Open Add Timeline Stage
  document.getElementById('btn-add-timeline-stage')?.addEventListener('click', () => {
    openAddRotationStageModal();
  });

  // Reset Timeline to defaults
  document.getElementById('btn-reset-timeline')?.addEventListener('click', async () => {
    if (confirm('Đặt lại lộ trình luân khoa về mặc định theo luật/quy định? Thao tác này sẽ xóa lộ trình tự thiết lập hiện tại.')) {
      const id = state.activePractitionerDetail.practitioner.id;
      try {
        const res = await fetch(`/api/practitioners/${id}/rotations/reset`, { method: 'POST' });
        if (res.ok) {
          await refreshActivePractitionerDetail();
          renderTimelineTabContent();
        } else {
          const err = await res.json();
          alert('Lỗi đặt lại lộ trình: ' + err.error);
        }
      } catch (err) {
        alert('Lỗi kết nối: ' + err.message);
      }
    }
  });

  // Submit Timeline Stage Modal Form
  document.getElementById('form-timeline-stage')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = state.activePractitionerDetail.practitioner.id;
    const supervisorVal = document.getElementById('stage-supervisor').value;
    const formData = {
      name: document.getElementById('stage-name').value,
      duration: document.getElementById('stage-duration').value,
      status: document.getElementById('stage-status').value,
      start_date: document.getElementById('stage-start').value || null,
      end_date: document.getElementById('stage-end').value || null,
      order_index: parseInt(document.getElementById('stage-order').value) || 0,
      supervisor_id: supervisorVal ? parseInt(supervisorVal) : null
    };

    try {
      const isEdit = rotationIdToEdit !== null;
      const url = isEdit ? `/api/rotations/${rotationIdToEdit}` : `/api/practitioners/${id}/rotations`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        document.getElementById('modal-timeline-stage').classList.remove('active');
        await refreshActivePractitionerDetail();
        renderTimelineTabContent();
      } else {
        const err = await res.json();
        alert('Lỗi lưu giai đoạn luân khoa: ' + err.error);
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    }
  });

  // Submit Department Form
  document.getElementById('form-add-department')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('dept-name');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (res.ok) {
        nameInput.value = '';
        await refreshData();
        renderDepartmentsList();
      } else {
        const err = await res.json();
        alert('Lỗi thêm khoa/phòng: ' + err.error);
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    }
  });
}

// Reload existing user session on boot F5
async function reloadUserSession(userId) {
  try {
    const res = await fetch('/api/auth/session-reload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (res.ok) {
      const data = await res.json();
      state.currentUser = data.user;
      state.currentPractitioner = data.practitioner;
      state.currentSupervisor = data.supervisor;

      loginScreen.style.display = 'none';
      appMainLayout.style.display = 'flex';
      
      await refreshData();
      renderHeaderProfile();
      await loadNotifications();
      renderSidebar();

      // Route accordingly
      if (state.currentUser.role === 'Học viên' && state.currentPractitioner) {
        await viewPractitionerDetail(state.currentPractitioner.id);
      } else if (state.currentUser.role === 'Người hướng dẫn') {
        switchView('practitioners');
      } else {
        switchView('dashboard');
      }
    } else {
      sessionStorage.removeItem('currentUser');
      loginScreen.style.display = 'flex';
      appMainLayout.style.display = 'none';
    }
  } catch (err) {
    sessionStorage.removeItem('currentUser');
    loginScreen.style.display = 'flex';
    appMainLayout.style.display = 'none';
  }
}

// Draw header profile name
function renderHeaderProfile() {
  userProfileWidget.innerHTML = `
    <div class="avatar">${state.currentUser.name.charAt(0)}</div>
    <span style="font-weight: 600; font-size: 13.5px;">${state.currentUser.name} (${state.currentUser.role})</span>
  `;
}

// Fetch all database records
async function refreshData() {
  try {
    const supervisorsRes = await fetch('/api/supervisors');
    state.supervisors = await supervisorsRes.json();

    const practitionersRes = await fetch('/api/practitioners');
    state.practitioners = await practitionersRes.json();

    const departmentsRes = await fetch('/api/departments');
    state.departments = await departmentsRes.json();

    updateDepartmentsDatalist();
  } catch (err) {
    console.error('Error refreshing data:', err);
  }
}

function updateDepartmentsDatalist() {
  const datalist = document.getElementById('departments-datalist');
  if (datalist) {
    datalist.innerHTML = '';
    if (state.departments) {
      state.departments.forEach(dept => {
        datalist.innerHTML += `<option value="${dept.name}">`;
      });
    }
  }
}

// Load and render notifications
async function loadNotifications() {
  if (!state.currentUser) return;
  try {
    const res = await fetch(`/api/notifications?userId=${state.currentUser.id}`);
    state.notifications = await res.json();

    // Check for late logs alerts for active trainees
    if (state.currentUser.role === 'Học viên' && state.currentPractitioner) {
      const logsRes = await fetch(`/api/logs?practitionerId=${state.currentPractitioner.id}`);
      const logs = await logsRes.json();
      
      let lastLogDate = new Date(state.currentPractitioner.start_date);
      if (logs.length > 0) {
        lastLogDate = new Date(logs[0].log_date);
      }

      const diffTime = Math.abs(new Date() - lastLogDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > state.config.lateAlertDays && state.currentPractitioner.status === 'Đang thực hành') {
        const lateAlertExists = state.notifications.some(n => n.title.includes('CẢNH BÁO'));
        if (!lateAlertExists) {
          const alertItem = {
            id: 'temp-alert',
            title: 'CẢNH BÁO: Trễ nhập nhật ký thực hành (Module B.04)',
            message: `Đã quá ${diffDays} ngày bạn chưa cập nhật nhật ký lâm sàng hằng ngày. Hệ thống yêu cầu ghi nhận liên tục để tính thời gian hợp lệ.`,
            is_read: false,
            is_alert: true
          };
          state.notifications.unshift(alertItem);
        }
      }
    }

    if (state.notifications.length === 0) {
      notificationsWidget.style.display = 'none';
    } else {
      notificationsWidget.style.display = 'block';
      notificationsFeedList.innerHTML = '';
      
      state.notifications.slice(0, 3).forEach(n => {
        const div = document.createElement('div');
        div.className = `notification-item ${n.is_read ? '' : 'unread'} ${n.is_alert ? 'alert-late' : ''}`;
        div.innerHTML = `
          <div>
            <strong style="display:block; margin-bottom:2px;">${n.title}</strong>
            <span>${n.message}</span>
            <small style="display:block; margin-top:4px; color:var(--text-light); font-size:11px;">
              ${n.created_at ? new Date(n.created_at).toLocaleString('vi-VN') : 'Hiện tại'}
            </small>
          </div>
        `;
        notificationsFeedList.appendChild(div);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// Render dynamic sidebar depending on role
function renderSidebar() {
  sidebarMenu.innerHTML = '';
  const role = state.currentUser ? state.currentUser.role : 'Cán bộ quản lý';

  const menuSchema = [
    { view: 'dashboard', name: 'Tổng quan', icon: 'fa-solid fa-chart-line', roles: ['Cán bộ quản lý', 'Quản trị viên'] },
    { view: 'practitioners', name: role === 'Người hướng dẫn' ? 'Học viên kèm cặp' : 'Danh sách Học viên', icon: 'fa-solid fa-user-doctor', roles: ['Cán bộ quản lý', 'Người hướng dẫn', 'Quản trị viên'] },
    { view: 'supervisors', name: 'Người hướng dẫn', icon: 'fa-solid fa-user-tie', roles: ['Cán bộ quản lý', 'Quản trị viên'] },
    { view: 'departments', name: 'Quản lý Khoa/Phòng', icon: 'fa-solid fa-hospital', roles: ['Cán bộ quản lý', 'Quản trị viên'] },
    { view: 'exams', name: 'Kỳ thi Đánh giá', icon: 'fa-solid fa-graduation-cap', roles: ['Cán bộ quản lý'] },
    { view: 'admin', name: 'Quản trị Hệ thống', icon: 'fa-solid fa-database', roles: ['Quản trị viên'] }
  ];

  menuSchema.forEach(item => {
    if (item.roles.includes(role)) {
      const li = document.createElement('li');
      li.innerHTML = `
        <a class="menu-item ${state.currentView === item.view ? 'active' : ''}" data-view="${item.view}">
          <i class="${item.icon}"></i>
          <span>${item.name}</span>
        </a>
      `;
      li.querySelector('a').addEventListener('click', (e) => {
        const v = e.currentTarget.getAttribute('data-view');
        switchView(v);
      });
      sidebarMenu.appendChild(li);
    }
  });
}

// Switch UI Panel Views
function switchView(viewName) {
  state.currentView = viewName;
  renderSidebar();

  // Hide all panels
  Object.values(panels).forEach(p => { if (p) p.style.display = 'none'; });

  // Show target panel
  if (viewName === 'dashboard') {
    panels.dashboard.style.display = 'block';
    renderDashboard();
  } else if (viewName === 'practitioners') {
    panels.practitioners.style.display = 'block';
    renderPractitionersList();
  } else if (viewName === 'supervisors') {
    panels.supervisors.style.display = 'block';
    renderSupervisorsList();
  } else if (viewName === 'departments') {
    panels.departments.style.display = 'block';
    renderDepartmentsList();
  } else if (viewName === 'detail') {
    panels.detail.style.display = 'block';
    renderPractitionerDetail();
  } else if (viewName === 'exams') {
    panels.exams.style.display = 'block';
    renderNationalExamsList();
  } else if (viewName === 'admin') {
    panels.admin.style.display = 'block';
    renderAdminPanel();
  }
}

// Helper: Read file input as base64 string
function readFileAsBase64(fileInput) {
  return new Promise((resolve) => {
    if (!fileInput || fileInput.files.length === 0) {
      resolve(null);
      return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// =========================================================================
// RENDER: DASHBOARD
// =========================================================================
function renderDashboard() {
  const active = state.practitioners.filter(p => p.status === 'Đang thực hành' && p.profile_status === 'Đã duyệt').length;
  const completed = state.practitioners.filter(p => p.status === 'Đã hoàn thành').length;
  const pending = state.practitioners.filter(p => p.profile_status === 'Chờ duyệt').length;
  const total = state.practitioners.length;

  document.getElementById('stat-active').innerText = active;
  document.getElementById('stat-completed').innerText = completed;
  document.getElementById('stat-pending').innerText = pending;
  document.getElementById('stat-total').innerText = total;

  // Render Specialty stats (E.01 Chart)
  const specialties = {};
  state.practitioners.forEach(p => {
    specialties[p.specialty] = (specialties[p.specialty] || 0) + 1;
  });

  const chartContainer = document.getElementById('dashboard-specialty-chart');
  chartContainer.innerHTML = '';
  
  const specList = Object.entries(specialties).sort((a, b) => b[1] - a[1]);
  const maxVal = Math.max(...Object.values(specialties), 1);

  if (specList.length === 0) {
    chartContainer.innerHTML = '<div style="color:var(--text-secondary); text-align:center; width:100%; padding-bottom:40px;">Chưa có dữ liệu học viên</div>';
  } else {
    specList.forEach(([name, count]) => {
      const heightPercent = (count / maxVal) * 80 + 10;
      const barWrapper = document.createElement('div');
      barWrapper.className = 'bar-wrapper';
      barWrapper.innerHTML = `
        <div class="bar" style="height: ${heightPercent}%;">
          <div class="bar-tooltip">${count} học viên</div>
        </div>
        <div class="bar-label" title="${name}">${name}</div>
      `;
      chartContainer.appendChild(barWrapper);
    });
  }

  // Render Program distribution (E.02)
  const programs = { 'ND96': 0, 'TT21': 0 };
  state.practitioners.forEach(p => {
    if (programs[p.program] !== undefined) programs[p.program]++;
  });

  document.getElementById('dashboard-program-list').innerHTML = `
    <div class="specialty-item">
      <div class="specialty-info">
        <span class="specialty-name">Nghị định 96/2023/NĐ-CP (Luật 2023)</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="specialty-bar-bg">
          <div class="specialty-bar-fill" style="width: ${total > 0 ? (programs['ND96'] / total) * 100 : 0}%; background-color: var(--primary);"></div>
        </div>
        <span style="font-weight: 600; font-size: 13px;">${programs['ND96']}</span>
      </div>
    </div>
    <div class="specialty-item">
      <div class="specialty-info">
        <span class="specialty-name">Thông tư 21/2020/TT-BYT (Cơ chế cũ)</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="specialty-bar-bg">
          <div class="specialty-bar-fill" style="width: ${total > 0 ? (programs['TT21'] / total) * 100 : 0}%; background-color: var(--secondary);"></div>
        </div>
        <span style="font-weight: 600; font-size: 13px;">${programs['TT21']}</span>
      </div>
    </div>
  `;
}

// =========================================================================
// RENDER: PRACTITIONERS LIST
// =========================================================================
let pracFilters = { search: '', specialty: 'ALL', status: 'ALL' };

function renderPractitionersList() {
  const container = document.getElementById('practitioners-list-container');
  container.innerHTML = '';

  let list = state.practitioners;
  
  if (state.currentUser.role === 'Người hướng dẫn' && state.currentSupervisor) {
    list = state.practitioners.filter(p => p.supervisor_id === state.currentSupervisor.id);
  }

  const filtered = list.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(pracFilters.search.toLowerCase()) || 
                          p.degree.toLowerCase().includes(pracFilters.search.toLowerCase());
    const matchesSpecialty = pracFilters.specialty === 'ALL' || p.specialty === pracFilters.specialty;
    const matchesStatus = pracFilters.status === 'ALL' || p.status === pracFilters.status;
    return matchesSearch && matchesSpecialty && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align: center; color:var(--text-secondary); padding:24px;">Không tìm thấy học viên nào</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const tr = document.createElement('tr');
    const startStr = new Date(p.start_date).toLocaleDateString('vi-VN');

    let profileBadge = '';
    if (p.profile_status === 'Chờ duyệt') {
      profileBadge = `<span class="badge badge-warning">Chờ duyệt</span>`;
    } else if (p.profile_status === 'Đã duyệt') {
      profileBadge = `<span class="badge badge-success">Đã duyệt</span>`;
    } else {
      profileBadge = `<span class="badge badge-danger" title="Lý do: ${p.rejection_reason}">Từ chối</span>`;
    }

    let examBadge = '<span class="badge badge-warning">Chưa thi</span>';
    if (p.national_test_result === 'Đạt') {
      examBadge = `<span class="badge badge-success">Đạt thi NL (${p.national_test_score})</span>`;
    } else if (p.national_test_result === 'Không đạt') {
      examBadge = `<span class="badge badge-danger">Hỏng thi (${p.national_test_score})</span>`;
    }

    let supervisorCell = '';
    if (p.supervisor_id) {
      supervisorCell = `<span>${p.supervisor_name}</span>`;
    } else if (state.currentUser.role === 'Cán bộ quản lý') {
      supervisorCell = `<button class="btn btn-secondary btn-assign-sup" style="padding:4px 8px; font-size:11px;"><i class="fa-solid fa-user-pen"></i> Phân công</button>`;
    } else {
      supervisorCell = `<span style="color:var(--danger)">Chưa phân công</span>`;
    }

    let actionButtons = `<button class="btn-icon btn-view-det" title="Xem chi tiết lộ trình thực hành"><i class="fas fa-eye"></i></button>`;
    if (state.currentUser.role === 'Cán bộ quản lý') {
      actionButtons += `<button class="btn-icon btn-edit-prac" title="Sửa thông tin học viên"><i class="fas fa-pen"></i></button>`;
      actionButtons += `<button class="btn-icon btn-del-prac" title="Xóa học viên"><i class="fas fa-trash"></i></button>`;
    }

    let approvalActionCell = profileBadge;
    if (p.profile_status === 'Chờ duyệt' && state.currentUser.role === 'Cán bộ quản lý') {
      approvalActionCell = `
        <div style="display:flex; gap:4px;">
          <button class="btn btn-primary btn-approve-prof" style="padding:4px 8px; font-size:11px;">Duyệt</button>
          <button class="btn btn-secondary btn-reject-prof" style="padding:4px 8px; font-size:11px; color:var(--danger);">Từ chối</button>
        </div>
      `;
    }

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:30px; height:30px; border-radius:50%; background-color:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; overflow:hidden;">
            ${p.avatar_url ? `<img src="${p.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : p.name.charAt(0)}
          </div>
          <div>
            <strong>${p.name}</strong><br>
            <span style="font-size:11px; color:var(--text-secondary);">${p.degree}</span>
          </div>
        </div>
      </td>
      <td>${p.specialty}</td>
      <td>${p.program === 'ND96' ? 'NĐ 96/2023' : 'TT 21/2020'}</td>
      <td>${supervisorCell}</td>
      <td>${approvalActionCell}</td>
      <td>${examBadge}</td>
      <td class="actions-cell">${actionButtons}</td>
    `;

    tr.querySelector('.btn-view-det').addEventListener('click', () => {
      viewPractitionerDetail(p.id);
    });    if (state.currentUser.role === 'Cán bộ quản lý') {
      tr.querySelector('.btn-edit-prac')?.addEventListener('click', () => {
        openEditPractitionerModal(p);
      });

      tr.querySelector('.btn-del-prac')?.addEventListener('click', async () => {
        if (confirm(`Xóa hồ sơ thực hành của ${p.name}?`)) {
          try {
            const res = await fetch(`/api/practitioners/${p.id}`, { method: 'DELETE' });
            if (res.ok) {
              await refreshData();
              renderPractitionersList();
            } else {
              const err = await res.json();
              alert('Lỗi xóa học viên: ' + err.error);
            }
          } catch (err) {
            alert('Lỗi kết nối máy chủ: ' + err.message);
          }
        }
      });

      tr.querySelector('.btn-approve-prof')?.addEventListener('click', async () => {
        if (confirm(`Duyệt hồ sơ đăng ký thực hành của học viên ${p.name}?`)) {
          await fetch(`/api/practitioners/${p.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Đã duyệt' })
          });
          await refreshData();
          renderPractitionersList();
        }
      });

      tr.querySelector('.btn-reject-prof')?.addEventListener('click', () => {
        openRejectProfileModal(p.id);
      });

      tr.querySelector('.btn-assign-sup')?.addEventListener('click', () => {
        openAssignSupervisorModal(p.id);
      });
    }

    container.appendChild(tr);
  });
}

// Bind search and filter events
document.getElementById('prac-search').addEventListener('input', (e) => {
  pracFilters.search = e.target.value;
  renderPractitionersList();
});
document.getElementById('prac-specialty-filter').addEventListener('change', (e) => {
  pracFilters.specialty = e.target.value;
  renderPractitionersList();
});
document.getElementById('prac-status-filter').addEventListener('change', (e) => {
  pracFilters.status = e.target.value;
  renderPractitionersList();
});

let practitionerIdToEdit = null;

// A.02: Open Practitioner Registration modal
document.getElementById('btn-register-practitioner').addEventListener('click', () => {
  practitionerIdToEdit = null;
  const modal = document.getElementById('modal-register-practitioner');
  modal.querySelector('h3').innerText = 'Tiếp nhận & Đăng ký Hồ sơ Thực hành mới';
  document.getElementById('form-register-practitioner').reset();
  document.getElementById('reg-username').disabled = false;
  
  const supervisorSelect = document.getElementById('reg-supervisor');
  supervisorSelect.innerHTML = '<option value="">-- Phân công người hướng dẫn chuyên môn --</option>';
  state.supervisors.forEach(s => {
    const eligible = isSupervisorEligible(s.license_date);
    const expText = eligible ? '' : ' (Chưa đủ 3 năm kinh nghiệm)';
    const option = document.createElement('option');
    option.value = s.id;
    option.innerText = `${s.name} - ${s.specialty} (${s.department || 'Khoa tự do'})${expText}`;
    if (!eligible) {
      option.disabled = true;
      option.style.color = 'var(--text-light)';
    }
    supervisorSelect.appendChild(option);
  });

  modal.classList.add('active');
});

function openEditPractitionerModal(p) {
  practitionerIdToEdit = p.id;
  const modal = document.getElementById('modal-register-practitioner');
  modal.querySelector('h3').innerText = 'Cập nhật Thông tin Học viên';
  
  document.getElementById('reg-name').value = p.name;
  document.getElementById('reg-username').value = p.username;
  document.getElementById('reg-username').disabled = true;
  
  document.getElementById('reg-dob').value = new Date(p.dob).toISOString().split('T')[0];
  document.getElementById('reg-gender').value = p.gender;
  document.getElementById('reg-email').value = p.email || '';
  document.getElementById('reg-phone').value = p.phone || '';
  document.getElementById('reg-degree').value = p.degree;
  document.getElementById('reg-specialty').value = p.specialty;
  document.getElementById('reg-program').value = p.program;
  document.getElementById('reg-start-date').value = new Date(p.start_date).toISOString().split('T')[0];
  
  const supervisorSelect = document.getElementById('reg-supervisor');
  supervisorSelect.innerHTML = '<option value="">-- Phân công người hướng dẫn chuyên môn --</option>';
  state.supervisors.forEach(s => {
    const eligible = isSupervisorEligible(s.license_date);
    const expText = eligible ? '' : ' (Chưa đủ 3 năm kinh nghiệm)';
    const option = document.createElement('option');
    option.value = s.id;
    option.innerText = `${s.name} - ${s.specialty} (${s.department || 'Khoa tự do'})${expText}`;
    if (!eligible) {
      option.disabled = true;
      option.style.color = 'var(--text-light)';
    }
    supervisorSelect.appendChild(option);
  });
  
  supervisorSelect.value = p.supervisor_id || '';
  modal.classList.add('active');
}

// Submit profile registration form with REAL base64 file readers!
document.getElementById('form-register-practitioner').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const avatarInput = document.getElementById('reg-avatar');
  const degreeInput = document.getElementById('reg-degree-file');

  const avatar_url = await readFileAsBase64(avatarInput);
  const degree_scan_url = await readFileAsBase64(degreeInput);

  const formData = {
    name: document.getElementById('reg-name').value,
    username: document.getElementById('reg-username').value.trim(),
    dob: document.getElementById('reg-dob').value,
    gender: document.getElementById('reg-gender').value,
    email: document.getElementById('reg-email').value,
    phone: document.getElementById('reg-phone').value,
    degree: document.getElementById('reg-degree').value,
    specialty: document.getElementById('reg-specialty').value,
    program: document.getElementById('reg-program').value,
    start_date: document.getElementById('reg-start-date').value,
    supervisor_id: document.getElementById('reg-supervisor').value ? parseInt(document.getElementById('reg-supervisor').value) : null,
    avatar_url,
    degree_scan_url
  };

  try {
    const isEdit = practitionerIdToEdit !== null;
    const url = isEdit ? `/api/practitioners/${practitionerIdToEdit}` : '/api/practitioners';
    const method = isEdit ? 'PUT' : 'POST';

    // Disable field momentarily for submit integrity if edit
    if (isEdit) {
      document.getElementById('reg-username').disabled = false;
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (isEdit) {
      document.getElementById('reg-username').disabled = true;
    }

    if (res.ok) {
      document.getElementById('modal-register-practitioner').classList.remove('active');
      document.getElementById('form-register-practitioner').reset();
      await refreshData();
      renderPractitionersList();
    } else {
      const err = await res.json();
      alert('Lỗi lưu hồ sơ học viên: ' + err.error);
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ: ' + err.message);
  }
});

// A.03: Reject Profile Modal
let practitionerIdToReject = null;
function openRejectProfileModal(id) {
  practitionerIdToReject = id;
  document.getElementById('form-reject-profile').reset();
  document.getElementById('modal-reject-profile').classList.add('active');
}
document.getElementById('form-reject-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  const reason = document.getElementById('rej-reason').value;
  try {
    await fetch(`/api/practitioners/${practitionerIdToReject}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Từ chối', reason })
    });
    document.getElementById('modal-reject-profile').classList.remove('active');
    await refreshData();
    renderPractitionersList();
  } catch (err) {
    console.error(err);
  }
});

// A.04: Assign Supervisor Modal
let practitionerIdToAssign = null;
function openAssignSupervisorModal(id) {
  practitionerIdToAssign = id;
  const select = document.getElementById('reg-supervisor');
  const modal = document.getElementById('modal-register-practitioner');
  
  modal.querySelector('h3').innerText = 'Chỉ định Người Hướng Dẫn';
  
  // Override registration form submit for assignment
  modal.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const supervisorId = select.value ? parseInt(select.value) : null;
    await fetch(`/api/practitioners/${practitionerIdToAssign}/assign-supervisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supervisorId })
    });
    modal.classList.remove('active');
    modal.querySelector('h3').innerText = 'Tiếp nhận & Đăng ký Hồ sơ Thực hành mới';
    modal.querySelector('form').onsubmit = null; // restore default
    await refreshData();
    renderPractitionersList();
  };
  
  select.innerHTML = '<option value="">-- Chọn người hướng dẫn --</option>';
  state.supervisors.forEach(s => {
    const eligible = isSupervisorEligible(s.license_date);
    const expText = eligible ? '' : ' (Chưa đủ 3 năm kinh nghiệm)';
    const option = document.createElement('option');
    option.value = s.id;
    option.innerText = `${s.name} - ${s.specialty} (${s.department || 'Khoa tự do'})${expText}`;
    if (!eligible) option.disabled = true;
    select.appendChild(option);
  });
  modal.classList.add('active');
}

// =========================================================================
// RENDER: SUPERVISORS LIST
// =========================================================================
function renderSupervisorsList() {
  const container = document.getElementById('supervisors-list-container');
  container.innerHTML = '';

  state.supervisors.forEach(s => {
    const tr = document.createElement('tr');
    const eligible = isSupervisorEligible(s.license_date);
    const eligibilityBadge = eligible 
      ? '<span class="badge badge-success">Đủ điều kiện</span>' 
      : '<span class="badge badge-danger">Chưa đủ 3 năm</span>';
    
    const licDate = new Date(s.license_date).toLocaleDateString('vi-VN');

    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td>${s.specialty}</td>
      <td><span class="badge badge-info">${s.department || 'Chưa cập nhật'}</span></td>
      <td><code>${s.license_number}</code></td>
      <td>${licDate}</td>
      <td>${eligibilityBadge}</td>
      <td><span style="font-weight:700;">${s.active_trainees}</span> học viên</td>
      <td class="actions-cell">
        <button class="btn-icon btn-edit-sup" style="margin-right: 5px; color: var(--primary);"><i class="fas fa-edit"></i></button>
        <button class="btn-icon btn-del-sup"><i class="fas fa-trash"></i></button>
      </td>
    `;

    tr.querySelector('.btn-edit-sup').addEventListener('click', () => {
      const modal = document.getElementById('modal-add-supervisor');
      const form = document.getElementById('form-add-supervisor');
      modal.querySelector('h3').innerText = 'Chỉnh sửa thông tin Người hướng dẫn';
      modal.querySelector('button[type="submit"]').innerText = 'Cập nhật thông tin';
      
      form._editId = s.id;
      document.getElementById('sup-name').value = s.name;
      document.getElementById('sup-dob').value = s.dob ? s.dob.split('T')[0] : '';
      document.getElementById('sup-gender').value = s.gender || 'Nam';
      document.getElementById('sup-email').value = s.email || '';
      document.getElementById('sup-phone').value = s.phone || '';
      document.getElementById('sup-specialty').value = s.specialty;
      document.getElementById('sup-department').value = s.department || '';
      document.getElementById('sup-license').value = s.license_number;
      document.getElementById('sup-license-date').value = s.license_date ? s.license_date.split('T')[0] : '';
      
      modal.classList.add('active');
    });

    tr.querySelector('.btn-del-sup').addEventListener('click', async () => {
      if (parseInt(s.active_trainees) > 0) {
        alert('Không thể xóa bác sĩ hướng dẫn đang kèm học viên!');
        return;
      }
      if (confirm(`Xóa người hướng dẫn ${s.name}?`)) {
        await fetch(`/api/supervisors/${s.id}`, { method: 'DELETE' });
        await refreshData();
        renderSupervisorsList();
      }
    });

    container.appendChild(tr);
  });
}

// Add new supervisor
document.getElementById('btn-add-supervisor').addEventListener('click', () => {
  const modal = document.getElementById('modal-add-supervisor');
  const form = document.getElementById('form-add-supervisor');
  modal.querySelector('h3').innerText = 'Đăng ký Người hướng dẫn';
  modal.querySelector('button[type="submit"]').innerText = 'Lưu người hướng dẫn';
  form._editId = null;
  form.reset();
  modal.classList.add('active');
});
document.getElementById('form-add-supervisor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = {
    name: document.getElementById('sup-name').value,
    dob: document.getElementById('sup-dob').value,
    gender: document.getElementById('sup-gender').value,
    email: document.getElementById('sup-email').value,
    phone: document.getElementById('sup-phone').value,
    license_number: document.getElementById('sup-license').value,
    specialty: document.getElementById('sup-specialty').value,
    license_date: document.getElementById('sup-license-date').value,
    department: document.getElementById('sup-department').value
  };

  const isEdit = !!form._editId;
  const url = isEdit ? `/api/supervisors/${form._editId}` : '/api/supervisors';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      document.getElementById('modal-add-supervisor').classList.remove('active');
      await refreshData();
      renderSupervisorsList();
    } else {
      const err = await res.json();
      alert(`Lỗi ${isEdit ? 'cập nhật' : 'thêm'} người hướng dẫn: ` + err.error);
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ: ' + err.message);
  }
});

// =========================================================================
// RENDER: PRACTITIONER DETAIL VIEW
// =========================================================================
async function viewPractitionerDetail(id) {
  try {
    const pracRes = await fetch(`/api/practitioners/${id}`);
    const practitioner = await pracRes.json();

    const logsRes = await fetch(`/api/logs?practitionerId=${id}`);
    const logs = await logsRes.json();

    const evalsRes = await fetch(`/api/evaluations?practitionerId=${id}`);
    const evaluations = await evalsRes.json();

    const trainRes = await fetch(`/api/training?practitionerId=${id}`);
    const training = await trainRes.json();

    const rotationsRes = await fetch(`/api/practitioners/${id}/rotations`);
    const rotations = await rotationsRes.json();

    state.activePractitionerDetail = { practitioner, logs, evaluations, training, rotations };
    
    switchView('detail');
  } catch (err) {
    console.error(err);
  }
}

function renderPractitionerDetail() {
  const { practitioner, logs, evaluations, training } = state.activePractitionerDetail;
  const role = state.currentUser.role;

  // Render header titles
  document.getElementById('header-title').innerText = `Hồ Sơ Học Viên: ${practitioner.name}`;
  document.getElementById('header-subtitle').innerText = `Chi tiết quá trình lâm sàng thực hành tại TTYT Liên Chiểu`;

  // Profile Card
  document.getElementById('det-avatar-char').innerText = practitioner.name.charAt(0);
  document.getElementById('det-avatar').innerHTML = practitioner.avatar_url 
    ? `<img src="${practitioner.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` 
    : `<span id="det-avatar-char">${practitioner.name.charAt(0)}</span>`;

  document.getElementById('det-name').innerText = practitioner.name;
  document.getElementById('det-degree').innerText = practitioner.degree;
  document.getElementById('det-specialty').innerText = practitioner.specialty;
  document.getElementById('det-dob').innerText = new Date(practitioner.dob).toLocaleDateString('vi-VN');
  
  // Profile Status
  const statusBadge = document.getElementById('det-profile-status');
  statusBadge.innerText = practitioner.profile_status;
  statusBadge.className = 'badge ' + (practitioner.profile_status === 'Đã duyệt' ? 'badge-success' : (practitioner.profile_status === 'Chờ duyệt' ? 'badge-warning' : 'badge-danger'));
  
  // Rejection box
  const rejBox = document.getElementById('det-rejection-box');
  if (practitioner.profile_status === 'Từ chối' && practitioner.rejection_reason) {
    rejBox.style.display = 'block';
    document.getElementById('det-rejection-reason').innerText = practitioner.rejection_reason;
  } else {
    rejBox.style.display = 'none';
  }

  document.getElementById('det-start-date').innerText = new Date(practitioner.start_date).toLocaleDateString('vi-VN');
  document.getElementById('det-program').innerText = practitioner.program === 'ND96' ? 'Nghị định 96/2023/NĐ-CP (Luật 2023)' : 'Thông tư 21/2020/TT-BYT';
  document.getElementById('det-supervisor').innerText = practitioner.supervisor_name || 'Chưa phân công';

  // Toggle buttons based on role
  const addLogBtn = document.getElementById('btn-add-log');
  if (role === 'Học viên') {
    addLogBtn.style.display = 'inline-flex';
  } else {
    addLogBtn.style.display = 'none';
  }

  const addEvalBtn = document.getElementById('btn-add-evaluation');
  if (role === 'Người hướng dẫn') {
    addEvalBtn.style.display = 'inline-flex';
  } else {
    addEvalBtn.style.display = 'none';
  }

  // Setup tabs actions
  const tabs = document.getElementById('detail-tab-menu').querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
    };
  });

  // Render Tabs Contents
  renderTimelineTabContent();
  renderLogsTabContent();
  renderEvaluationsTabContent();
  renderTrainingTabContent();
  renderCompletionCertificateTabContent();
}

// Tab 1: Timeline
function renderTimelineTabContent() {
  const { practitioner, rotations } = state.activePractitionerDetail;
  const container = document.getElementById('timeline-container');
  container.innerHTML = '';

  const managerActions = document.getElementById('timeline-actions-manager');
  const isManager = state.currentUser.role === 'Cán bộ quản lý';
  if (managerActions) {
    managerActions.style.display = isManager ? 'flex' : 'none';
  }

  if (!rotations || rotations.length === 0) {
    container.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:30px; width: 100%;">Chưa lên kế hoạch lộ trình luân khoa.</div>';
    return;
  }

  rotations.forEach((rot, index) => {
    const isCompleted = rot.status === 'Đã hoàn thành';
    const isActive = rot.status === 'Đang thực hành';
    
    const statusText = rot.status;
    const badgeClass = isCompleted ? 'badge-success' : (isActive ? 'badge-info' : 'badge-warning');

    const sDate = rot.start_date ? new Date(rot.start_date).toLocaleDateString('vi-VN') : 'Chưa định ngày';
    const eDate = rot.end_date ? new Date(rot.end_date).toLocaleDateString('vi-VN') : 'Chưa định ngày';

    let editButtons = '';
    if (isManager) {
      const isFirst = index === 0;
      const isLast = index === rotations.length - 1;
      editButtons = `
        <div style="margin-top: 8px; display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
          ${!isFirst ? `<button class="btn btn-secondary btn-move-up" style="padding: 2px 6px; font-size: 11px;"><i class="fas fa-chevron-up"></i> Lên</button>` : ''}
          ${!isLast ? `<button class="btn btn-secondary btn-move-down" style="padding: 2px 6px; font-size: 11px;"><i class="fas fa-chevron-down"></i> Xuống</button>` : ''}
          <button class="btn btn-secondary btn-edit-rot" style="padding: 2px 6px; font-size: 11px;"><i class="fas fa-pen"></i> Sửa</button>
          <button class="btn btn-secondary btn-del-rot" style="padding: 2px 6px; font-size: 11px; color: var(--danger);"><i class="fas fa-trash"></i> Xóa</button>
        </div>
      `;
    }

    const div = document.createElement('div');
    div.className = `timeline-item ${isCompleted ? 'completed' : (isActive ? 'active' : '')}`;
    div.innerHTML = `
      <div class="timeline-badge"></div>
      <div class="timeline-card" style="position: relative; width: 100%;">
        <div class="timeline-header" style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size:13.5px; color:var(--text-primary);">${rot.name}</strong>
          <span class="badge ${badgeClass}">${statusText}</span>
        </div>
        <div class="timeline-desc" style="font-size:12px; color:var(--text-secondary); margin-top: 4px;">
          Thời gian quy định: <strong>${rot.duration}</strong><br>
          Kế hoạch: Từ <strong>${sDate}</strong> đến <strong>${eDate}</strong><br>
          Bác sĩ hướng dẫn: <strong>${rot.supervisor_name || 'Chưa phân công'}</strong>
        </div>
        ${editButtons}
      </div>
    `;

    if (isManager) {
      div.querySelector('.btn-edit-rot')?.addEventListener('click', () => {
        openEditRotationStageModal(rot);
      });
      div.querySelector('.btn-del-rot')?.addEventListener('click', async () => {
        if (confirm(`Xóa giai đoạn luân khoa ${rot.name}?`)) {
          try {
            const res = await fetch(`/api/rotations/${rot.id}`, { method: 'DELETE' });
            if (res.ok) {
              await refreshActivePractitionerDetail();
              renderTimelineTabContent();
            } else {
              alert('Lỗi khi xóa giai đoạn');
            }
          } catch (err) {
            console.error(err);
          }
        }
      });
      div.querySelector('.btn-move-up')?.addEventListener('click', async () => {
        const newOrder = rotations.map(r => r.id);
        const temp = newOrder[index];
        newOrder[index] = newOrder[index - 1];
        newOrder[index - 1] = temp;
        await reorderRotations(newOrder);
      });
      div.querySelector('.btn-move-down')?.addEventListener('click', async () => {
        const newOrder = rotations.map(r => r.id);
        const temp = newOrder[index];
        newOrder[index] = newOrder[index + 1];
        newOrder[index + 1] = temp;
        await reorderRotations(newOrder);
      });
    }

    container.appendChild(div);
  });
}

async function reorderRotations(rotationIds) {
  try {
    const res = await fetch('/api/rotations/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotationIds })
    });
    if (res.ok) {
      await refreshActivePractitionerDetail();
      renderTimelineTabContent();
    } else {
      const err = await res.json();
      alert('Lỗi sắp xếp: ' + err.error);
    }
  } catch (err) {
    alert('Lỗi kết nối: ' + err.message);
  }
}

let rotationIdToEdit = null;

async function refreshActivePractitionerDetail() {
  const id = state.activePractitionerDetail.practitioner.id;
  const pracRes = await fetch(`/api/practitioners/${id}`);
  const practitioner = await pracRes.json();

  const logsRes = await fetch(`/api/logs?practitionerId=${id}`);
  const logs = await logsRes.json();

  const evalsRes = await fetch(`/api/evaluations?practitionerId=${id}`);
  const evaluations = await evalsRes.json();

  const trainRes = await fetch(`/api/training?practitionerId=${id}`);
  const training = await trainRes.json();

  const rotationsRes = await fetch(`/api/practitioners/${id}/rotations`);
  const rotations = await rotationsRes.json();

  state.activePractitionerDetail = { practitioner, logs, evaluations, training, rotations };
}

function getSpecialtyKeywordFromRotationName(rotName) {
  const nameLower = (rotName || '').toLowerCase();
  if (nameLower.includes('nội')) return 'nội';
  if (nameLower.includes('ngoại')) return 'ngoại';
  if (nameLower.includes('nhi')) return 'nhi';
  if (nameLower.includes('sản')) return 'sản';
  if (nameLower.includes('tai mũi họng')) return 'tai mũi họng';
  if (nameLower.includes('răng hàm mặt')) return 'răng hàm mặt';
  if (nameLower.includes('mắt')) return 'mắt';
  if (nameLower.includes('y học cổ truyền')) return 'y học cổ truyền';
  if (nameLower.includes('da liễu')) return 'da liễu';
  if (nameLower.includes('hồi sức') || nameLower.includes('cấp cứu')) return 'hồi sức';
  if (nameLower.includes('xét nghiệm')) return 'xét nghiệm';
  if (nameLower.includes('hình ảnh')) return 'hình ảnh';
  if (nameLower.includes('vật lý trị liệu') || nameLower.includes('phục hồi chức năng') || nameLower.includes('phcn')) return 'phục hồi';
  return null;
}

function isSupervisorMatchingRotation(s, keyword) {
  if (!keyword) return true; // show all if no keyword is found
  const specialtyLower = (s.specialty || '').toLowerCase();
  const departmentLower = (s.department || '').toLowerCase();
  
  if (keyword === 'nội') {
    return specialtyLower.includes('nội') || departmentLower.includes('nội');
  }
  if (keyword === 'ngoại') {
    return specialtyLower.includes('ngoại') || departmentLower.includes('ngoại');
  }
  if (keyword === 'nhi') {
    return specialtyLower.includes('nhi') || departmentLower.includes('nhi');
  }
  if (keyword === 'sản') {
    return specialtyLower.includes('sản') || departmentLower.includes('sản');
  }
  if (keyword === 'tai mũi họng') {
    return specialtyLower.includes('tai mũi họng') || departmentLower.includes('tai mũi họng');
  }
  if (keyword === 'răng hàm mặt') {
    return specialtyLower.includes('răng hàm mặt') || departmentLower.includes('răng hàm mặt');
  }
  if (keyword === 'mắt') {
    return specialtyLower.includes('mắt') || departmentLower.includes('mắt');
  }
  if (keyword === 'y học cổ truyền') {
    return specialtyLower.includes('y học cổ truyền') || departmentLower.includes('y học cổ truyền');
  }
  if (keyword === 'da liễu') {
    return specialtyLower.includes('da liễu') || departmentLower.includes('da liễu');
  }
  if (keyword === 'hồi sức') {
    return specialtyLower.includes('hồi sức') || specialtyLower.includes('cấp cứu') || departmentLower.includes('hồi sức') || departmentLower.includes('cấp cứu');
  }
  if (keyword === 'xét nghiệm') {
    return specialtyLower.includes('xét nghiệm') || departmentLower.includes('xét nghiệm');
  }
  if (keyword === 'hình ảnh') {
    return specialtyLower.includes('hình ảnh') || departmentLower.includes('hình ảnh');
  }
  if (keyword === 'phục hồi') {
    return specialtyLower.includes('phục hồi') || specialtyLower.includes('vật lý trị liệu') || departmentLower.includes('phục hồi') || departmentLower.includes('vật lý trị liệu');
  }
  return true;
}

function populateSupervisorSelect(selectedId, rotationName) {
  const selectSup = document.getElementById('stage-supervisor');
  if (!selectSup) return;
  
  selectSup.innerHTML = '<option value="">-- Chọn bác sĩ hướng dẫn --</option>';
  
  const keyword = getSpecialtyKeywordFromRotationName(rotationName);
  
  if (state.supervisors) {
    state.supervisors.forEach(s => {
      if (isSupervisorMatchingRotation(s, keyword)) {
        selectSup.innerHTML += `<option value="${s.id}">${s.name} (${s.specialty} - ${s.department || 'Khoa tự do'})</option>`;
      }
    });
  }
  
  selectSup.value = selectedId || '';
}

// Bind live filtering to the stage-name input
document.addEventListener('DOMContentLoaded', () => {
  const stageNameInput = document.getElementById('stage-name');
  if (stageNameInput) {
    stageNameInput.addEventListener('input', (e) => {
      const currentSelectVal = document.getElementById('stage-supervisor').value;
      populateSupervisorSelect(currentSelectVal, e.target.value);
    });
  }
});

function openAddRotationStageModal() {
  rotationIdToEdit = null;
  const modal = document.getElementById('modal-timeline-stage');
  document.getElementById('timeline-stage-modal-title').innerText = 'Thêm Giai đoạn Luân khoa Mới';
  document.getElementById('form-timeline-stage').reset();
  
  const nextOrder = state.activePractitionerDetail.rotations.length;
  document.getElementById('stage-order').value = nextOrder;

  // Populate supervisor select with all initially
  populateSupervisorSelect('', '');

  modal.classList.add('active');
}

function openEditRotationStageModal(rot) {
  rotationIdToEdit = rot.id;
  const modal = document.getElementById('modal-timeline-stage');
  document.getElementById('timeline-stage-modal-title').innerText = 'Cập nhật Giai đoạn Luân khoa';
  
  document.getElementById('stage-name').value = rot.name;
  document.getElementById('stage-duration').value = rot.duration;
  document.getElementById('stage-status').value = rot.status;
  document.getElementById('stage-start').value = rot.start_date ? new Date(rot.start_date).toISOString().split('T')[0] : '';
  document.getElementById('stage-end').value = rot.end_date ? new Date(rot.end_date).toISOString().split('T')[0] : '';
  document.getElementById('stage-order').value = rot.order_index;

  // Populate supervisor select, filtering by the current stage name
  populateSupervisorSelect(rot.supervisor_id, rot.name);

  modal.classList.add('active');
}

// Tab 2: Daily Logs
function renderLogsTabContent() {
  const { logs } = state.activePractitionerDetail;
  const container = document.getElementById('logs-list-container');
  container.innerHTML = '';

  if (logs.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">Chưa có nhật ký lâm sàng hằng ngày</td></tr>';
    return;
  }

  logs.forEach(l => {
    const tr = document.createElement('tr');
    const dateStr = new Date(l.log_date).toLocaleDateString('vi-VN');

    let badgeClass = 'badge-warning';
    if (l.status === 'Đã xác nhận') badgeClass = 'badge-success';
    else if (l.status === 'Yêu cầu sửa') badgeClass = 'badge-danger';

    let actionCell = '';
    if (state.currentUser.role === 'Người hướng dẫn' && l.status !== 'Đã xác nhận') {
      actionCell = `<button class="btn btn-secondary btn-verify-log" style="padding:4px 8px; font-size:11px;">Duyệt</button>`;
    } else if (l.status === 'Đã xác nhận') {
      actionCell = `<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>`;
    }

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td><span class="badge badge-info">${l.department}</span></td>
      <td style="max-width:300px; font-size:12.5px;">${l.content}</td>
      <td style="font-size:12.5px;">${l.procedures ? `${l.procedures} (x${l.quantity})` : 'N/A'}</td>
      <td>
        <span class="badge ${badgeClass}">${l.status}</span>
        ${l.supervisor_comment ? `<br><small style="color:var(--text-secondary); font-style:italic;">Nhận xét: ${l.supervisor_comment}</small>` : ''}
      </td>
      <td>${actionCell}</td>
    `;

    tr.querySelector('.btn-verify-log')?.addEventListener('click', () => {
      openVerifyLogModal(l.id, dateStr);
    });

    container.appendChild(tr);
  });
}

// Daily Log Submission B.01
document.getElementById('btn-add-log').addEventListener('click', () => {
  document.getElementById('form-add-log').reset();
  document.getElementById('log-date').value = new Date().toISOString().substring(0, 10);
  document.getElementById('modal-add-log').classList.add('active');
});
document.getElementById('form-add-log').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    practitioner_id: state.activePractitionerDetail.practitioner.id,
    log_date: document.getElementById('log-date').value,
    department: document.getElementById('log-department').value,
    content: document.getElementById('log-content').value,
    procedures: document.getElementById('log-procedures').value,
    quantity: parseInt(document.getElementById('log-quantity').value)
  };

  try {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      document.getElementById('modal-add-log').classList.remove('active');
      await viewPractitionerDetail(state.activePractitionerDetail.practitioner.id);
    }
  } catch (err) {
    console.error(err);
  }
});

// Verify Log B.02
let logIdToVerify = null;
function openVerifyLogModal(id, dateText) {
  logIdToVerify = id;
  document.getElementById('form-approve-log').reset();
  document.getElementById('modal-approve-log').classList.add('active');
}
document.getElementById('form-approve-log').addEventListener('submit', async (e) => {
  e.preventDefault();
  const updateData = {
    status: document.getElementById('app-log-status').value,
    supervisor_comment: document.getElementById('app-log-comment').value
  };

  try {
    const res = await fetch(`/api/logs/${logIdToVerify}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    if (res.ok) {
      document.getElementById('modal-approve-log').classList.remove('active');
      await viewPractitionerDetail(state.activePractitionerDetail.practitioner.id);
    }
  } catch (err) {
    console.error(err);
  }
});

// Tab 3: Evaluations C.01/C.02
function renderEvaluationsTabContent() {
  const { evaluations } = state.activePractitionerDetail;
  const container = document.getElementById('evaluations-list-container');
  container.innerHTML = '';

  if (evaluations.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">Chưa có phiếu đánh giá định kỳ/cuối khóa</td></tr>';
    return;
  }

  evaluations.forEach(e => {
    const tr = document.createElement('tr');
    const evalDate = new Date(e.evaluation_date).toLocaleDateString('vi-VN');

    let detailedHTML = '';
    if (e.rating_knowledge) {
      detailedHTML = `
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color); font-size: 11.5px; color: var(--text-secondary);">
          <strong>Đánh giá năng lực giai đoạn (Bảng 1):</strong><br>
          Kiến thức: <strong>${e.rating_knowledge}</strong> | Kỹ năng: <strong>${e.rating_skills}</strong> | Kinh nghiệm: <strong>${e.rating_experience}</strong><br>
          Học hỏi: <strong>${e.rating_growth}</strong> | Thái độ: <strong>${e.rating_attitude}</strong> | Kỷ luật: <strong>${e.rating_discipline}</strong>
        </div>
      `;
    }

    tr.innerHTML = `
      <td><strong>${e.evaluation_type}</strong><br><span style="font-size:11px; color:var(--text-secondary);">${e.department}</span></td>
      <td style="font-size:12px; line-height: 1.5;">
        Chuyên môn: <strong>${e.rating_specialty}</strong> | Y đức: <strong>${e.rating_ethics}</strong><br>
        Pháp luật: <strong>${e.rating_law}</strong> | Giao tiếp: <strong>${e.rating_communication}</strong><br>
        An toàn bệnh nhân: <strong>${e.rating_safety}</strong>
        ${detailedHTML}
      </td>
      <td><span class="badge ${e.result === 'Đạt' ? 'badge-success' : 'badge-danger'}">${e.result}</span></td>
      <td style="max-width:250px; font-size:12.5px;">${e.comment || ''}</td>
      <td style="font-size:12px;">${e.evaluator_name || 'N/A'}<br><small style="color:var(--text-light);">${evalDate}</small></td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-print-eval" style="padding: 4px 8px; font-size: 11.5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
          <i class="fa-solid fa-print"></i> Xem & In
        </button>
      </td>
    `;

    tr.querySelector('.btn-print-eval').addEventListener('click', () => {
      const pContainer = document.getElementById('print-container');
      const supervisor = state.supervisors.find(s => s.id === e.evaluator_id);
      const rotation = state.activePractitionerDetail.rotations.find(r => r.name === e.department);
      
      pContainer.innerHTML = Templates.generateStageEvaluationForm(
        state.activePractitionerDetail.practitioner,
        supervisor,
        e,
        rotation
      );
      window.print();
    });

    container.appendChild(tr);
  });
}

// Filter evaluators by department specialty
function filterEvaluatorDropdownByDepartment(selectedDeptName) {
  const selectEval = document.getElementById('eval-evaluator');
  selectEval.innerHTML = '';
  
  const keyword = getSpecialtyKeywordFromRotationName(selectedDeptName);
  const filteredSups = state.supervisors.filter(s => isSupervisorMatchingRotation(s, keyword));
  
  if (filteredSups.length === 0) {
    selectEval.innerHTML = '<option value="">(Không có người hướng dẫn phù hợp chuyên khoa)</option>';
  } else {
    filteredSups.forEach(s => {
      selectEval.innerHTML += `<option value="${s.id}">${s.name} (${s.specialty} - ${s.department || 'Khoa tự do'})</option>`;
    });
  }

  // If supervisor is logged in, auto-select and lock the evaluator field
  if (state.currentUser.role === 'Người hướng dẫn' && state.currentSupervisor) {
    selectEval.value = state.currentSupervisor.id;
    selectEval.disabled = true;
  } else {
    selectEval.disabled = false;
    if (state.activePractitionerDetail.practitioner.supervisor_id && filteredSups.some(s => s.id === state.activePractitionerDetail.practitioner.supervisor_id)) {
      selectEval.value = state.activePractitionerDetail.practitioner.supervisor_id;
    }
  }
}

// Add Evaluation C.01
document.getElementById('btn-add-evaluation').addEventListener('click', () => {
  document.getElementById('form-add-evaluation').reset();
  const selectDept = document.getElementById('eval-department');
  
  selectDept.innerHTML = '';
  // Dynamically populate actual rotation stages of practitioner if available
  if (state.activePractitionerDetail.rotations && state.activePractitionerDetail.rotations.length > 0) {
    state.activePractitionerDetail.rotations.forEach(r => {
      selectDept.innerHTML += `<option value="${r.name}">${r.name}</option>`;
    });
  } else {
    // Fallback default
    if (state.activePractitionerDetail.practitioner.program === 'TT21') {
      ['Nội', 'Ngoại', 'Sản', 'Nhi', 'Khác'].forEach(dept => {
        selectDept.innerHTML += `<option value="${dept}">${dept}</option>`;
      });
    } else {
      ['Chuyên môn', 'Hồi sức cấp cứu'].forEach(dept => {
        selectDept.innerHTML += `<option value="${dept}">${dept}</option>`;
      });
    }
  }
  // Always allow global/final evaluation option
  selectDept.innerHTML += `<option value="Đánh giá chung">Đánh giá chung</option>`;

  // Filter initially
  filterEvaluatorDropdownByDepartment(selectDept.value);

  // Hook change event
  selectDept.onchange = (e) => {
    filterEvaluatorDropdownByDepartment(e.target.value);
  };

  document.getElementById('modal-add-evaluation').classList.add('active');
});
document.getElementById('form-add-evaluation').addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectEval = document.getElementById('eval-evaluator');
  
  const formData = {
    practitioner_id: state.activePractitionerDetail.practitioner.id,
    department: document.getElementById('eval-department').value,
    evaluation_type: document.getElementById('eval-type').value,
    rating_specialty: document.getElementById('eval-spec').value,
    rating_ethics: document.getElementById('eval-ethics').value,
    rating_law: document.getElementById('eval-law').value,
    rating_communication: document.getElementById('eval-comm').value,
    rating_safety: document.getElementById('eval-safety').value,
    result: document.getElementById('eval-result').value,
    comment: document.getElementById('eval-comment').value,
    evaluator_id: parseInt(selectEval.value),
    rating_knowledge: document.getElementById('eval-knowledge').value,
    rating_skills: document.getElementById('eval-skills').value,
    rating_experience: document.getElementById('eval-experience').value,
    rating_growth: document.getElementById('eval-growth').value,
    rating_attitude: document.getElementById('eval-attitude').value,
    rating_discipline: document.getElementById('eval-discipline').value
  };

  try {
    const res = await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      document.getElementById('modal-add-evaluation').classList.remove('active');
      await viewPractitionerDetail(state.activePractitionerDetail.practitioner.id);
    }
  } catch (err) {
    console.error(err);
  }
});

// Tab 4: Supplemental Training sessions
function renderTrainingTabContent() {
  const { training } = state.activePractitionerDetail;
  const container = document.getElementById('training-list-container');
  container.innerHTML = '';

  const totalSessions = training.length;
  document.getElementById('train-completed-count').innerText = totalSessions;
  document.getElementById('train-target-count').innerText = 20;

  const percent = Math.min((totalSessions / 20) * 100, 100);
  document.getElementById('train-percent-text').innerText = `${percent.toFixed(0)}%`;
  document.getElementById('train-progress-bar').style.width = `${percent}%`;

  if (training.length === 0) {
    container.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-secondary);">Chưa ghi nhận lớp đào tạo bổ trợ lý thuyết</td></tr>';
    return;
  }

  training.forEach(t => {
    const tr = document.createElement('tr');
    const dateStr = new Date(t.session_date).toLocaleDateString('vi-VN');

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td style="font-weight:600; font-size:12.5px;">${t.topic}</td>
      <td>${t.hours} giờ</td>
      <td>${t.speaker || 'N/A'}</td>
      <td>
        ${state.currentUser.role === 'Cán bộ quản lý' ? `<button class="btn-icon btn-del-train"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    `;

    tr.querySelector('.btn-del-train')?.addEventListener('click', async () => {
      if (confirm('Xóa buổi đào tạo này?')) {
        await fetch(`/api/training/${t.id}`, { method: 'DELETE' });
        await viewPractitionerDetail(state.activePractitionerDetail.practitioner.id);
      }
    });

    container.appendChild(tr);
  });
}

// Add Training
document.getElementById('btn-add-training').addEventListener('click', () => {
  document.getElementById('form-add-training').reset();
  document.getElementById('modal-add-training').classList.add('active');
});
document.getElementById('form-add-training').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    practitioner_id: state.activePractitionerDetail.practitioner.id,
    session_date: document.getElementById('train-date').value,
    topic: document.getElementById('train-topic').value,
    hours: parseInt(document.getElementById('train-hours').value),
    speaker: document.getElementById('train-speaker').value
  };

  try {
    const res = await fetch('/api/training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      document.getElementById('modal-add-training').classList.remove('active');
      await viewPractitionerDetail(state.activePractitionerDetail.practitioner.id);
    }
  } catch (err) {
    console.error(err);
  }
});

// Tab 5: Complete & Certify (Module D)
function renderCompletionCertificateTabContent() {
  const { practitioner, logs, evaluations, training } = state.activePractitionerDetail;
  const container = document.getElementById('cert-checklist');
  container.innerHTML = '';

  const checklist = [];

  // 1. Time Elapsed check
  let requiredMonths = practitioner.specialty === 'Bác sĩ' ? 12 : 6;
  if (practitioner.program === 'TT21') requiredMonths = 18;
  else if (practitioner.specialty === 'Y sĩ' || practitioner.specialty === 'Tâm lý lâm sàng') requiredMonths = 9;

  const startDate = new Date(practitioner.start_date);
  const diffTime = Math.abs(new Date() - startDate);
  const elapsedMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
  const timeMet = elapsedMonths >= requiredMonths;
  checklist.push({
    text: `Đủ thời gian thực hành theo Luật định (${requiredMonths} tháng). Hiện tại: ${elapsedMonths.toFixed(1)} tháng.`,
    met: timeMet
  });

  // 2. Approved Logs check
  const totalLogs = logs.length;
  const approvedLogs = logs.filter(l => l.status === 'Đã xác nhận').length;
  const logsMet = totalLogs > 0 && approvedLogs === totalLogs;
  checklist.push({
    text: `Tất cả nhật ký lâm sàng hằng ngày đã được xác nhận (${approvedLogs}/${totalLogs} nhật ký).`,
    met: logsMet
  });

  // 3. Evaluations checks
  const finalEval = evaluations.find(e => e.evaluation_type === 'Cuối khóa' && e.result === 'Đạt');
  const evalMet = !!finalEval;
  checklist.push({
    text: `Đã có phiếu đánh giá tổng kết cuối khóa đạt năng lực chuyên môn & y đức.`,
    met: evalMet
  });

  // 4. Theory classes hours check
  const totalHours = training.reduce((sum, item) => sum + item.hours, 0);
  const theoryMet = training.length >= 20 && totalHours >= state.config.minHours;
  checklist.push({
    text: `Hoàn thành 20 buổi học lý thuyết bổ trợ bắt buộc (${training.length}/20 buổi, tổng số ${totalHours}/${state.config.minHours} giờ).`,
    met: theoryMet
  });

  // Render check UI list
  let allConditionsMet = true;
  checklist.forEach(item => {
    if (!item.met) allConditionsMet = false;
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '12px';
    div.style.padding = '8px 12px';
    div.style.backgroundColor = item.met ? 'var(--success-light)' : 'var(--bg-primary)';
    div.style.border = `1px solid ${item.met ? 'var(--success)' : 'var(--border-color)'}`;
    div.style.borderRadius = 'var(--radius-md)';
    div.style.fontSize = '13px';
    div.innerHTML = `
      <i class="fas ${item.met ? 'fa-check-circle' : 'fa-times-circle'}" style="color: ${item.met ? 'var(--success)' : 'var(--danger)'}; font-size:16px;"></i>
      <span style="color: ${item.met ? 'var(--text-primary)' : 'var(--text-secondary)'};">${item.text}</span>
    `;
    container.appendChild(div);
  });

  // Render Competency test box information
  const testBadge = document.getElementById('det-test-badge');
  const testInfoText = document.getElementById('det-test-info');
  
  if (practitioner.national_test_result === 'Đạt') {
    testBadge.innerText = 'Thi Đạt';
    testBadge.className = 'badge badge-success';
    testInfoText.innerText = `Học viên đã Đạt kỳ kiểm tra đánh giá năng lực lâm sàng ngày ${new Date(practitioner.national_test_date).toLocaleDateString('vi-VN')} với điểm số: ${practitioner.national_test_score}.`;
  } else if (practitioner.national_test_result === 'Không đạt') {
    testBadge.innerText = 'Thi Hỏng';
    testBadge.className = 'badge badge-danger';
    testInfoText.innerText = `Thi không đạt kỳ kiểm tra ngày ${new Date(practitioner.national_test_date).toLocaleDateString('vi-VN')} (Điểm số: ${practitioner.national_test_score}). Cần ôn luyện thi lại.`;
  } else {
    testBadge.innerText = 'Chưa thi';
    testBadge.className = 'badge badge-warning';
    testInfoText.innerText = 'Chưa ghi nhận kết quả thi năng lực y khoa quốc gia.';
  }

  // Draw national exam controller buttons for manager
  const testControls = document.getElementById('manager-test-controls');
  testControls.innerHTML = '';
  if (state.currentUser.role === 'Cán bộ quản lý') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.style.padding = '4px 8px';
    btn.style.fontSize = '12px';
    btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Nhập kết quả thi';
    btn.onclick = () => openNationalTestModal(practitioner.id);
    testControls.appendChild(btn);
  }

  // Manage print certificate buttons activation
  const printCertBtn = document.getElementById('btn-print-certificate');
  const printAppBtn = document.getElementById('btn-print-appform');
  const exportZipBtn = document.getElementById('btn-export-zip');

  const isEligibleForCert = allConditionsMet;
  const isEligibleForLicence = allConditionsMet && practitioner.national_test_result === 'Đạt';

  // Mẫu 07 (Giấy xác nhận)
  if (isEligibleForCert) {
    printCertBtn.disabled = false;
    printCertBtn.classList.remove('btn-secondary');
    printCertBtn.classList.add('btn-primary');
    printCertBtn.innerHTML = '<i class="fa-solid fa-print"></i> In Giấy xác nhận (Mẫu 07)';
    printCertBtn.onclick = () => {
      const pContainer = document.getElementById('print-container');
      const sup = state.supervisors.find(s => s.id === practitioner.supervisor_id);
      pContainer.innerHTML = practitioner.program === 'ND96' 
        ? Templates.generateDecree96Certificate(practitioner, sup, evaluations, training)
        : Templates.generateCircular21Certificate(practitioner, sup, evaluations);
      window.print();
    };
  } else {
    printCertBtn.disabled = true;
    printCertBtn.classList.add('btn-secondary');
    printCertBtn.classList.remove('btn-primary');
    printCertBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Chưa đủ điều kiện cấp Giấy xác nhận';
    printCertBtn.onclick = null;
  }

  // Mẫu 08 (Đơn đề nghị cấp phép)
  if (isEligibleForLicence) {
    printAppBtn.disabled = false;
    printAppBtn.classList.remove('btn-secondary');
    printAppBtn.classList.add('btn-primary');
    printAppBtn.innerHTML = '<i class="fa-solid fa-print"></i> In Đơn đề nghị (Mẫu 08)';
    printAppBtn.onclick = () => {
      const pContainer = document.getElementById('print-container');
      pContainer.innerHTML = Templates.generateDecree96ApplicationForm(practitioner);
      window.print();
    };

    // Export ZIP
    exportZipBtn.disabled = false;
    exportZipBtn.classList.remove('btn-secondary');
    exportZipBtn.classList.add('btn-primary');
    exportZipBtn.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Đóng gói & Xuất bộ hồ sơ (ZIP)';
    exportZipBtn.onclick = () => exportZipArchive(practitioner, evaluations, training);
  } else {
    printAppBtn.disabled = true;
    printAppBtn.classList.add('btn-secondary');
    printAppBtn.classList.remove('btn-primary');
    printAppBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Chưa đủ điều kiện lập đơn đề nghị (Mẫu 08)';
    printAppBtn.onclick = null;

    exportZipBtn.disabled = true;
    exportZipBtn.classList.add('btn-secondary');
    exportZipBtn.classList.remove('btn-primary');
    exportZipBtn.onclick = null;
  }
}

// C.03: Competency Test score modal logger
let practitionerIdForTest = null;
function openNationalTestModal(id) {
  practitionerIdForTest = id;
  document.getElementById('form-national-test').reset();
  document.getElementById('test-date').value = new Date().toISOString().substring(0, 10);
  document.getElementById('modal-national-test').classList.add('active');
}
document.getElementById('form-national-test').addEventListener('submit', async (e) => {
  e.preventDefault();
  const testData = {
    score: parseFloat(document.getElementById('test-score').value),
    result: document.getElementById('test-result').value,
    test_date: document.getElementById('test-date').value
  };

  try {
    const res = await fetch(`/api/practitioners/${practitionerIdForTest}/national-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    if (res.ok) {
      document.getElementById('modal-national-test').classList.remove('active');
      await refreshData();
      await viewPractitionerDetail(state.activePractitionerDetail.practitioner.id);
    }
  } catch (err) {
    console.error(err);
  }
});

// D.04: ZIP package export generator
async function exportZipArchive(practitioner, evaluations, training) {
  const sup = state.supervisors.find(s => s.id === practitioner.supervisor_id);
  
  const m07Html = Templates.generateDecree96Certificate(practitioner, sup, evaluations, training);
  const m08Html = Templates.generateDecree96ApplicationForm(practitioner);

  try {
    const zip = new JSZip();
    
    zip.file("Mau_07_Giay_Xac_Nhan_Thuc_Hanh.html", `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Mẫu số 07 - TTYT Liên Chiểu</title>
          <style>
            body { font-family: "Times New Roman", serif; padding: 20px; line-height: 1.5; }
            .cert-header { display: flex; justify-content: space-between; }
            .cert-title { text-align: center; font-weight: bold; font-size: 20px; margin: 30px 0; }
            .cert-info-table { width: 100%; border-collapse: collapse; }
            .cert-info-table td { padding: 6px; }
            .cert-evaluation { border: 1px solid black; padding: 15px; margin-top: 20px; }
            .cert-footer { display: flex; justify-content: space-between; margin-top: 40px; }
          </style>
        </head>
        <body>${m07Html}</body>
      </html>
    `);

    zip.file("Mau_08_Don_De_Nghi_Cap_GPHN.html", `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Mẫu số 08 - Đơn đề nghị</title>
          <style>
            body { font-family: "Times New Roman", serif; padding: 20px; line-height: 1.5; }
            .cert-header { display: flex; justify-content: space-between; }
            .cert-title { text-align: center; font-weight: bold; font-size: 20px; margin: 30px 0; }
            .cert-info-table { width: 100%; border-collapse: collapse; }
            .cert-info-table td { padding: 6px; }
            .cert-footer { display: flex; justify-content: space-between; margin-top: 40px; }
          </style>
        </head>
        <body>${m08Html}</body>
      </html>
    `);

    // Add scans files if they exist in state
    if (practitioner.degree_scan_url && practitioner.degree_scan_url.startsWith('data:')) {
      const degreeData = practitioner.degree_scan_url.split(',')[1];
      zip.file("Bằng_tốt_nghiệp_scan.png", degreeData, { base64: true });
    } else {
      zip.file("Bang_tot_nghiep_scan.pdf", "MOCK PDF: Scan of practitioner's professional graduation diploma.");
    }

    if (practitioner.avatar_url && practitioner.avatar_url.startsWith('data:')) {
      const avatarData = practitioner.avatar_url.split(',')[1];
      zip.file("Anh_the_chan_dung_4x6.png", avatarData, { base64: true });
    } else {
      zip.file("Anh_the_chan_dung_4x6.jpg", "MOCK PHOTO: Image file of practitioner 4x6 cm photo.");
    }

    zip.file("Giay_kham_suc_khoe.pdf", "MOCK PDF: Clinical health clearance certificate (Sở Y tế - 06 months validity).");

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `Ho_So_Xin_Cap_GPHN_Lien_Chieu_${practitioner.name.replace(/\s+/g, '_')}.zip`;
    link.click();

    alert('Đóng gói hồ sơ ZIP thành công! Bộ tài liệu bao gồm Mẫu 07, Mẫu 08, Ảnh 4x6, Bằng tốt nghiệp và Giấy khám sức khỏe sẵn sàng nộp lên Cổng Dịch vụ công Quốc gia.');
  } catch (err) {
    alert('Lỗi đóng gói: ' + err.message);
  }
}

// =========================================================================
// RENDER: NATIONAL EXAMS PANEL (Module C.03)
// =========================================================================
function renderNationalExamsList() {
  const container = document.getElementById('exams-list-container');
  container.innerHTML = '';

  const eligiblePracs = state.practitioners.filter(p => p.profile_status === 'Đã duyệt');

  if (eligiblePracs.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-secondary);">Chưa có học viên nào đủ hồ sơ để dự thi năng lực</td></tr>';
    return;
  }

  eligiblePracs.forEach(p => {
    const tr = document.createElement('tr');
    
    let resultBadge = '<span class="badge badge-warning">Chưa thi</span>';
    if (p.national_test_result === 'Đạt') {
      resultBadge = '<span class="badge badge-success">ĐẠT</span>';
    } else if (p.national_test_result === 'Không đạt') {
      resultBadge = '<span class="badge badge-danger">KHÔNG ĐẠT</span>';
    }

    const testDateText = p.national_test_date ? new Date(p.national_test_date).toLocaleDateString('vi-VN') : 'N/A';

    tr.innerHTML = `
      <td><strong>${p.name}</strong><br><small style="color:var(--text-secondary);">${p.degree}</small></td>
      <td>${p.specialty}</td>
      <td>${testDateText}</td>
      <td><span style="font-weight:700;">${p.national_test_score !== null ? p.national_test_score : 'N/A'}</span></td>
      <td>${resultBadge}</td>
      <td>
        <button class="btn btn-secondary btn-log-test" style="padding:4px 8px; font-size:12px;"><i class="fa-solid fa-square-plus"></i> Cập nhật điểm</button>
      </td>
    `;

    tr.querySelector('.btn-log-test').addEventListener('click', () => {
      openNationalTestModal(p.id);
    });

    container.appendChild(tr);
  });
}

// =========================================================================
// RENDER: SYSTEM ADMIN PANEL
// =========================================================================
function renderAdminPanel() {
  document.getElementById('cfg-late-alert').value = state.config.lateAlertDays;
  document.getElementById('cfg-min-hours').value = state.config.minHours;
}

document.getElementById('btn-save-sys-config').addEventListener('click', () => {
  state.config.lateAlertDays = parseInt(document.getElementById('cfg-late-alert').value);
  state.config.minHours = parseInt(document.getElementById('cfg-min-hours').value);
  alert('Đã cập nhật cấu hình hệ thống kiểm soát thực hành y khoa thành công!');
});

// Database Backup
document.getElementById('btn-sys-backup').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/system/backup', { method: 'POST' });
    const data = await res.json();
    document.getElementById('backup-status-text').innerHTML = `
      ✓ Đã tạo bản sao lưu lúc ${new Date(data.timestamp).toLocaleString('vi-VN')}.<br>
      Tóm tắt: ${data.summary.users} TK, ${data.summary.supervisors} NHD, ${data.summary.practitioners} HV, ${data.summary.logs} Nhật ký.
    `;
    alert(data.message);
  } catch (err) {
    alert('Lỗi sao lưu: ' + err.message);
  }
});

// Database Restore
document.getElementById('btn-sys-restore').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/system/restore', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      await refreshData();
      switchView('dashboard');
    } else {
      const err = await res.json();
      alert('Phục hồi thất bại: ' + err.error);
    }
  } catch (err) {
    alert('Lỗi kết nối: ' + err.message);
  }
});
