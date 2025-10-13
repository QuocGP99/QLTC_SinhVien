/* ===== Savings Goals page ===== */
(() => {
  const API_BASE = (window.BASE_API_URL || '/api').replace(/\/$/, '');
  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // ---- helpers ----
  const qs  = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => [...el.querySelectorAll(s)];
  const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN', { style:'currency', currency:'VND', maximumFractionDigits:0 });
  const pct = (cur, tgt) => tgt > 0 ? Math.min(100, Math.round(cur * 100 / tgt)) : 0;
  const isOverdue = (iso) => iso && new Date(iso) < new Date(new Date().toDateString());
  const monthsToGoal = (cur, tgt, m) => (m && m>0) ? Math.ceil(Math.max(0, (tgt-cur)/m)) : null;

  async function jfetch(url, opts={}) {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type':'application/json', ...authHeader, ...(opts.headers || {}) }
    });
    if (!res.ok) throw new Error(await res.text() || res.statusText);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  // ---- state ----
  let GOALS = [];

  // ---- UI renderers ----
  function renderKPIs(goals){
    const totalTarget = goals.reduce((s,g)=> s + Number(g.target_amount||0), 0);
    const totalSaved  = goals.reduce((s,g)=> s + Number(g.current_amount||0), 0);
    const monthly     = goals.reduce((s,g)=> s + Number(g.monthly_contribution||0), 0);
    qs('#totalSaved').textContent = fmtVND(totalSaved);
    qs('#totalTarget').textContent = fmtVND(totalTarget);
    qs('#monthlyCommitment').textContent = fmtVND(monthly);
    qs('#savedPercent').textContent = totalTarget>0 ? `${Math.round(totalSaved*100/totalTarget)}% của tổng mục tiêu` : '0% của tổng mục tiêu';
    qs('#activeGoals').textContent = `${goals.length} mục tiêu đang theo dõi`;
  }

  function badge(priority){
    const map = { high: ['Cao','danger'], medium:['Trung bình','warning'], low:['Thấp','success'] };
    const [text, color] = map[priority||'medium'] || map.medium;
    return `<span class="badge text-bg-${color} text-uppercase">${text}</span>`;
  }

  function goalCardHTML(g){
    const percent = pct(g.current_amount, g.target_amount);
    const overdue = isOverdue(g.target_date);
    const months  = monthsToGoal(g.current_amount, g.target_amount, g.monthly_contribution);
    const etaText = months!==null ? `Với tốc độ hiện tại, bạn sẽ đạt mục tiêu trong khoảng ${months} tháng` : 'Hãy thêm mức đóng góp hàng tháng để ước tính thời gian hoàn thành';

    return `
    <div class="col-lg-6">
      <div class="card goal-card shadow-sm" data-id="${g.id}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="d-flex align-items-center gap-2">
                <div class="goal-icon rounded-circle d-inline-flex justify-content-center align-items-center">
                  <i class="bi bi-piggy-bank"></i>
                </div>
                <div>
                  <h5 class="mb-0">${g.title}</h5>
                  <small class="text-muted">${g.description || ''}</small>
                </div>
              </div>
            </div>
            <div class="d-flex gap-2 align-items-center">
              ${badge(g.priority)}
              <button class="btn btn-sm btn-outline-secondary btn-edit" title="Sửa"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger btn-del" title="Xóa"><i class="bi bi-trash"></i></button>
            </div>
          </div>

          <div class="d-flex align-items-baseline mt-3">
            <div class="fs-5 fw-semibold me-2">${fmtVND(g.current_amount)}</div>
            <div class="text-muted">/ ${fmtVND(g.target_amount)}</div>
            ${overdue ? `<span class="ms-2 badge text-bg-danger">Quá hạn</span>` : ``}
          </div>

          <div class="progress my-2" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" style="height:10px">
            <div class="progress-bar" style="width:${percent}%"></div>
          </div>
          <div class="text-muted small mb-2">${percent}% hoàn thành</div>

          <div class="btn-group w-100 mb-2" role="group" aria-label="Quick add">
            <button class="btn btn-light btn-quick" data-amount="25000">+25k</button>
            <button class="btn btn-light btn-quick" data-amount="50000">+50k</button>
            <button class="btn btn-light btn-quick" data-amount="100000">+100k</button>
          </div>

          <div class="subtle-box">
            <i class="bi bi-graph-up-arrow me-2"></i>
            <span class="me-1">Đóng góp hàng tháng:</span>
            <strong>${fmtVND(g.monthly_contribution || 0)}</strong>
            <div class="small text-muted mt-1">${etaText}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderGoals(){
    const wrap = qs('#savingsList');
    wrap.innerHTML = GOALS.map(goalCardHTML).join('') || `
      <div class="col-12">
        <div class="alert alert-light border text-center">
          Chưa có mục tiêu nào. Hãy bấm <strong>Thêm mục tiêu</strong> để bắt đầu!
        </div>
      </div>`;
    attachCardHandlers();
    renderKPIs(GOALS);
  }

  // ---- load data ----
  async function loadGoals(){
    try {
      const data = await jfetch(`${API_BASE}/savings`, { method:'GET' });
      GOALS = (data.items || data || []).sort((a,b)=> (a.priority||'').localeCompare(b.priority||''));
    } catch (e) {
      console.warn('API /savings lỗi, dùng dữ liệu demo để hiển thị UI', e);
      // demo fallback để bạn thấy đúng UI (xóa khi BE sẵn sàng)
      GOALS = [
        {id:1,title:'Quỹ khẩn cấp',description:'3 tháng chi phí dự phòng',target_amount:20000000,current_amount:8470000,category:'emergency',priority:'high',target_date:'2025-10-01',monthly_contribution:200000},
        {id:2,title:'Laptop mới',description:'Phục vụ học tập & code',target_amount:12000000,current_amount:4000000,category:'tech',priority:'medium',target_date:'2025-10-01',monthly_contribution:150000},
        {id:3,title:'Du lịch mùa xuân',description:'Chuyến đi với bạn bè',target_amount:8000000,current_amount:2500000,category:'travel',priority:'low',target_date:'2025-10-01',monthly_contribution:100000},
        {id:4,title:'Quà tốt nghiệp',description:'Đồng hồ kỷ niệm',target_amount:5000000,current_amount:1250000,category:'gift',priority:'medium',target_date:'2025-10-01',monthly_contribution:75000}
      ];
    }
    renderGoals();
  }

  // ---- card actions ----
  function attachCardHandlers(){
    qsa('.goal-card').forEach(card => {
      const id = card.getAttribute('data-id');
      // quick add
      qsa('.btn-quick', card).forEach(btn => {
        btn.addEventListener('click', async () => {
          const amt = Number(btn.dataset.amount);
          try {
            // ưu tiên endpoint contribute nếu BE có
            try {
              await jfetch(`${API_BASE}/savings/${id}/contribute`, { method:'POST', body: JSON.stringify({ amount: amt }) });
            } catch {
              // fallback: PATCH tăng current_amount
              const g = GOALS.find(x=> String(x.id)===String(id));
              const payload = { current_amount: Number(g.current_amount||0) + amt };
              await jfetch(`${API_BASE}/savings/${id}`, { method:'PATCH', body: JSON.stringify(payload) });
            }
            await loadGoals();
          } catch (e) {
            console.error(e);
            showToast('Không thể cập nhật đóng góp', 'danger');
          }
        });
      });

      // edit
      qs('.btn-edit', card)?.addEventListener('click', () => openModalFor(id));
      // delete
      qs('.btn-del', card)?.addEventListener('click', async () => {
        if (!confirm('Xóa mục tiêu này?')) return;
        try {
          await jfetch(`${API_BASE}/savings/${id}`, { method:'DELETE' });
          await loadGoals();
        } catch (e) {
          showToast('Xóa không thành công', 'danger');
        }
      });
    });
  }

  // ---- modal create / edit ----
  const modal = new bootstrap.Modal(document.getElementById('goalModal'));
  qs('#newGoalBtn').addEventListener('click', () => openModalFor(null));
  qs('#saveGoalBtn').addEventListener('click', submitGoalForm);

  function fillForm(g){
    const f = qs('#goalForm');
    f.id.value                 = g?.id || '';
    f.title.value              = g?.title || '';
    f.description.value        = g?.description || '';
    f.target_amount.value      = g?.target_amount || '';
    f.current_amount.value     = g?.current_amount || 0;
    f.category.value           = g?.category || '';
    f.priority.value           = g?.priority || 'medium';
    f.target_date.value        = g?.target_date ? g.target_date.slice(0,10) : '';
    f.monthly_contribution.value = g?.monthly_contribution || 0;
  }

  function openModalFor(id){
    const editing = !!id;
    qs('#goalModalTitle').textContent = editing ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu tiết kiệm mới';
    fillForm(editing ? GOALS.find(g=>String(g.id)===String(id)) : null);
    modal.show();
  }

  async function submitGoalForm(){
    const f = qs('#goalForm');
    if (!f.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(f).entries());
    // convert numbers
    ['target_amount','current_amount','monthly_contribution'].forEach(k => payload[k] = Number(payload[k]||0));
    const id = payload.id; delete payload.id;

    try {
      if (id) {
        await jfetch(`${API_BASE}/savings/${id}`, { method:'PUT', body: JSON.stringify(payload) });
      } else {
        await jfetch(`${API_BASE}/savings`, { method:'POST', body: JSON.stringify(payload) });
      }
      modal.hide();
      await loadGoals();
      showToast('Đã lưu mục tiêu', 'success');
    } catch (e) {
      console.error(e);
      showToast('Lưu mục tiêu thất bại', 'danger');
    }
  }

  // ---- toast (dùng _toast.html nếu có, fallback alert) ----
  function showToast(msg, type='info'){
    const toastEl = document.getElementById('appToast');
    if (!toastEl) { alert(msg); return; }
    toastEl.querySelector('.toast-body').textContent = msg;
    toastEl.classList.remove('text-bg-success','text-bg-danger','text-bg-info','text-bg-warning');
    toastEl.classList.add(`text-bg-${type}`);
    bootstrap.Toast.getOrCreateInstance(toastEl).show();
  }

  // ---- boot ----
  document.addEventListener('DOMContentLoaded', loadGoals);
})();
