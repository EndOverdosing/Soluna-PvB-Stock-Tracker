document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);

    const CORS_PROXY = 'https://corsproxy.io/?';
    const API_ENDPOINTS = {
        weather: 'https://plantsvsbrainrot.com/api/weather.php',
        shop: 'https://plantsvsbrainrot.com/api/seed-shop.php'
    };

    let state = {
        isFetching: false,
        countdownInterval: null,
        currentPane: 0,
        settingsOpen: false,
        previousData: { seeds: [], gear: [], weather: null },
        audioPreferences: { plants: [], gear: [], weather: [] },
        dataLists: { plants: [], gear: [], weather: [] }
    };

    const ui = {
        body: document.body,
        paneContainer: getEl('pane-container'),
        navButtons: document.querySelectorAll('.nav-button[data-pane]'),
        refreshButton: getEl('refresh-button'),
        countdownTimer: getEl('countdown-timer'),
        weatherStatus: getEl('weather-status'),
        seedList: getEl('seed-list'),
        gearList: getEl('gear-list'),
        errorContainer: getEl('error-container'),
        settingsButton: getEl('settings-button-main'),
        settingsOverlay: getEl('settings-overlay'),
        settingsPanel: getEl('settings-panel'),
        settingsCloseButton: getEl('settings-close-button'),
        themeToggle: getEl('theme-toggle'),
        testAlertsButton: getEl('test-alerts-button')
    };

    async function initializeApp() {
        await loadDataLists();
        loadSettings();
        setupEventListeners();
        fetchAllData();
    }

    async function loadDataLists() {
        try {
            const [plants, gear, weather] = await Promise.all([
                fetch('/data/plants.json').then(res => res.json()),
                fetch('/data/gear.json').then(res => res.json()),
                fetch('/data/weather.json').then(res => res.json())
            ]);
            state.dataLists = { plants, gear, weather };
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
        createMultiSelect('weather-alerts-container', 'weather', 'Weather');
    }

    function setTheme(theme) {
        ui.body.classList.remove('dark', 'light');
        ui.body.classList.add(theme);
    }


    function testAlerts() {
        if (state.audioPreferences.plants.length > 0) playAudio('plant');
        if (state.audioPreferences.gear.length > 0) playAudio('gear');
        if (state.audioPreferences.weather.length > 0) playAudio('weather');
    }

    function setupEventListeners() {
        ui.navButtons.forEach(btn => btn.addEventListener('click', () => navigateToPane(parseInt(btn.dataset.pane))));
        ui.refreshButton.addEventListener('click', () => !state.isFetching && fetchAllData());

        ui.settingsButton.addEventListener('click', () => toggleSettings(true));
        ui.settingsCloseButton.addEventListener('click', () => toggleSettings(false));
        ui.settingsOverlay.addEventListener('click', (e) => (e.target === ui.settingsOverlay) && toggleSettings(false));
        ui.testAlertsButton.addEventListener('click', testAlerts);

        if (window.innerWidth <= 768) {
            ui.paneContainer.addEventListener('scroll', handlePaneScroll, { passive: true });
        }

        ui.themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            localStorage.setItem('pvb_theme', theme);
            setTheme(theme);
        });

        setupDragToClose();
    }

    function handlePaneScroll() {
        const newPaneIndex = Math.round(ui.paneContainer.scrollLeft / ui.paneContainer.clientWidth);
        if (newPaneIndex !== state.currentPane) {
            state.currentPane = newPaneIndex;
            updateActiveNav();
        }
    }

    function setupDragToClose() {
        let startY;
        const panel = ui.settingsPanel;
        const dragger = getEl('settings-dragger');
        if (!dragger) return;

        const onDragStart = (e) => {
            if (window.innerWidth > 768) return;
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
            if (currentY === undefined) return;
            const deltaY = currentY - startY;
            panel.style.transition = 'transform var(--transition-snap)';
            if (deltaY > 100) {
                toggleSettings(false);
            } else {
                panel.style.transform = 'translateY(0)';
            }

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

    function navigateToPane(index) {
        if (window.innerWidth <= 768) {
            ui.paneContainer.scrollTo({ left: ui.paneContainer.clientWidth * index, behavior: 'smooth' });
        }
    }

    function updateActiveNav() {
        ui.navButtons.forEach((btn, i) => btn.classList.toggle('active', state.currentPane === i));
    }

    function renderSkeletonLoader(container, count = 6) {
        container.innerHTML = Array(count).fill('<div class="skeleton"></div>').join('');
    }

    function displayError(message) {
        ui.errorContainer.textContent = message;
        ui.errorContainer.style.display = 'block';
    }

    async function fetchAllData() {
        if (state.isFetching) return;
        state.isFetching = true;
        ui.refreshButton.classList.add('loading');
        ui.errorContainer.style.display = 'none';

        renderSkeletonLoader(ui.seedList);
        renderSkeletonLoader(ui.gearList, 4);

        try {
            const [weather, shop] = await Promise.all([
                fetchWithProxy(API_ENDPOINTS.weather),
                fetchWithProxy(API_ENDPOINTS.shop)
            ]);

            checkAndPlayAlerts(shop, weather);
            updateUI(weather, shop);

            state.previousData.seeds = shop.seeds?.map(s => s.name) || [];
            state.previousData.gear = shop.gear?.map(g => g.name) || [];
            state.previousData.weather = weather?.name || null;

        } catch (error) {
            console.error(error);
            displayError("Failed to fetch live data. Please try again.");
        } finally {
            state.isFetching = false;
            ui.refreshButton.classList.remove('loading');
        }
    }

    function checkAndPlayAlerts(shop, weather) {
        if (!state.previousData) return;

        const currentSeeds = shop.seeds?.map(s => s.name) || [];
        const currentGear = shop.gear?.map(g => g.name) || [];
        const isNewWeather = weather?.active && weather.name !== state.previousData.weather;

        if (currentSeeds.some(seed => state.audioPreferences.plants.includes(seed))) {
            playAudio('plant');
        }
        if (currentGear.some(gear => state.audioPreferences.gear.includes(gear))) {
            playAudio('gear');
        }
        if (isNewWeather && state.audioPreferences.weather.includes(weather.name)) {
            playAudio('weather');
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
        ui.weatherStatus.textContent = (weather?.active && weather.name) ? weather.name : 'Clear';
        const renderList = (container, items, type) => {
            container.innerHTML = '';
            if (items?.length) {
                items.forEach(item => {
                    const itemData = state.dataLists[type]?.find(d => d.name === item.name);
                    const imageUrl = itemData ? itemData.image : '';

                    const el = document.createElement('div');
                    el.className = 'item';
                    el.innerHTML = `
                        <div class="item-details">
                            <img class="item-icon" src="${imageUrl}" alt="${item.name}" />
                            <span class="item-name">${item.name}</span>
                        </div>
                        <span class="item-quantity">x${item.qty}</span>`;
                    container.appendChild(el);
                });
            } else {
                container.innerHTML = `<p style="padding: 1rem; color: var(--text-secondary);">Shop is currently empty.</p>`;
            }
        };
        renderList(ui.seedList, shop.seeds, 'plants');
        renderList(ui.gearList, shop.gear, 'gear');
        if (shop.nextUpdateAt) startCountdown(new Date(shop.nextUpdateAt));
        else ui.countdownTimer.textContent = 'N/A';
    }

    function startCountdown(nextUpdateDate) {
        if (state.countdownInterval) clearInterval(state.countdownInterval);
        const update = () => {
            const distance = nextUpdateDate - Date.now();
            if (distance < 0) {
                clearInterval(state.countdownInterval);
                ui.countdownTimer.textContent = "00:00:00";
                setTimeout(fetchAllData, 2000);
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

    initializeApp();
});