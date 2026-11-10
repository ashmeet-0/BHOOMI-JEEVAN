const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  classifyValue,
  calculateIrrigationRecommendation,
  buildRecommendations,
  DATA_CLASS
} = require('./calc');

const publicDir = path.join(__dirname, '..', 'public');

const demoFarm = {
  farmer: {
    id: 'farmer-001',
    name: 'Demo Farmer',
    language: 'en'
  },
  field: {
    id: 'field-001',
    name: 'North Plot',
    areaHa: 1.2,
    coordinates: [77.5946, 12.9716],
    soilType: 'Loam',
    irrigationSource: 'Borewell + drip'
  },
  crop: {
    type: 'Wheat',
    variety: 'HD 2967',
    sowingDate: '2026-10-01',
    growthStage: 'development'
  }
};

function dashboardPayload() {
  const weather = {
    temperatureC: 29,
    humidityPercent: 52,
    windSpeedMps: 2.8,
    solarRadiationMjM2Day: 20
  };

  const irrigation = calculateIrrigationRecommendation({
    cropType: demoFarm.crop.type,
    growthStage: demoFarm.crop.growthStage,
    fieldAreaHa: demoFarm.field.areaHa,
    soilMoisturePercent: 19,
    targetSoilMoisturePercent: 28,
    rainfallMm: 2,
    weather,
    irrigationEfficiency: 0.78,
    pumpDischargeLitresPerHour: 15000
  });

  const weatherForecastRainMm = 3;

  return {
    metadata: {
      mode: 'DEMONSTRATION',
      disclaimer: 'This dashboard is demo mode with mixed measured/observed/estimated data. It does not represent live hardware telemetry.',
      generatedAt: new Date().toISOString()
    },
    farm: demoFarm,
    dataReliability: {
      measured: 'Direct sensor or lab values',
      observed: 'Trusted external observation datasets',
      estimated: 'Model-derived values',
      predicted: 'Forecast values',
      unavailable: 'No reliable data available'
    },
    modules: {
      soil: {
        moisture: { value: 19, unit: '%', class: classifyValue(19, DATA_CLASS.MEASURED) },
        temperature: { value: 26.5, unit: '°C', class: classifyValue(26.5, DATA_CLASS.MEASURED) },
        ph: { value: 7.3, unit: 'pH', class: classifyValue(7.3, DATA_CLASS.OBSERVED) },
        nitrogen: { value: 215, unit: 'kg/ha', class: classifyValue(215, DATA_CLASS.OBSERVED) }
      },
      water: {
        groundwaterDepth: { value: null, unit: 'm', class: classifyValue(null, DATA_CLASS.MEASURED) },
        weather,
        irrigation
      },
      weather: {
        current: {
          temperatureC: { value: 29, class: classifyValue(29, DATA_CLASS.OBSERVED) },
          humidityPercent: { value: 52, class: classifyValue(52, DATA_CLASS.OBSERVED) },
          windSpeedMps: { value: 2.8, class: classifyValue(2.8, DATA_CLASS.OBSERVED) }
        },
        forecast24h: {
          rainMm: { value: weatherForecastRainMm, class: classifyValue(weatherForecastRainMm, DATA_CLASS.PREDICTED) }
        }
      }
    },
    recommendations: buildRecommendations({ irrigation, weatherForecastRainMm })
  };
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const safeRelativePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.resolve(publicDir, `.${safeRelativePath}`);

  if (!filePath.startsWith(`${publicDir}${path.sep}`) && filePath !== path.join(publicDir, 'index.html')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript'
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/dashboard') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dashboardPayload()));
    return;
  }

  serveStatic(req, res);
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`BHOOMI-JEEVAN MVP running on http://localhost:${port}`);
  });
}

module.exports = { server, dashboardPayload };
