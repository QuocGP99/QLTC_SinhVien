// charts.js — Thin wrapper cho Chart.js
// Yêu cầu: đã load Chart.js UMD trước file này
// <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

const INSTANCES = new Map();

function getCtx(elOrId) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) throw new Error('Canvas element not found');
  return el.getContext('2d');
}
function recreate(elOrId, config) {
  const key = typeof elOrId === 'string' ? elOrId : (elOrId.id || elOrId);
  if (INSTANCES.has(key)) {
    try { INSTANCES.get(key).destroy(); } catch (_) {}
    INSTANCES.delete(key);
  }
  const chart = new window.Chart(getCtx(elOrId), config);
  INSTANCES.set(key, chart);
  return chart;
}
function fmtVND(v) {
  return (Number(v) || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
}
function mergeOptions(user = {}, moneyTooltip = true, legendDisplay = true) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: legendDisplay, position: 'bottom' },
      tooltip: moneyTooltip ? {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed?.y ?? ctx.parsed ?? 0;
            const lbl = ctx.dataset?.label ? `${ctx.dataset.label}: ` : '';
            return `${lbl}${fmtVND(val)}`;
          }
        }
      } : {}
    },
    scales: moneyTooltip ? {
      y: {
        ticks: {
          callback: (v) => fmtVND(v)
        }
      }
    } : {}
  };
  return Object.assign({}, base, user);
}

export function createLineChart(elOrId, data, options = {}) {
  return recreate(elOrId, {
    type: 'line',
    data,
    options: mergeOptions(options, true, options?.plugins?.legend?.display ?? true)
  });
}

export function createBarChart(elOrId, data, options = {}) {
  return recreate(elOrId, {
    type: 'bar',
    data,
    options: mergeOptions(options, true, options?.plugins?.legend?.display ?? false)
  });
}

export function createPieChart(elOrId, data, options = {}) {
  const opts = mergeOptions(options, false, true);
  opts.plugins = opts.plugins || {};
  opts.plugins.tooltip = {
    callbacks: { label: (ctx) => `${ctx.label}: ${fmtVND(ctx.parsed)}` }
  };
  return recreate(elOrId, {
    type: 'pie',
    data,
    options: opts
  });
}

export function destroyChart(elOrId) {
  const key = typeof elOrId === 'string' ? elOrId : (elOrId.id || elOrId);
  if (INSTANCES.has(key)) {
    try { INSTANCES.get(key).destroy(); } catch (_) {}
    INSTANCES.delete(key);
  }
}
