/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- TYPE DEFINITIONS ---
interface TimeRange { start: string; end: string; }

interface HappyHour {
  id: number;
  name: string;
  address: string;
  days: string[];
  timeRanges: TimeRange[];
  specials: string;
  hasFood: boolean;
  rating: number;
  isFavorite: boolean;
}

type HappyHourStatus = {
    status: 'active' | 'upcoming' | 'ended';
    minutesUntilStart?: number;
    minutesUntilEnd?: number;
};


// In-memory store for our happy hours
let happyHours: HappyHour[] = [];
// State for the current filters
const activeFilters = {
    activeNow: false,
    activeWithin30Mins: false,
    hasFood: false,
    isFavorite: false,
};
// State for the current sort order
let currentSortOrder: 'alphabetic' | 'rating' = 'alphabetic';


// --- DATABASE CONSTANTS AND FUNCTIONS ---
const HAPPY_HOUR_DB_KEY = 'keyWestHappyHours';

/**
 * Saves the current list of happy hours to the browser's localStorage.
 * @param data The array of happy hours to save.
 */
function saveHappyHoursToDB(data: HappyHour[]) {
    try {
        localStorage.setItem(HAPPY_HOUR_DB_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Failed to save happy hours to local storage:", error);
    }
}

/**
 * Loads happy hours from localStorage. If none are found (e.g., first visit),
 * it loads the seed data and saves it.
 * @returns The array of happy hours.
 */
function loadHappyHoursFromDB(): HappyHour[] {
    try {
        const storedData = localStorage.getItem(HAPPY_HOUR_DB_KEY);
        if (storedData) {
            const parsedData = JSON.parse(storedData) as HappyHour[];
            // Ensure backward compatibility for the new isFavorite field
            return parsedData.map(hh => ({ ...hh, isFavorite: hh.isFavorite || false }));
        }
    } catch (error) {
        console.error("Failed to parse happy hours from local storage, falling back to default data.", error);
    }

    // If no stored data or if parsing failed, use seed data and save it for next time.
    const seedData = happyHourData.map((hh, i) => ({ ...hh, id: i + 1, isFavorite: false })); // Start IDs from 1
    saveHappyHoursToDB(seedData);
    return seedData;
}


// --- DOM ELEMENT REFERENCES ---
const elements = {
  appContainer: document.getElementById('app-container')!,
  happyHourList: document.getElementById('happy-hour-list')!,
  loadingIndicator: document.getElementById('loading-indicator')!,
  errorMessage: document.getElementById('error-message')!,
  filtersContainer: document.getElementById('filters-container')!,
  sortSelect: document.getElementById('sort-select')! as HTMLSelectElement,
  // Modal & Form Elements
  addFab: document.getElementById('add-hh-fab')!,
  modal: document.getElementById('add-hh-modal')!,
  modalTitle: document.querySelector('#add-hh-modal h2')!,
  closeModalBtn: document.getElementById('close-modal-btn')!,
  form: document.getElementById('add-hh-form')! as HTMLFormElement,
  formError: document.getElementById('form-error')!,
  // Form Inputs
  nameInput: document.getElementById('hh-name')! as HTMLInputElement,
  addressInput: document.getElementById('hh-address')! as HTMLInputElement,
  specialsInput: document.getElementById('hh-specials')! as HTMLTextAreaElement,
  daysContainer: document.getElementById('hh-days')!,
  timeRangesContainer: document.getElementById('time-ranges-container')!,
  addTimeRangeBtn: document.getElementById('add-time-range-btn')!,
  foodToggle: document.getElementById('hh-food')! as HTMLInputElement,
  favoriteToggle: document.getElementById('hh-favorite')! as HTMLInputElement,
  ratingContainer: document.getElementById('hh-rating')!,
};

// --- MOCK DATA (used for first-time seeding) ---
const happyHourData: Omit<HappyHour, 'id' | 'isFavorite'>[] = [
    { name: "Sloppy Joe's Bar", address: "201 Duval St, Key West", days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeRanges: [{start: '16:00', end: '18:00'}], specials: "Half-price well drinks, domestic beers, and house wines. $5 appetizers including wings and conch fritters.", hasFood: true, rating: 4 },
    { name: "Hog's Breath Saloon", address: "400 Front St, Key West", days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], timeRanges: [{start: '17:00', end: '19:00'}], specials: "2-for-1 beers and well drinks. Live music daily.", hasFood: false, rating: 5 },
    { name: "Green Parrot Bar", address: "601 Whitehead St, Key West", days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeRanges: [{start: '16:00', end: '19:00'}], specials: "Famous for its laid-back vibe. Discounted Parrot Grog and a selection of craft beers.", hasFood: false, rating: 5 },
    { name: "Blue Heaven", address: "729 Thomas St, Key West", days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeRanges: [{start: '15:00', end: '17:00'}], specials: "Caribbean-inspired cocktails at reduced prices. $1 off all beers in their lush garden setting.", hasFood: true, rating: 4 },
    { name: "Conch Republic Seafood Company", address: "631 Greene St, Key West", days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], timeRanges: [{start: '16:00', end: '19:00'}, {start: '22:00', end: '01:00'}], specials: "2-for-1 deals on all bar drinks. Great view of the marina. Late night deals too!", hasFood: true, rating: 4 },
    { name: "Bagatelle", address: "115 Duval St, Key West", days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], timeRanges: [{start: '09:00', end: '11:00'}, {start: '16:00', end: '18:00'}], specials: "Breakfast and afternoon happy hours. $5 tasting plates and specialty cocktails.", hasFood: true, rating: 5 },
];

