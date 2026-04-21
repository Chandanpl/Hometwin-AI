const page = document.body.dataset.page || 'auth';

function attachRipples() {
    document.querySelectorAll('.ripple-button').forEach((button) => {
        button.addEventListener('click', (event) => {
            const ripple = document.createElement('span');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.className = 'ripple';
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
            button.appendChild(ripple);
            window.setTimeout(() => ripple.remove(), 650);
        });
    });
}

attachRipples();

if (page === 'dashboard') {
    const state = {
        lat: null,
        lon: null,
        temperature: 24,
        mode: 'night',
        musicReady: false,
        lastScore: 0,
        isPredicting: false,
    };

    let energyChart = null;

    const els = {
        body: document.body,
        statusText: document.getElementById('statusText'),
        aiState: document.getElementById('aiState'),
        aiPulse: document.getElementById('aiPulse'),
        aiLoader: document.getElementById('aiLoader'),
        cityName: document.getElementById('cityName'),
        currentTemp: document.getElementById('currentTemp'),
        futureTemp: document.getElementById('futureTemp'),
        weatherSource: document.getElementById('weatherSource'),
        modeBadge: document.getElementById('modeBadge'),
        occupancyToggle: document.getElementById('occupancyToggle'),
        ecoToggle: document.getElementById('ecoToggle'),
        ecoPrefBtn: document.getElementById('ecoPrefBtn'),
        comfortPrefBtn: document.getElementById('comfortPrefBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        fanShell: document.getElementById('fanShell'),
        fanStatus: document.getElementById('fanStatus'),
        lightOrb: document.getElementById('lightOrb'),
        lightStatus: document.getElementById('lightStatus'),
        predictionReason: document.getElementById('predictionReason'),
        scoreRing: document.getElementById('scoreRing'),
        scoreLabel: document.getElementById('scoreLabel'),
        energyScore: document.getElementById('energyScore'),
        nextPrediction: document.getElementById('nextPrediction'),
        energyUsage: document.getElementById('energyUsage'),
        energyWaste: document.getElementById('energyWaste'),
        energySaved: document.getElementById('energySaved'),
        recommendation: document.getElementById('recommendation'),
        dailyInsight: document.getElementById('dailyInsight'),
        profileImpact: document.getElementById('profileImpact'),
        sidebarMode: document.getElementById('sidebarMode'),
        ambientAudio: document.getElementById('ambientAudio'),
        musicBtn: document.getElementById('musicBtn'),
        musicState: document.getElementById('musicState'),
        energyChart: document.getElementById('energyChart'),
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function setStatus(message) {
        els.statusText.textContent = message;
    }

    function setThinking(message, active = true) {
        els.aiState.textContent = message;
        els.aiPulse.classList.toggle('thinking', active);
        els.aiLoader.classList.toggle('active', active);
    }

    function generateAmbientAudio() {
        if (state.musicReady) return;

        const sampleRate = 8000;
        const seconds = 4;
        const samples = sampleRate * seconds;
        const dataSize = samples * 2;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        const writeString = (offset, value) => {
            for (let i = 0; i < value.length; i += 1) {
                view.setUint8(offset + i, value.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        for (let i = 0; i < samples; i += 1) {
            const t = i / sampleRate;
            const pad = Math.sin(2 * Math.PI * 196 * t) * 0.18
                + Math.sin(2 * Math.PI * 247 * t) * 0.12
                + Math.sin(2 * Math.PI * 392 * t) * 0.08;
            const fade = Math.sin(Math.PI * (i / samples));
            view.setInt16(44 + i * 2, pad * fade * 32767, true);
        }

        els.ambientAudio.src = URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
        state.musicReady = true;
    }

    function syncMusicWithMode(mode) {
        if (mode === 'night') {
            generateAmbientAudio();
            els.ambientAudio.play().then(() => {
                els.musicState.textContent = 'Playing';
                els.musicBtn.textContent = 'Pause Relaxing Music';
            }).catch(() => {
                els.musicState.textContent = 'Tap to play';
            });
        } else {
            els.ambientAudio.pause();
            els.musicState.textContent = 'Paused for day mode';
            els.musicBtn.textContent = 'Play Relaxing Music';
        }
    }

    function applyMode(mode) {
        state.mode = mode;
        els.body.classList.toggle('day-mode', mode === 'day');
        els.body.classList.toggle('night-mode', mode === 'night');
        els.modeBadge.textContent = mode === 'night' ? 'Night Mode' : 'Day Mode';
        syncMusicWithMode(mode);
    }

    function scoreClass(score) {
        if (score >= 80) return 'high-score';
        if (score >= 55) return 'mid-score';
        return 'low-score';
    }

    function animateScore(target) {
        const start = state.lastScore;
        const duration = 900;
        const started = performance.now();
        const className = scoreClass(target);

        els.scoreRing.classList.remove('high-score', 'mid-score', 'low-score');
        els.scoreRing.classList.add(className);
        els.scoreLabel.textContent = target >= 80 ? 'Excellent efficiency' : target >= 55 ? 'Balanced usage' : 'Needs attention';

        function tick(now) {
            const progress = Math.min((now - started) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.round(start + (target - start) * eased);
            els.energyScore.textContent = value;
            els.scoreRing.style.setProperty('--score', `${value * 3.6}deg`);
            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
        state.lastScore = target;
    }

    function setDeviceStatus(element, status) {
        element.textContent = status;
        element.classList.toggle('on', status === 'ON');
        element.classList.toggle('off', status !== 'ON');
    }

    function initChart(initialData = [0, 0]) {
        if (!window.Chart || !els.energyChart) return;
        if (energyChart) return;

        const existingChart = Chart.getChart ? Chart.getChart(els.energyChart) : null;
        if (existingChart) existingChart.destroy();

        const mutedColor = getComputedStyle(document.body).getPropertyValue('--muted').trim();

        energyChart = new Chart(els.energyChart, {
            type: 'bar',
            data: {
                labels: ['Current usage', 'Predicted usage'],
                datasets: [{
                    label: 'Watts',
                    data: initialData,
                    borderRadius: 8,
                    backgroundColor: ['rgba(51, 228, 155, 0.82)', 'rgba(117, 217, 255, 0.82)'],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => `${context.parsed.y} W` } },
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: mutedColor } },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: mutedColor, callback: (value) => `${value} W` },
                    },
                },
            },
        });
    }

    function updateChart(data) {
        initChart();
        if (!energyChart) return;
        energyChart.data.datasets[0].data = data;
        energyChart.update();
    }

    function updatePreferenceButtons(preference) {
        const isEco = preference === 'eco';
        els.ecoPrefBtn.classList.toggle('active', isEco);
        els.comfortPrefBtn.classList.toggle('active', !isEco);
        els.ecoToggle.checked = isEco;
        els.profileImpact.textContent = isEco
            ? 'Eco preference lowers idle usage.'
            : 'Comfort preference reacts earlier to warmth.';
        els.sidebarMode.textContent = `${isEco ? 'Eco' : 'Comfort'} mode`;
        localStorage.setItem('smartHomeProfile', JSON.stringify({ preference }));
    }

    async function fetchWeather(lat, lon) {
        setThinking('Syncing live location weather...', true);
        const response = await fetch(`/weather?lat=${lat}&lon=${lon}`);
        if (!response.ok) throw new Error('Weather request failed');
        const weather = await response.json();

        state.temperature = Number(weather.current_temp);
        els.cityName.textContent = weather.city;
        els.currentTemp.textContent = `${weather.current_temp}°C`;
        els.futureTemp.textContent = `${weather.future_temp}°C`;
        els.weatherSource.textContent = weather.source === 'openweather'
            ? 'Live OpenWeatherMap data'
            : 'Demo weather fallback';
        setStatus(`Synced with ${weather.city}. Automation is adapting to ${weather.current_temp}°C.`);
        applyMode(weather.mode);
        await predict();
    }

    async function predict() {
        if (state.isPredicting) return;
        state.isPredicting = true;
        els.refreshBtn.disabled = true;

        try {
            setThinking('AI is analyzing your environment...', true);
            els.predictionReason.textContent = 'AI is analyzing your environment...';
            await sleep(650);
            setThinking('Predicting device behavior...', true);
            await sleep(450);

            const preference = els.ecoToggle.checked ? 'eco' : 'comfort';
            const response = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    temperature: state.temperature,
                    occupancy: els.occupancyToggle.checked ? 1 : 0,
                    mode: state.mode,
                    eco_mode: preference === 'eco',
                    preference,
                }),
            });

            if (!response.ok) throw new Error('Prediction request failed');
            const data = await response.json();

            setDeviceStatus(els.fanStatus, data.fan);
            setDeviceStatus(els.lightStatus, data.light);
            els.fanShell.classList.toggle('fan-on', data.fan === 'ON');
            els.lightOrb.classList.toggle('light-on', data.light === 'ON');
            els.predictionReason.textContent = data.reason;
            els.energyUsage.textContent = `${data.energy_usage} W`;
            els.energyWaste.textContent = `${data.energy_waste} W`;
            els.energySaved.textContent = `${data.energy_saved} W`;
            animateScore(data.energy_score);
            updateChart([data.energy_usage, data.predicted_usage]);
            els.nextPrediction.textContent = data.next_prediction;
            els.recommendation.textContent = data.recommendation;
            els.dailyInsight.textContent = data.insight;
            els.profileImpact.textContent = data.profile_impact;
            setThinking('Prediction complete. Digital twin is live.', false);
        } catch (error) {
            setThinking('Prediction failed. Try again.', false);
            els.predictionReason.textContent = error.message;
        } finally {
            state.isPredicting = false;
            els.refreshBtn.disabled = false;
        }
    }

    function locateUser() {
        if (!navigator.geolocation) {
            setStatus('Geolocation is unavailable, using demo coordinates.');
            fetchWeather(28.6139, 77.2090);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.lat = position.coords.latitude;
                state.lon = position.coords.longitude;
                fetchWeather(state.lat, state.lon).catch(() => {
                    setStatus('Live weather failed, using demo-safe automation.');
                    fetchWeather(28.6139, 77.2090);
                });
            },
            () => {
                setStatus('Location permission denied, using demo coordinates.');
                fetchWeather(28.6139, 77.2090);
            },
            { enableHighAccuracy: true, timeout: 9000, maximumAge: 300000 },
        );
    }

    const initialPreference = document.body.dataset.preference || 'eco';
    updatePreferenceButtons(initialPreference);
    initChart();
    locateUser();

    els.refreshBtn.addEventListener('click', predict);
    els.occupancyToggle.addEventListener('change', predict);
    els.ecoToggle.addEventListener('change', () => {
        updatePreferenceButtons(els.ecoToggle.checked ? 'eco' : 'comfort');
        predict();
    });
    els.ecoPrefBtn.addEventListener('click', () => {
        updatePreferenceButtons('eco');
        predict();
    });
    els.comfortPrefBtn.addEventListener('click', () => {
        updatePreferenceButtons('comfort');
        predict();
    });
    els.musicBtn.addEventListener('click', () => {
        generateAmbientAudio();
        if (els.ambientAudio.paused) {
            els.ambientAudio.play();
            els.musicState.textContent = 'Playing';
            els.musicBtn.textContent = 'Pause Relaxing Music';
        } else {
            els.ambientAudio.pause();
            els.musicState.textContent = 'Paused';
            els.musicBtn.textContent = 'Play Relaxing Music';
        }
    });

    setInterval(() => {
        if (state.lat && state.lon) fetchWeather(state.lat, state.lon).catch(() => {});
    }, 300000);
}
