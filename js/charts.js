let chartInstance = null;

export function renderTrendChart(canvas, points, label, unit) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  if (!canvas || !points.length) return null;

  const labels = points.map((p) => formatDateShort(p.date));
  const data = points.map((p) => p.value);

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: unit ? `${label} (${unit})` : label,
        data,
        borderColor: '#0f766e',
        backgroundColor: 'rgba(20, 184, 166, 0.15)',
        fill: true,
        tension: 0.25,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: false },
        x: { ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } } },
      },
    },
  });
  return chartInstance;
}

function formatDateShort(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}