/**
 * Renders the list of happy hours to the DOM.
 * @param happyHoursToRender The array of happy hour objects to render.
 */
function renderListView(happyHoursToRender: HappyHour[]) {
    elements.loadingIndicator.style.display = 'none';
    elements.happyHourList.innerHTML = ''; // Clear previous content

    if (happyHoursToRender.length === 0) {
        elements.happyHourList.innerHTML = `<div class="empty-state"><h3>No Happy Hours Found</h3><p>Try adjusting your filters or sort order.</p></div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    happyHoursToRender.forEach(hh => {
        const card = document.createElement('div');
        card.className = 'happy-hour-card';
        
        const stars = '★'.repeat(hh.rating) + '☆'.repeat(5 - hh.rating);
        const timeRangesStr = hh.timeRanges.map(r => `${r.start} - ${r.end}`).join(', ');
        const daysStr = hh.days.join(', ');

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title-group">
                    <h3>${hh.name}</h3>
                    <p class="address">${hh.address}</p>
                </div>
                <div class="card-top-right">
                    <div class="card-rating">
                        <span>${stars}</span>
                        ${hh.isFavorite ? `<span class="card-favorite" aria-label="Personal favorite">❤️</span>` : ''}
                        ${hh.hasFood ? `<span class="card-rating-food" aria-label="Food deals available">🍽️</span>` : ''}
                    </div>
                     <button class="edit-btn" data-id="${hh.id}">Edit</button>
                </div>
            </div>
            <p class="summary">${hh.specials}</p>
            <div class="card-footer">
                <span class="days"><strong>Days:</strong> ${daysStr}</span>
                <span class="time"><strong>Hours:</strong> ${timeRangesStr}</span>
            </div>
        `;
        fragment.appendChild(card);
    });
    elements.happyHourList.appendChild(fragment);
}

/**
 * Shows an error message to the user.
 * @param message The error message to display.
 */
function renderError(message: string) {
    elements.loadingIndicator.style.display = 'none';
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
}


// --- TIME & FILTERING LOGIC ---

/**
 * [REWRITTEN FOR ROBUSTNESS]
 * Determines the current status of a happy hour (active, upcoming, or ended) using a simple, procedural check with native Date objects.
 * This approach is more efficient and reliable across different devices than the previous implementation.
 * @param hh The happy hour object.
 * @param now The current Date object.
 * @returns A HappyHourStatus object.
 */
