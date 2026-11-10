function labelForClass(dataClass) {
  const c = String(dataClass || 'UNAVAILABLE').toUpperCase();
  return c[0] + c.slice(1).toLowerCase();
}

function formatSoilItem(name, metric) {
  const value = metric.value === null || metric.value === undefined ? 'Unavailable' : `${metric.value} ${metric.unit}`;
  return `<li><strong>${name}:</strong> ${value} <span class="status">(${labelForClass(metric.class)})</span></li>`;
}

function formatRecommendation(item) {
  return `
    <article class="recommendation" aria-label="Recommendation ${item.title}">
      <p><strong>${item.title}</strong> · ${item.severity}</p>
      <p>${item.what}</p>
      <p class="status">Why: ${item.why}</p>
      <p class="status">Action: ${item.action} | When: ${item.when} | Confidence: ${item.confidence}</p>
    </article>`;
}

async function init() {
  const response = await fetch('/api/dashboard');
  const data = await response.json();

  document.getElementById('modeTag').textContent = data.metadata.mode;
  document.getElementById('farmSummary').textContent = `${data.farm.farmer.name} · ${data.farm.field.name} · ${data.farm.field.areaHa} ha · ${data.farm.crop.type} (${data.farm.crop.growthStage})`;

  document.getElementById('waterStatus').innerHTML = `
    <p><strong>Soil Moisture:</strong> ${data.modules.soil.moisture.value}${data.modules.soil.moisture.unit}</p>
    <p><strong>Estimated irrigation:</strong> ${data.modules.water.irrigation.grossIrrigationMm} mm (${data.modules.water.irrigation.requiredLitres} litres)</p>
    <p class="status">Method: ${data.modules.water.irrigation.method}</p>
  `;

  document.getElementById('soilList').innerHTML = [
    formatSoilItem('Moisture', data.modules.soil.moisture),
    formatSoilItem('Temperature', data.modules.soil.temperature),
    formatSoilItem('pH', data.modules.soil.ph),
    formatSoilItem('Nitrogen', data.modules.soil.nitrogen)
  ].join('');

  document.getElementById('recommendations').innerHTML = data.recommendations.length
    ? data.recommendations.map(formatRecommendation).join('')
    : '<p>No high-priority actions at the moment.</p>';
}

init().catch((error) => {
  document.getElementById('farmSummary').textContent = `Unable to load dashboard: ${error.message}`;
});
