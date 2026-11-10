const DATA_CLASS = Object.freeze({
  MEASURED: 'MEASURED',
  OBSERVED: 'OBSERVED',
  ESTIMATED: 'ESTIMATED',
  PREDICTED: 'PREDICTED',
  UNAVAILABLE: 'UNAVAILABLE'
});

const KC_BY_STAGE = Object.freeze({
  initial: 0.7,
  development: 0.9,
  mid: 1.15,
  late: 0.8
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateReferenceET0({
  temperatureC,
  humidityPercent,
  windSpeedMps,
  solarRadiationMjM2Day
}) {
  const temp = Number(temperatureC ?? 25);
  const humidity = clamp(Number(humidityPercent ?? 60), 1, 100);
  const wind = Number(windSpeedMps ?? 2);
  const radiation = Number(solarRadiationMjM2Day ?? 18);

  const vaporPressureDeficitFactor = (100 - humidity) / 100;
  const et0 = 0.0023 * (temp + 17.8) * Math.sqrt(Math.max(temp, 1)) * (radiation / 2.45) * (1 + wind * 0.05) * (1 + vaporPressureDeficitFactor * 0.2);

  return Number(et0.toFixed(2));
}

function calculateIrrigationRecommendation({
  cropType,
  growthStage,
  fieldAreaHa,
  soilMoisturePercent,
  targetSoilMoisturePercent,
  rainfallMm,
  weather,
  irrigationEfficiency,
  pumpDischargeLitresPerHour
}) {
  const stage = growthStage && KC_BY_STAGE[growthStage] ? growthStage : 'development';
  const kc = KC_BY_STAGE[stage];
  const areaHa = Number(fieldAreaHa);
  const moisture = Number(soilMoisturePercent);
  const targetMoisture = Number(targetSoilMoisturePercent ?? 28);
  const effectiveRainfallMm = Number((Number(rainfallMm ?? 0) * 0.8).toFixed(2));
  const et0 = calculateReferenceET0(weather ?? {});
  const etcMmDay = Number((et0 * kc).toFixed(2));
  const moistureGapFraction = clamp((targetMoisture - moisture) / 100, 0, 1);
  const soilRefillMm = Number((moistureGapFraction * 120).toFixed(2));
  const netIrrigationMm = Number(Math.max(0, soilRefillMm + etcMmDay - effectiveRainfallMm).toFixed(2));
  const efficiency = clamp(Number(irrigationEfficiency ?? 0.75), 0.3, 0.95);
  const grossIrrigationMm = Number((netIrrigationMm / efficiency).toFixed(2));
  const litresPerMmPerHa = 10000;
  const requiredLitres = Number((grossIrrigationMm * litresPerMmPerHa * areaHa).toFixed(0));
  const pumpRate = Number(pumpDischargeLitresPerHour ?? 0);
  const estimatedDurationHours = pumpRate > 0 ? Number((requiredLitres / pumpRate).toFixed(2)) : null;

  return {
    cropType,
    growthStage: stage,
    method: 'FAO-56 inspired ETc calculation with crop coefficient and soil refill adjustment',
    assumptions: {
      effectiveRainfallFactor: 0.8,
      rootZoneRefillMmAt100PercentDeficit: 120,
      irrigationEfficiency: efficiency
    },
    et0MmDay: et0,
    etcMmDay,
    effectiveRainfallMm,
    netIrrigationMm,
    grossIrrigationMm,
    requiredLitres,
    estimatedDurationHours,
    confidence: moisture >= 0 ? 'MEDIUM' : 'LOW'
  };
}

function classifyValue(value, sourceType) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return DATA_CLASS.UNAVAILABLE;
  }

  const normalized = String(sourceType || '').toUpperCase();
  if (Object.values(DATA_CLASS).includes(normalized)) {
    return normalized;
  }

  return DATA_CLASS.ESTIMATED;
}

function buildRecommendations({ irrigation, weatherForecastRainMm }) {
  const recommendations = [];

  if (irrigation.netIrrigationMm > 0 && weatherForecastRainMm < 5) {
    recommendations.push({
      title: 'Irrigate field',
      severity: 'HIGH',
      what: `Estimated irrigation need is ${irrigation.grossIrrigationMm} mm (${irrigation.requiredLitres} litres).`,
      why: 'Soil moisture deficit and crop evapotranspiration indicate likely stress risk.',
      when: 'Within 24 hours',
      action: 'Run irrigation cycle and log applied water volume.',
      confidence: irrigation.confidence,
      sources: ['soil_sensor', 'weather_api', 'crop_profile']
    });
  }

  if (weatherForecastRainMm >= 10) {
    recommendations.push({
      title: 'Delay irrigation',
      severity: 'MEDIUM',
      what: `Rain forecast is ${weatherForecastRainMm} mm in 24h.`,
      why: 'Expected effective rainfall may offset crop water demand.',
      when: 'Re-check after rainfall event',
      action: 'Postpone irrigation and validate soil moisture after rain.',
      confidence: 'MEDIUM',
      sources: ['weather_forecast']
    });
  }

  return recommendations;
}

module.exports = {
  DATA_CLASS,
  calculateReferenceET0,
  calculateIrrigationRecommendation,
  classifyValue,
  buildRecommendations
};