function getHappyHourStatus(hh: HappyHour, now: Date): HappyHourStatus {
    const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const nowDayStr = dayMap[now.getDay()];
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayDayStr = dayMap[yesterday.getDay()];

    const createDateFromTime = (baseDate: Date, timeStr: string): Date => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const d = new Date(baseDate);
        d.setHours(hours, minutes, 0, 0);
        return d;
    };

    let soonestUpcomingStart: Date | null = null;

    // --- STEP 1: Check if we are currently in an "overnight" happy hour that started yesterday. ---
    if (hh.days.includes(yesterdayDayStr)) {
        for (const range of hh.timeRanges) {
            if (!range.start || !range.end) continue;
            
            const startHours = parseInt(range.start.split(':')[0]);
            const endHours = parseInt(range.end.split(':')[0]);

            if (endHours < startHours) { // This is an overnight range
                const startDate = createDateFromTime(yesterday, range.start);
                const endDate = createDateFromTime(now, range.end);
                
                if (now >= startDate && now < endDate) {
                    const millisUntilEnd = endDate.getTime() - now.getTime();
                    return {
                        status: 'active',
                        minutesUntilEnd: Math.round(millisUntilEnd / 60000)
                    };
                }
            }
        }
    }

    // --- STEP 2: Check for active or upcoming happy hours based on today's schedule. ---
    if (hh.days.includes(nowDayStr)) {
        for (const range of hh.timeRanges) {
            if (!range.start || !range.end) continue;
            
            const startDate = createDateFromTime(now, range.start);
            let endDate = createDateFromTime(now, range.end);

            if (endDate <= startDate) { // Handle overnight range for today
                endDate.setDate(endDate.getDate() + 1);
            }
            
            // Is it active right now?
            if (now >= startDate && now < endDate) {
                const millisUntilEnd = endDate.getTime() - now.getTime();
                return {
                    status: 'active',
                    minutesUntilEnd: Math.round(millisUntilEnd / 60000)
                };
            }
            // Is it upcoming later today?
            else if (startDate > now) {
                if (!soonestUpcomingStart || startDate < soonestUpcomingStart) {
                    soonestUpcomingStart = startDate;
                }
            }
        }
    }

    // --- STEP 3: If we found any upcoming slots, return the soonest one. ---
    if (soonestUpcomingStart) {
        const millisUntilStart = soonestUpcomingStart.getTime() - now.getTime();
        return {
            status: 'upcoming',
            minutesUntilStart: Math.round(millisUntilStart / 60000)
        };
    }

    // --- STEP 4: If nothing else matched, it has ended for the day. ---
    return { status: 'ended' };
}


/**
 * Applies the current filters and sort order to the main happy hour list and re-renders the view.
 */
function filterAndRender() {
    let filteredList = [...happyHours];

    // Apply "Is Favorite" filter
    if (activeFilters.isFavorite) {
        filteredList = filteredList.filter(hh => hh.isFavorite);
    }
    
    // Apply "Has Food" filter
    if (activeFilters.hasFood) {
        filteredList = filteredList.filter(hh => hh.hasFood);
    }

    const now = new Date();

    // Apply time-based filters
    if (activeFilters.activeWithin30Mins) {
        filteredList = filteredList.filter(hh => {
            const status = getHappyHourStatus(hh, now);
            return status.status === 'active' || (status.status === 'upcoming' && status.minutesUntilStart! <= 30);
        });
    } else if (activeFilters.activeNow) {
        filteredList = filteredList.filter(hh => {
            const status = getHappyHourStatus(hh, now);
            return status.status === 'active';
        });
    }
    
    // Apply sorting
    filteredList.sort((a, b) => {
        // 1. Primary sort: Favorites first
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;

        // 2. Secondary sort: Based on currentSortOrder
        if (currentSortOrder === 'rating') {
            // Sort by rating descending (higher rating first)
            return b.rating - a.rating;
        } else { // 'alphabetic'
            // Sort by name ascending
            return a.name.localeCompare(b.name);
        }
    });

    renderListView(filteredList);
}


