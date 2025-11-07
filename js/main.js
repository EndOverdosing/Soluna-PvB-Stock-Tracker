document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);

    let database;

    const CORS_PROXY = 'https://corsproxy.io/?';
    const API_ENDPOINTS = {
        weather: 'https://plantsvsbrainrot.com/api/weather.php',
        shop: 'https://plantsvsbrainrot.com/api/seed-shop.php'
    };

    let state = {
        isFetching: false,
        countdownInterval: null,
        settingsOpen: false,
        historyOpen: false,
        previousData: { seeds: [], gear: [], weather: null },
        audioPreferences: { plants: [], gear: [], weather: [], rarity: [] },
        dataLists: {
            plants: [], gear: [], weather: [],
            rarity: [
                { name: 'Rare' }, { name: 'Uncommon' }, { name: 'Epic' },
                { name: 'Legendary' }, { name: 'Mythic' }, { name: 'Godly' }, { name: 'Secret' }
            ]
        },
        historyState: {
            fullHistory: [],
            visibleCount: 20,
            batchSize: 20,
            searchTerm: ''
        }
    };

    const ui = {
        body: document.body,
        desktopRefreshButton: getEl('refresh-button'),
        mobileRefreshButton: getEl('mobile-refresh-button'),
        countdownTimer: getEl('countdown-timer'),
        weatherStatus: getEl('weather-status'),
        seedList: getEl('seed-list'),
        gearList: getEl('gear-list'),
        predictorList: getEl('predictor-list'),
        historyList: getEl('history-list'),
        loadMoreHistoryButton: getEl('load-more-history'),
        databaseStatus: getEl('database-status'),
        errorContainer: getEl('error-container'),
        settingsButton: getEl('settings-button-main'),
        settingsOverlay: getEl('settings-overlay'),
        settingsPanel: getEl('settings-panel'),
        settingsCloseButton: getEl('settings-close-button'),
        historyButton: getEl('history-button-main'),
        historyOverlay: getEl('history-overlay'),
        historyPanel: getEl('history-panel'),
        historyDragger: getEl('history-dragger'),
        historyCloseButton: getEl('history-close-button'),
        historySearchInput: getEl('history-search-input'),
        themeToggle: getEl('theme-toggle'),
        testAlertsButton: getEl('test-alerts-button')
    };

    async function fetchFirebaseConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Failed to fetch Firebase config');
            return await response.json();
        } catch (error) {
            console.error("Could not fetch Firebase config:", error);
            displayError("Application configuration could not be loaded. Please try again.");
            return null;
        }
    }

    async function initializeApp() {
        if (ui.seedList) renderSkeletonLoader(ui.seedList);
        if (ui.gearList) renderSkeletonLoader(ui.gearList, 4);
        if (ui.historyList) renderSkeletonLoader(ui.historyList, 10);
        if (ui.predictorList) renderSkeletonLoader(ui.predictorList, 10);

        const firebaseConfig = await fetchFirebaseConfig();
        if (!firebaseConfig) return;

        firebase.initializeApp(firebaseConfig);
        database = firebase.database();

        await loadDataLists();
        loadSettings();
        setupEventListeners();
        fetchAllData();

        if (ui.historyList || ui.predictorList) {
            fetchHistoryAndPredictions();
        }
    }

    async function loadDataLists() {
        try {
            const [plants, gear, weather] = await Promise.all([
                fetch('/data/plants.json').then(res => res.json()),
                fetch('/data/gear.json').then(res => res.json()),
                fetch('/data/weather.json').then(res => res.json())
            ]);
            state.dataLists.plants = plants;
            state.dataLists.gear = gear;
            state.dataLists.weather = weather;
        } catch (error) {
            console.error("Failed to load data lists:", error);
            displayError("Failed to load application data. Please refresh.");
        }
    }

    async function fetchWithProxy(endpoint) {
        const url = `${CORS_PROXY}${encodeURIComponent(endpoint)}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
    }

    function loadSettings() {
        const theme = localStorage.getItem('pvb_theme') || 'dark';
        setTheme(theme);
        ui.themeToggle.checked = theme === 'dark';

        createMultiSelect('plant-alerts-container', 'plants', 'Plants');
        createMultiSelect('gear-alerts-container', 'gear', 'Gear');
        createMultiSelect('rarity-alerts-container', 'rarity', 'Rarities');
        createMultiSelect('weather-alerts-container', 'weather', 'Weather');
    }

    function setTheme(theme) {
        ui.body.classList.remove('dark', 'light');
        ui.body.classList.add(theme);
    }

    function testAlerts() {
        if (state.audioPreferences.plants.length > 0) playAudio('plant');
        if (state.audioPreferences.gear.length > 0) playAudio('gear');
        if (state.audioPreferences.rarity.length > 0) playAudio('rarity');
        if (state.audioPreferences.weather.length > 0) playAudio('weather');
    }

    function handleLoadMoreHistory() {
        state.historyState.visibleCount += state.historyState.batchSize;
        renderHistory();
    }

    function setupEventListeners() {
        const handleRefresh = () => !state.isFetching && fetchAllData();
        if (ui.desktopRefreshButton) ui.desktopRefreshButton.addEventListener('click', handleRefresh);
        if (ui.mobileRefreshButton) ui.mobileRefreshButton.addEventListener('click', handleRefresh);
        if (ui.loadMoreHistoryButton) ui.loadMoreHistoryButton.addEventListener('click', handleLoadMoreHistory);

        if (ui.settingsButton) {
            ui.settingsButton.addEventListener('click', () => toggleSettings(true));
            ui.settingsCloseButton.addEventListener('click', () => toggleSettings(false));
            ui.settingsOverlay.addEventListener('click', (e) => (e.target === ui.settingsOverlay) && toggleSettings(false));
        }

        if (ui.historyButton) {
            ui.historyButton.addEventListener('click', () => toggleHistory(true));
            ui.historyCloseButton.addEventListener('click', () => toggleHistory(false));
            ui.historyOverlay.addEventListener('click', (e) => (e.target === ui.historyOverlay) && toggleHistory(false));
        }

        if (ui.testAlertsButton) ui.testAlertsButton.addEventListener('click', testAlerts);

        if (ui.themeToggle) {
            ui.themeToggle.addEventListener('change', (e) => {
                const theme = e.target.checked ? 'dark' : 'light';
                localStorage.setItem('pvb_theme', theme);
                setTheme(theme);
            });
        }

        if (ui.historySearchInput) {
            ui.historySearchInput.addEventListener('input', (e) => {
                state.historyState.searchTerm = e.target.value;
                renderHistory();
            });
        }

        setupDragToClose(ui.settingsPanel, getEl('settings-dragger'), toggleSettings);
        setupDragToClose(ui.historyPanel, ui.historyDragger, toggleHistory);
    }

    function setupDragToClose(panel, dragger, closeFunction) {
        if (!panel || !dragger) return;
        let startY;

        const onDragStart = (e) => {
            if (window.innerWidth > 1023) return;
            startY = e.pageY || e.touches[0].pageY;
            panel.style.transition = 'none';
            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('touchmove', onDragMove, { passive: false });
            document.addEventListener('mouseup', onDragEnd);
            document.addEventListener('touchend', onDragEnd);
        };

        const onDragMove = (e) => {
            e.preventDefault();
            const currentY = e.pageY || e.touches[0].pageY;
            const deltaY = currentY - startY;
            if (deltaY > 0) panel.style.transform = `translateY(${deltaY}px)`;
        };

        const onDragEnd = (e) => {
            const currentY = e.pageY || (e.changedTouches && e.changedTouches[0].pageY);
            panel.style.transition = 'transform var(--transition-snap)';

            if (currentY === undefined && startY !== undefined) {
                panel.style.transform = 'translateY(0)';
            } else if (currentY !== undefined) {
                const deltaY = currentY - startY;
                if (deltaY > 100) {
                    closeFunction(false);
                } else {
                    panel.style.transform = 'translateY(0)';
                }
            }

            startY = undefined;
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('touchmove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.removeEventListener('touchend', onDragEnd);
        };

        dragger.addEventListener('mousedown', onDragStart);
        dragger.addEventListener('touchstart', onDragStart, { passive: true });
    }

    function toggleSettings(forceState) {
        state.settingsOpen = forceState !== undefined ? forceState : !state.settingsOpen;
        ui.settingsOverlay.classList.toggle('visible', state.settingsOpen);
        if (!state.settingsOpen) {
            ui.settingsPanel.style.transform = '';
            document.querySelectorAll('.multiselect-options.open, .multiselect-select-box.open').forEach(el => el.classList.remove('open'));
        }
    }

    function toggleHistory(forceState) {
        if (!ui.historyOverlay) return;
        state.historyOpen = forceState !== undefined ? forceState : !state.historyOpen;
        ui.historyOverlay.classList.toggle('visible', state.historyOpen);
        if (!state.historyOpen) {
            ui.historyPanel.style.transform = '';
        }
    }

    function renderSkeletonLoader(container, count = 6) {
        if (!container) return;
        container.innerHTML = Array(count).fill('<div class="skeleton"></div>').join('');
    }

    function displayError(message) {
        ui.errorContainer.textContent = message;
        ui.errorContainer.style.display = 'block';
    }

    async function fetchAllData() {
        if (state.isFetching) return;
        state.isFetching = true;
        if (ui.desktopRefreshButton) ui.desktopRefreshButton.classList.add('loading');
        if (ui.mobileRefreshButton) ui.mobileRefreshButton.classList.add('loading');
        ui.errorContainer.style.display = 'none';

        try {
            const [weather, shop] = await Promise.all([
                fetchWithProxy(API_ENDPOINTS.weather),
                fetchWithProxy(API_ENDPOINTS.shop)
            ]);

            checkAndPlayAlerts(shop, weather);
            updateUI(weather, shop);
            saveToDatabase(shop);

            state.previousData.seeds = shop.seeds?.map(s => s.name) || [];
            state.previousData.weather = weather?.name || null;

        } catch (error) {
            console.error(error);
            displayError("Failed to fetch live data. Please try again.");
        } finally {
            state.isFetching = false;
            if (ui.desktopRefreshButton) ui.desktopRefreshButton.classList.remove('loading');
            if (ui.mobileRefreshButton) ui.mobileRefreshButton.classList.remove('loading');
        }
    }

    function checkAndPlayAlerts(shop, weather) {
        if (!state.previousData) return;

        const currentSeeds = shop.seeds?.map(s => s.name) || [];
        const isNewWeather = weather?.active && weather.name !== state.previousData.weather;

        if (currentSeeds.some(seed => state.audioPreferences.plants.includes(seed))) {
            playAudio('plant');
        }
        if (isNewWeather && state.audioPreferences.weather.includes(weather.name)) {
            playAudio('weather');
        }

        const allItems = [...(shop.seeds || [])];
        const currentRarities = allItems.map(item => {
            const plantData = state.dataLists.plants.find(p => p.name === item.name);
            return plantData ? plantData.rarity : null;
        }).filter(Boolean);

        if (currentRarities.some(rarity => state.audioPreferences.rarity.includes(rarity))) {
            playAudio('rarity');
        }
    }

    function playAudio(type) {
        try {
            const audio = getEl(`audio-${type}`);
            audio.currentTime = 0;
            audio.play().catch(e => console.warn(`Audio play failed: ${e.message}`));
        } catch (e) { console.warn(`Could not play audio for type: ${type}`, e); }
    }

    function updateUI(weather, shop) {
        console.log("Received shop data from API:", shop);
        ui.weatherStatus.textContent = (weather?.active && weather.name) ? weather.name : 'Clear';

        const findItemData = (itemName) => {
            const cleanedItemName = itemName.trim().toLowerCase();
            const plantMatch = state.dataLists.plants.find(p => p.name.trim().toLowerCase() === cleanedItemName);
            if (plantMatch) return plantMatch;
            return state.dataLists.gear.find(g => g.name.trim().toLowerCase() === cleanedItemName);
        };

        const renderList = (container, items, listName) => {
            if (!container) return;
            if (items && items.length > 0) {
                const fragment = document.createDocumentFragment();
                let itemsRendered = 0;

                items.forEach(item => {
                    const itemData = findItemData(item.name);
                    if (!itemData) {
                        console.warn(`[DEBUG] In ${listName} list, could not find a match for API item name: "${item.name}"`);
                        return;
                    }
                    itemsRendered++;
                    const imageUrl = itemData.image;
                    const rarity = itemData.rarity.toLowerCase();

                    const el = document.createElement('div');
                    el.className = `item ${rarity}`;
                    el.innerHTML = `
                    <div class="item-details">
                        <img class="item-icon" src="${imageUrl}" alt="${item.name}" />
                        <span class="item-name">${item.name}</span>
                    </div>
                    <span class="item-quantity">x${item.qty}</span>`;
                    fragment.appendChild(el);
                });

                if (itemsRendered > 0) {
                    container.innerHTML = '';
                    container.appendChild(fragment);
                } else {
                    container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No ${listName.toLowerCase()} currently in stock.</p>`;
                }
            } else {
                container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No ${listName.toLowerCase()} currently in stock.</p>`;
            }
        };

        renderList(ui.seedList, shop.seeds, 'Seeds');

        if (shop.nextUpdateAt) {
            startCountdown(new Date(shop.nextUpdateAt));
        } else {
            ui.countdownTimer.textContent = 'N/A';
        }
    }

    function startCountdown(nextUpdateDate) {
        if (state.countdownInterval) clearInterval(state.countdownInterval);

        const initialDistance = nextUpdateDate - Date.now();
        if (initialDistance < 1000) {
            ui.countdownTimer.textContent = "Updating...";
            if (!state.isFetching) {
                setTimeout(fetchAllData, 3000);
            }
            return;
        }

        const update = () => {
            const distance = nextUpdateDate - Date.now();
            if (distance < 0) {
                clearInterval(state.countdownInterval);
                ui.countdownTimer.textContent = "00:00:00";
                if (!state.isFetching) {
                    setTimeout(fetchAllData, 2000);
                }
                return;
            }
            const h = String(Math.floor((distance / 3600000) % 24)).padStart(2, '0');
            const m = String(Math.floor((distance / 60000) % 60)).padStart(2, '0');
            const s = String(Math.floor((distance / 1000) % 60)).padStart(2, '0');
            ui.countdownTimer.textContent = `${h}:${m}:${s}`;
        };
        update();
        state.countdownInterval = setInterval(update, 1000);
    }

    function createMultiSelect(containerId, type, placeholder) {
        const container = getEl(containerId);
        if (!container || !state.dataLists[type]) return;

        const selectBox = document.createElement('div');
        selectBox.className = 'multiselect-select-box';
        selectBox.innerHTML = `<span class="multiselect-text">Select ${placeholder}...</span><i class="fa-solid fa-chevron-down"></i>`;

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'multiselect-options';

        state.dataLists[type].forEach(item => {
            const option = document.createElement('label');
            option.className = 'multiselect-option';
            option.innerHTML = `<input type="checkbox" value="${item.name}"> ${item.name}`;
            optionsContainer.appendChild(option);
        });

        container.appendChild(selectBox);
        container.appendChild(optionsContainer);

        const savedPrefs = JSON.parse(localStorage.getItem(`pvb_alert_${type}`)) || [];
        state.audioPreferences[type] = savedPrefs;

        const checkboxes = optionsContainer.querySelectorAll('input');
        checkboxes.forEach(cb => {
            if (savedPrefs.includes(cb.value)) {
                cb.checked = true;
            }
        });
        updateMultiSelectText(container, type, placeholder);

        selectBox.addEventListener('click', () => {
            selectBox.classList.toggle('open');
            optionsContainer.classList.toggle('open');
        });

        optionsContainer.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const checkedItems = Array.from(checkboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);
                state.audioPreferences[type] = checkedItems;
                localStorage.setItem(`pvb_alert_${type}`, JSON.stringify(checkedItems));
                updateMultiSelectText(container, type, placeholder);
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                selectBox.classList.remove('open');
                optionsContainer.classList.remove('open');
            }
        });
    }

    function updateMultiSelectText(container, type, placeholder) {
        const textEl = container.querySelector('.multiselect-text');
        const count = state.audioPreferences[type].length;
        if (count === 0) {
            textEl.textContent = `Select ${placeholder}...`;
            textEl.classList.remove('selected');
        } else if (count === 1) {
            textEl.textContent = state.audioPreferences[type][0];
            textEl.classList.add('selected');
        } else {
            textEl.textContent = `${count} ${placeholder} selected`;
            textEl.classList.add('selected');
        }
    }

    function saveToDatabase(shopData) {
        if (!database) return;

        const currentSeeds = (shopData.seeds?.map(s => s.name) || []).sort();
        const previousSeeds = ([...(state.previousData.seeds || [])]).sort();

        const areSeedsSame = JSON.stringify(currentSeeds) === JSON.stringify(previousSeeds);

        if (areSeedsSame) {
            return;
        }

        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            seeds: shopData.seeds || []
        };
        database.ref('history').push(entry);
    }

    async function fetchHistoryAndPredictions() {
        if (!database) return;

        const historyRef = database.ref('history').limitToLast(100);
        historyRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                if (ui.historyList) {
                    ui.historyList.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No history data available yet.</p>`;
                }
                if (ui.predictorList) {
                    ui.predictorList.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Not enough data for predictions.</p>';
                }
                return;
            }

            const history = Object.values(data).reverse();
            state.historyState.fullHistory = history;
            state.historyState.visibleCount = state.historyState.batchSize;

            if (ui.historyList) renderHistory();
            if (ui.predictorList) generatePredictions(history);

            if (ui.databaseStatus) {
                const firstEntryDate = new Date(history[history.length - 1].timestamp);
                ui.databaseStatus.textContent = `Database created on ${firstEntryDate.toLocaleDateString()}`;
            }
        });
    }

    function renderHistory() {
        if (!ui.historyList) return;

        const searchTerm = state.historyState.searchTerm.toLowerCase();

        const filteredFullHistory = state.historyState.fullHistory.filter(entry => {
            if (!entry.seeds || entry.seeds.length === 0) {
                return false;
            }
            if (!searchTerm) {
                return true;
            }
            return entry.seeds.some(seed => seed.name.toLowerCase().includes(searchTerm));
        });

        const visibleBatches = filteredFullHistory.slice(0, state.historyState.visibleCount);
        ui.historyList.innerHTML = '';

        if (visibleBatches.length > 0) {
            visibleBatches.forEach(batch => {
                const batchContainer = document.createElement('div');
                batchContainer.className = 'history-batch';

                const date = new Date(batch.timestamp);
                const dateString = date.toLocaleDateString();
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let batchItemsHtml = '';
                (batch.seeds || []).forEach(item => {
                    const itemData = state.dataLists.plants.find(p => p.name === item.name);
                    if (!itemData) return;

                    batchItemsHtml += `
                <div class="item ${itemData.rarity.toLowerCase()}">
                    <div class="item-details">
                        <img class="item-icon" src="${itemData.image}" alt="${itemData.name}" />
                        <span class="item-name">${item.name}</span>
                    </div>
                    <span class="item-quantity">x${item.qty}</span>
                </div>
            `;
                });

                if (batchItemsHtml) {
                    batchContainer.innerHTML = `
                <div class="batch-header">
                    <span>${dateString}</span>
                    <span>${timeString}</span>
                </div>
                <div class="batch-item-list">
                    ${batchItemsHtml}
                </div>
            `;
                    ui.historyList.appendChild(batchContainer);
                }
            });
        } else {
            if (state.historyState.fullHistory.length === 0) {
                renderSkeletonLoader(ui.historyList, 5);
            } else if (searchTerm) {
                ui.historyList.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No batches found containing "${state.historyState.searchTerm}".</p>`;
            } else {
                ui.historyList.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No seed history available.</p>`;
            }
        }

        if (state.historyState.visibleCount < filteredFullHistory.length) {
            ui.loadMoreHistoryButton.style.display = 'block';
        } else {
            ui.loadMoreHistoryButton.style.display = 'none';
        }
    }

    function generatePredictions(history) {
        if (!ui.predictorList) return;
        ui.predictorList.innerHTML = '';

        const itemsToPredict = state.dataLists.plants.filter(p =>
            ['Secret', 'Mythic', 'Godly'].includes(p.rarity)
        );

        const predictions = [];

        const formatInterval = (ms) => {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.round((ms % 3600000) / 60000);
            return `${hours}h ${minutes}m`;
        };

        itemsToPredict.forEach(item => {
            const appearances = history
                .filter(entry => (entry.seeds || []).some(seed => seed.name === item.name))
                .map(entry => new Date(entry.timestamp).getTime())
                .sort((a, b) => a - b);

            if (appearances.length < 2) {
                predictions.push({
                    name: item.name,
                    predictionTime: Infinity,
                    details: `Last seen: ${appearances.length === 1 ? new Date(appearances[0]).toLocaleDateString() : 'Never'}. Not enough data.`,
                    status: 'Unknown'
                });
                return;
            }

            const intervals = [];
            for (let i = 1; i < appearances.length; i++) {
                intervals.push(appearances[i] - appearances[i - 1]);
            }

            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const lastAppearance = appearances[appearances.length - 1];
            const predictedTimestamp = lastAppearance + avgInterval;

            const msIn5Minutes = 5 * 60 * 1000;
            const roundedPredictionTimestamp = Math.ceil(predictedTimestamp / msIn5Minutes) * msIn5Minutes;

            let status;
            const timeSinceLast = Date.now() - lastAppearance;
            const score = timeSinceLast / avgInterval;

            if (Date.now() > roundedPredictionTimestamp) {
                status = 'Overdue';
            } else if (score > 0.8) {
                status = 'Expected';
            } else {
                status = 'Recent';
            }

            const details = `Avg. interval: ${formatInterval(avgInterval)}. Last seen: ${new Date(lastAppearance).toLocaleDateString()}`;
            predictions.push({ name: item.name, predictionTime: roundedPredictionTimestamp, details, status });
        });

        predictions.sort((a, b) => a.predictionTime - b.predictionTime);

        if (predictions.length === 0) {
            ui.predictorList.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">No high-rarity items found to predict.</p>`;
            return;
        }

        predictions.forEach(p => {
            const itemData = state.dataLists.plants.find(i => i.name === p.name);
            const el = document.createElement('div');
            el.className = `item ${itemData.rarity.toLowerCase()}`;

            let predictionText = 'Prediction unavailable';
            let statusColor = 'var(--bg-active)';

            if (p.predictionTime !== Infinity) {
                const predictionDate = new Date(p.predictionTime);
                predictionText = predictionDate.toLocaleString([], {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                if (p.status === 'Overdue') statusColor = 'var(--rarity-rare)';
                if (p.status === 'Expected') statusColor = 'var(--rarity-legendary)';
            }

            el.innerHTML = `
                <div class="item-details">
                    <img class="item-icon" src="${itemData.image}" alt="${itemData.name}" />
                    <div>
                        <span class="item-name">${itemData.name}</span>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${p.details}</div>
                    </div>
                </div>
                <div class="predictor-info" style="text-align: right;">
                    <span class="item-name">${predictionText}</span>
                    <div class="item-quantity" style="background-color: ${statusColor}; color: var(--text-primary); margin-top: 4px; display: inline-block;">
                        ${p.status}
                    </div>
                </div>`;
            ui.predictorList.appendChild(el);
        });
    }

    initializeApp();
});