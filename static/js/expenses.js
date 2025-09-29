const Expenses = (() => {
  let state = { categories: [], expenses: [], filtered: [], currentCategory: "" };

  const money = (n)=> (n??0).toLocaleString('vi-VN',{style:'currency',currency:'VND', maximumFractionDigits:0});

  async function loadSeed(url){ const r=await fetch(url); if(!r.ok) throw new Error('Không đọc được seed'); return r.json(); }

  function buildCategoryMenu(){
    const menu = document.getElementById("categoryMenu");
    // xoá các mục cũ ngoài item đầu
    menu.querySelectorAll("li:not(:first-child)").forEach(li=>li.remove());
    state.categories.forEach(cat=>{
      const li=document.createElement("li");
      li.innerHTML = `<a class="dropdown-item" data-value="${cat}">${cat}</a>`;
      menu.appendChild(li);
    });

    menu.addEventListener("click",(e)=>{
      const a=e.target.closest("a.dropdown-item"); if(!a) return;
      menu.querySelectorAll(".dropdown-item").forEach(x=>x.classList.remove("active"));
      a.classList.add("active");
      state.currentCategory = a.dataset.value || "";
      document.getElementById("categoryFilterBtn").textContent = state.currentCategory || "Tất cả danh mục";
      applyFilter();
    }, { once:true });
  }

  function applyFilter(){
    state.filtered = state.currentCategory
      ? state.expenses.filter(x=>x.category===state.currentCategory)
      : [...state.expenses];
    renderList(); calcKPI();
  }

  function calcKPI(){
    const total = state.filtered.reduce((s,x)=>s+Number(x.amount||0),0);
    const count = state.filtered.length;
    const avg = count? total/count : 0;
    document.getElementById("kpiTotal").textContent = money(total);
    document.getElementById("kpiCount").textContent = count;
    document.getElementById("kpiAvg").textContent   = money(avg);
  }

  function renderList(){
    const wrap = document.getElementById("txList");
    wrap.innerHTML = "";
    if(!state.filtered.length){
      wrap.innerHTML = `<div class="text-muted">Chưa có giao dịch.</div>`;
      return;
    }
    state.filtered.forEach((tx, idx)=>{
      const card = document.createElement("div");
      card.className = "card expense-card shadow-sm";
      card.innerHTML = `
        <div class="card-body d-flex align-items-start">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2">
              <div class="fw-semibold">${tx.desc}</div>
              <span class="badge bg-warning-subtle text-warning-emphasis">${tx.category}</span>
            </div>
            <div class="text-muted small mt-1">
              ${new Date(tx.date).toLocaleDateString('vi-VN')} · ${tx.method || "Tiền mặt"}
            </div>
          </div>
          <div class="text-end">
            <div class="fw-semibold text-danger">${money(tx.amount)}</div>
            <div class="mt-2 d-flex gap-2 justify-content-end">
              <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-idx="${idx}" title="Sửa">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" data-action="del" data-idx="${idx}" title="Xoá">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>`;
      wrap.appendChild(card);
    });
  }

  function setupForm(){
    const form = document.getElementById("txForm");
    if(!form) return;
    // fill danh mục
    form.category.innerHTML = state.categories.map(c=>`<option>${c}</option>`).join("");
    // submit
    form.addEventListener("submit",(e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const tx = Object.fromEntries(fd.entries());
      tx.amount = Number(tx.amount);
      state.expenses.unshift(tx);
      applyFilter();
      bootstrap.Modal.getInstance(document.getElementById("txModal")).hide();
      form.reset();
      toast("Đã lưu giao dịch.");
    });
  }

  function toast(msg){
    const el = document.getElementById('appToast'); if(!el) return;
    el.querySelector('.toast-body').textContent = msg;
    new bootstrap.Toast(el,{delay:1500}).show();
  }

  async function init(opts){
    // Mock data cho demo
    const mockCategories = ['Ăn uống', 'Di chuyển', 'Giải trí', 'Mua sắm', 'Học tập', 'Sức khỏe'];
    const mockExpenses = [
      { date: '2025-09-28', category: 'Ăn uống', desc: 'Cơm trưa', amount: 50000, method: 'Tiền mặt' },
      { date: '2025-09-27', category: 'Di chuyển', desc: 'Xe bus', amount: 15000, method: 'Tiền mặt' },
      { date: '2025-09-26', category: 'Giải trí', desc: 'Xem phim', amount: 120000, method: 'Thẻ' },
      { date: '2025-09-25', category: 'Ăn uống', desc: 'Coffee', amount: 45000, method: 'Tiền mặt' },
      { date: '2025-09-24', category: 'Mua sắm', desc: 'Quần áo', amount: 350000, method: 'Thẻ' },
      { date: '2025-09-23', category: 'Ăn uống', desc: 'Nhà hàng', amount: 200000, method: 'Thẻ' },
      { date: '2025-09-22', category: 'Di chuyển', desc: 'Grab', amount: 85000, method: 'Ví điện tử' },
      { date: '2025-09-21', category: 'Học tập', desc: 'Sách', amount: 150000, method: 'Tiền mặt' },
    ];
    
    if (opts?.seedUrl){
      const data = await loadSeed(opts.seedUrl);
      state.categories = data.categories || mockCategories;
      state.expenses   = (data.expenses || []).map(x=>({...x, method: x.method || "Tiền mặt"}));
    } else {
      // Sử dụng mock data
      state.expenses = mockExpenses;
      state.categories = mockCategories;
    }
    buildCategoryMenu(); setupForm(); applyFilter();
  }

  return { init };
})();