// --- MODAL AND FORM LOGIC ---

function openAddModal() {
    elements.form.removeAttribute('data-editing-id');
    elements.modalTitle.textContent = "Add New Happy Hour";
    resetForm();

    // Pre-select weekdays as a default for new entries
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    weekdays.forEach(day => {
        const dayButton = elements.daysContainer.querySelector(`[data-day="${day}"]`);
        dayButton?.classList.add('active');
    });

    elements.modal.style.display = 'flex';
}

function openEditModal(id: number) {
    const hhToEdit = happyHours.find(h => h.id === id);
    if (!hhToEdit) {
        console.error("Could not find happy hour to edit with ID:", id);
        return;
    }

    resetForm();
    elements.form.dataset.editingId = String(id);
    elements.modalTitle.textContent = "Edit Happy Hour";

    // Populate form fields
    elements.nameInput.value = hhToEdit.name;
    elements.addressInput.value = hhToEdit.address;
    elements.specialsInput.value = hhToEdit.specials;
    elements.foodToggle.checked = hhToEdit.hasFood;
    elements.favoriteToggle.checked = hhToEdit.isFavorite;
    updateRating(hhToEdit.rating);
    
    // Set active days
    hhToEdit.days.forEach(day => {
        const dayButton = elements.daysContainer.querySelector(`[data-day="${day}"]`);
        dayButton?.classList.add('active');
    });

    // Populate time ranges
    elements.timeRangesContainer.innerHTML = ''; // Clear defaults
    if (hhToEdit.timeRanges.length > 0) {
        hhToEdit.timeRanges.forEach(range => {
            addTimeRangeInput(range.start, range.end);
        });
    } else {
        addTimeRangeInput(); // Add one blank one if none exist
    }
    
    elements.modal.style.display = 'flex';
}

function closeModal() {
    elements.modal.style.display = 'none';
}

function resetForm() {
    elements.form.reset();
    elements.daysContainer.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
    elements.timeRangesContainer.innerHTML = '';
    addTimeRangeInput(); // Add one initial time range
    updateRating(0);
    elements.favoriteToggle.checked = false;
    elements.formError.style.display = 'none';
    elements.form.removeAttribute('data-editing-id');
}

function addTimeRangeInput(startValue = '', endValue = '') {
    const div = document.createElement('div');
    div.className = 'time-range-input';
    div.innerHTML = `
        <input type="time" class="time-start" value="${startValue}" required>
        <span>to</span>
        <input type="time" class="time-end" value="${endValue}" required>
        <button type="button" class="remove-time-range-btn" aria-label="Remove time range">&times;</button>
    `;
    elements.timeRangesContainer.appendChild(div);
}

function updateRating(newRating: number) {
    (elements.ratingContainer as HTMLElement).dataset.rating = String(newRating);
    elements.ratingContainer.querySelectorAll('span').forEach(star => {
        const starValue = parseInt((star as HTMLElement).dataset.value!);
        star.textContent = starValue <= newRating ? '★' : '☆';
    });
}

