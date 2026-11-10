const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DATA_CLASS,
  calculateIrrigationRecommendation,
  classifyValue,
  buildRecommendations
} = require('../src/calc');

test('classifyValue marks null data as unavailable', () => {
  assert.equal(classifyValue(null, DATA_CLASS.MEASURED), DATA_CLASS.UNAVAILABLE);
});

test('irrigation recommendation calculates non-zero irrigation in deficit case', () => {
  const result = calculateIrrigationRecommendation({
    cropType: 'Wheat',
    growthStage: 'development',
    fieldAreaHa: 1,
    soilMoisturePercent: 18,
    targetSoilMoisturePercent: 28,
    rainfallMm: 1,
    weather: {
      temperatureC: 30,
      humidityPercent: 45,
      windSpeedMps: 3,
      solarRadiationMjM2Day: 21
    },
    irrigationEfficiency: 0.75,
    pumpDischargeLitresPerHour: 12000
  });

  assert.ok(result.grossIrrigationMm > 0);
  assert.ok(result.requiredLitres > 0);
  assert.equal(result.method.includes('FAO-56'), true);
});

test('recommendation engine advises delay when rain forecast is high', () => {
  const recommendations = buildRecommendations({
    irrigation: { netIrrigationMm: 1, grossIrrigationMm: 2, requiredLitres: 1000, confidence: 'MEDIUM' },
    weatherForecastRainMm: 15
  });

  assert.ok(recommendations.some((item) => item.title === 'Delay irrigation'));
});