function handleFormSubmit(event: SubmitEvent) {
    event.preventDefault();
    elements.formError.style.display = 'none';

    // Collect and validate data
    const name = elements.nameInput.value.trim();
    const address = elements.addressInput.value.trim();
    const specials = elements.specialsInput.value.trim();
    const days = Array.from(elements.daysContainer.querySelectorAll('.active')).map(el => (el as HTMLElement).dataset.day!);
    const hasFood = elements.foodToggle.checked;
    const isFavorite = elements.favoriteToggle.checked;
    const rating = parseInt((elements.ratingContainer as HTMLElement).dataset.rating || '0');

    const timeRanges: TimeRange[] = [];
    const timeRangeInputs = elements.timeRangesContainer.querySelectorAll('.time-range-input');
    timeRangeInputs.forEach(tr => {
        const start = (tr.querySelector('.time-start') as HTMLInputElement).value;
        const end = (tr.querySelector('.time-end') as HTMLInputElement).value;
        if (start && end) {
            timeRanges.push({ start, end });
        }
    });

    // Validation
    if (!name || !address || !specials) {
        elements.formError.textContent = "Please fill out Name, Address, and Specials.";
        elements.formError.style.display = 'block';
        return;
    }
    if (days.length === 0) {
        elements.formError.textContent = "Please select at least one day of the week.";
        elements.formError.style.display = 'block';
        return;
    }
    if (timeRanges.length === 0) {
        elements.formError.textContent = "Please add at least one valid time range.";
        elements.formError.style.display = 'block';
        return;
    }
    if (rating === 0) {
        elements.formError.textContent = "Please provide a rating.";
        elements.formError.style.display = 'block';
        return;
    }

    const editingIdStr = elements.form.dataset.editingId;

    if (editingIdStr) {
        // --- EDIT MODE ---
        const editingId = parseInt(editingIdStr, 10);
        const hhIndex = happyHours.findIndex(h => h.id === editingId);
        if (hhIndex > -1) {
            happyHours[hhIndex] = {
                ...happyHours[hhIndex],
                name,
                address,
                days,
                timeRanges,
                specials,
                hasFood,
                isFavorite,
                rating
            };
        }
    } else {
        // --- ADD MODE ---
        const newHappyHour: HappyHour = {
            id: Date.now(), // Simple unique ID
            name,
            address,
            days,
            timeRanges,
            specials,
            hasFood,
            isFavorite,
            rating
        };
        happyHours.push(newHappyHour);
    }
    
    saveHappyHoursToDB(happyHours);
    filterAndRender();
    closeModal();
}

function handleListClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const editButton = target.closest('.edit-btn');
    if (editButton && editButton instanceof HTMLElement) {
        const id = parseInt(editButton.dataset.id!, 10);
        if (!isNaN(id)) {
            openEditModal(id);
        }
    }
}

function handleFilterClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const filterButton = target.closest('[data-filter]');

    if (filterButton && filterButton instanceof HTMLElement) {
        const filterName = filterButton.dataset.filter as keyof typeof activeFilters;

        // Toggle the filter state
        activeFilters[filterName] = !activeFilters[filterName];
        filterButton.classList.toggle('active');

        // Make time filters mutually exclusive for a better UX
        if (filterName === 'activeNow' && activeFilters.activeNow) {
            activeFilters.activeWithin30Mins = false;
            document.querySelector('[data-filter="activeWithin30Mins"]')?.classList.remove('active');
        }
        if (filterName === 'activeWithin30Mins' && activeFilters.activeWithin30Mins) {
            activeFilters.activeNow = false;
            document.querySelector('[data-filter="activeNow"]')?.classList.remove('active');
        }

        filterAndRender();
    }
}

function setupEventListeners() {
    elements.addFab.addEventListener('click', openAddModal);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.addTimeRangeBtn.addEventListener('click', () => addTimeRangeInput());
    elements.filtersContainer.addEventListener('click', handleFilterClick);
    elements.sortSelect.addEventListener('change', () => {
        currentSortOrder = elements.sortSelect.value as 'alphabetic' | 'rating';
        filterAndRender();
    });

    // Event delegation for dynamic elements
    elements.happyHourList.addEventListener('click', handleListClick);

    elements.timeRangesContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('remove-time-range-btn')) {
            if (elements.timeRangesContainer.children.length > 1) {
                target.parentElement?.remove();
            }
        }
    });
    
    elements.daysContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON') {
            target.classList.toggle('active');
        }
    });

    elements.ratingContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'SPAN') {
            updateRating(parseInt(target.dataset.value!));
        }
    });

    // Set up a timer to refresh the list every minute for time-based filters
    setInterval(filterAndRender, 60 * 1000);
}

/**
 * Main application entry point.
 */
async function main() {
  try {
    happyHours = loadHappyHoursFromDB();
    filterAndRender(); // Initial render with filters and default sort applied
    setupEventListeners();
  } catch (error) {
    console.error("Failed to initialize the application:", error);
    renderError("Could not load the application. Please try reloading the page.");
  }
}

main();
