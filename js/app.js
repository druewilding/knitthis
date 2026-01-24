// Pattern list (loaded dynamically from patterns/index.json)
let PATTERNS = [];

// App state
let currentPatternFile = null;
let currentPattern = null;
let currentSize = null;
let currentSizeIndex = 0;
let flattenedSteps = [];
let currentStepIndex = 0;
let completedSteps = new Set();

// Storage key prefix
const STORAGE_KEY = 'knitthis_progress_';

// DOM Elements
const views = {
    patternList: document.getElementById('pattern-list-view'),
    patternInfo: document.getElementById('pattern-info-view'),
    step: document.getElementById('step-view'),
    overview: document.getElementById('overview-view')
};

// Utility: Load YAML file
async function loadYAML(filePath) {
    const response = await fetch(filePath);
    const text = await response.text();
    return jsyaml.load(text);
}

// Storage functions
function getProgressKey() {
    const sizeName = currentSize?.name || 'default';
    return `${STORAGE_KEY}${currentPatternFile}_${sizeName}`;
}

function saveProgress() {
    const data = {
        stepIndex: currentStepIndex,
        completedSteps: Array.from(completedSteps),
        sizeIndex: currentSizeIndex,
        lastUpdated: Date.now()
    };
    localStorage.setItem(getProgressKey(), JSON.stringify(data));
}

function loadProgress() {
    const data = localStorage.getItem(getProgressKey());
    if (data) {
        const parsed = JSON.parse(data);
        currentStepIndex = parsed.stepIndex || 0;
        completedSteps = new Set(parsed.completedSteps || []);
        return true;
    }
    return false;
}

function clearProgress() {
    localStorage.removeItem(getProgressKey());
}

function getAllProgress() {
    const progress = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(STORAGE_KEY)) {
            const data = JSON.parse(localStorage.getItem(key));
            // Extract pattern file from key
            const patternKey = key.replace(STORAGE_KEY, '');
            progress[patternKey] = data;
        }
    }
    return progress;
}

// Show a view, hide others
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

// Cache for pattern metadata
const patternCache = {};

// Load pattern metadata (lightweight, just for list display)
async function loadPatternMetadata(file) {
    if (patternCache[file]) return patternCache[file];
    try {
        const pattern = await loadYAML(`patterns/${file}`);
        patternCache[file] = pattern;
        return pattern;
    } catch (e) {
        console.error('Failed to load pattern metadata:', file, e);
        return null;
    }
}

// Render pattern list
async function renderPatternList() {
    const container = document.getElementById('pattern-list');
    const allProgress = getAllProgress();

    // Load all pattern metadata
    const patternData = await Promise.all(
        PATTERNS.map(async p => ({
            ...p,
            metadata: await loadPatternMetadata(p.file)
        }))
    );

    container.innerHTML = patternData.map(p => {
        // Check if there's any saved progress for this pattern
        const progressKeys = Object.keys(allProgress).filter(k => k.startsWith(p.file));
        let progressHtml = '';

        if (progressKeys.length > 0) {
            progressKeys.forEach(key => {
                const prog = allProgress[key];
                const sizeName = key.replace(p.file + '_', '');
                const stepNum = prog.stepIndex + 1;
                progressHtml += `
                    <div class="progress-indicator" data-file="${p.file}" data-size="${sizeName}">
                        <span class="progress-text">${sizeName}: Step ${stepNum}</span>
                        <button class="resume-btn" data-file="${p.file}" data-size-index="${prog.sizeIndex}">Resume</button>
                    </div>
                `;
            });
        }

        // Skill level badge
        let skillBadgeHtml = '';
        if (p.metadata?.skillLevel) {
            const levelClass = p.metadata.skillLevel.toLowerCase().replace(/\s+/g, '-');
            skillBadgeHtml = `<span class="skill-badge skill-${levelClass}">${p.metadata.skillLevel}</span>`;
        }

        // Description
        const description = p.metadata?.description || 'Tap to view pattern';

        return `
            <div class="pattern-card" data-file="${p.file}">
                <div class="pattern-card-header">
                    <h2>${p.metadata?.name || p.name}</h2>
                    ${skillBadgeHtml}
                </div>
                <p>${description}</p>
                ${progressHtml}
            </div>
        `;
    }).join('');

    // Click on card to view pattern info
    container.querySelectorAll('.pattern-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking resume button
            if (e.target.classList.contains('resume-btn')) return;
            loadPattern(card.dataset.file);
        });
    });

    // Resume buttons
    container.querySelectorAll('.resume-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const file = btn.dataset.file;
            const sizeIndex = parseInt(btn.dataset.sizeIndex) || 0;
            await loadPattern(file, sizeIndex, true);
        });
    });
}

// Load and display pattern info
async function loadPattern(file, sizeIndex = 0, resumeImmediately = false) {
    try {
        currentPatternFile = file;
        currentPattern = await loadYAML(`patterns/${file}`);
        currentSizeIndex = sizeIndex;

        // Set up size
        if (currentPattern.sizes && currentPattern.sizes.length > 0) {
            currentSize = currentPattern.sizes[sizeIndex];
        } else {
            currentSize = {};
        }

        if (resumeImmediately) {
            flattenPattern();
            loadProgress();
            resetStepContainer();
            renderStep();
            showView('step');
        } else {
            renderPatternInfo();
            showView('patternInfo');
        }
    } catch (error) {
        console.error('Error loading pattern:', error);
        alert('Failed to load pattern');
    }
}

// Render pattern info/metadata
function renderPatternInfo() {
    const p = currentPattern;
    document.getElementById('pattern-title').textContent = p.name;

    let html = '';

    if (p.description) {
        html += `<p>${p.description}</p>`;
    }

    // Skill level badge
    if (p.skillLevel) {
        const levelClass = p.skillLevel.toLowerCase().replace(/\s+/g, '-');
        html += `<div class="pattern-meta"><span class="skill-badge skill-${levelClass}">${p.skillLevel}</span></div>`;
    }

    // Techniques list
    if (p.techniques && p.techniques.length > 0) {
        html += `<h2>Techniques</h2><ul>`;
        p.techniques.forEach(t => {
            html += `<li>${t}</li>`;
        });
        html += '</ul>';
    }

    if (p.notes) {
        html += `<h2>Notes</h2><p>${p.notes}</p>`;
    }

    if (p.materials) {
        html += `<h2>Materials</h2><ul>`;
        p.materials.forEach(m => {
            if (typeof m === 'string') {
                html += `<li>${m}</li>`;
            } else {
                html += `<li>${m.name}${m.amount ? ': ' + m.amount : ''}${m.type ? ' (' + m.type + ')' : ''}</li>`;
            }
        });
        html += '</ul>';
    }

    if (p.gauge) {
        html += `<h2>Gauge</h2><p>${p.gauge.stitches} sts × ${p.gauge.rows} rows = ${p.gauge.unit || '10cm'}</p>`;
    }

    if (p.abbreviations) {
        html += `<h2>Abbreviations</h2><dl class="abbrev-list">`;
        Object.entries(p.abbreviations).forEach(([abbr, meaning]) => {
            html += `<dt>${abbr}</dt><dd>${meaning}</dd>`;
        });
        html += '</dl>';
    }

    document.getElementById('pattern-info').innerHTML = html;

    // Size selector
    const sizeSelector = document.getElementById('size-selector');
    const sizeSelect = document.getElementById('size-select');

    if (p.sizes && p.sizes.length > 0) {
        sizeSelect.innerHTML = p.sizes.map((s, i) =>
            `<option value="${i}">${s.name}</option>`
        ).join('');
        sizeSelect.value = currentSizeIndex;
        currentSize = p.sizes[currentSizeIndex];
        sizeSelector.classList.remove('hidden');

        sizeSelect.onchange = (e) => {
            currentSizeIndex = parseInt(e.target.value);
            currentSize = p.sizes[currentSizeIndex];
            updateStartButton();
        };
    } else {
        currentSize = {};
        sizeSelector.classList.add('hidden');
    }

    updateStartButton();
}

// Update start button and reset button based on saved progress
function updateStartButton() {
    const startBtn = document.getElementById('start-pattern');
    const resetBtn = document.getElementById('reset-progress');

    flattenPattern();
    if (loadProgress()) {
        startBtn.textContent = `Continue from Step ${currentStepIndex + 1}`;
        resetBtn.classList.remove('hidden');
    } else {
        startBtn.textContent = 'Start Knitting';
        resetBtn.classList.add('hidden');
    }
    // Reset for fresh start check
    currentStepIndex = 0;
    completedSteps.clear();
}

// Reset progress and start fresh
function resetProgress() {
    if (confirm('Are you sure you want to start over? Your progress will be lost.')) {
        clearProgress();
        updateStartButton();
    }
}

// Flatten pattern into sequential steps
function flattenPattern() {
    flattenedSteps = [];
    const p = currentPattern;

    // Process sections
    if (p.sections) {
        p.sections.forEach(section => {
            processInstructions(section.instructions, section.name);
        });
    } else if (p.instructions) {
        processInstructions(p.instructions, null);
    }
}

// Process instructions, handling repeats and variables
function processInstructions(instructions, sectionName) {
    instructions.forEach(instruction => {
        if (typeof instruction === 'string') {
            flattenedSteps.push({
                section: sectionName,
                text: substituteVariables(instruction)
            });
        } else if (instruction.repeat) {
            // Handle repeat blocks
            const times = substituteVariables(instruction.repeat);
            const repeatCount = parseInt(times) || 1;

            for (let i = 1; i <= repeatCount; i++) {
                instruction.steps.forEach(step => {
                    flattenedSteps.push({
                        section: sectionName,
                        text: substituteVariables(step) + ` (rep ${i}/${repeatCount})`,
                        repeatInfo: { current: i, total: repeatCount }
                    });
                });
            }
        }
    });
}

// Substitute variables like {stitches} or expressions like {heelSts - 26}
function substituteVariables(text) {
    if (typeof text !== 'string') return String(text);

    // Match {expression} where expression can contain variable names and math operators
    return text.replace(/\{([^}]+)\}/g, (match, expression) => {
        try {
            // Replace all variable names with their values
            const substitutedExpr = expression.replace(/[a-zA-Z_]\w*/g, (varName) => {
                if (currentSize && currentSize[varName] !== undefined) {
                    return currentSize[varName];
                }
                return varName; // Keep as-is if not found (might be an error)
            });

            // Check if it's a simple math expression (only numbers, operators, spaces, parentheses)
            if (/^[\d\s+\-*/%().]+$/.test(substitutedExpr)) {
                // Evaluate the math expression
                const result = Function('"use strict"; return (' + substitutedExpr + ')')();
                // Return integer if whole number, otherwise round to 1 decimal
                return Number.isInteger(result) ? result : Math.round(result * 10) / 10;
            }

            // If it's just a single variable that was substituted, return it
            return substitutedExpr.trim();
        } catch (e) {
            console.warn('Failed to evaluate expression:', expression, e);
            return match; // Return original if evaluation fails
        }
    });
}

// Start the pattern
function startPattern() {
    flattenPattern();
    // Try to load saved progress, otherwise start fresh
    if (!loadProgress()) {
        currentStepIndex = 0;
        completedSteps.clear();
    }
    resetStepContainer();
    renderStep();
    showView('step');
}

// Reset step container to original structure
function resetStepContainer() {
    document.getElementById('step-container').innerHTML = `
        <div id="section-name"></div>
        <div id="step-counter"></div>
        <div id="step-content"></div>
    `;
    // Reset next button text (handler is set once in DOMContentLoaded)
    document.getElementById('next-btn').textContent = 'Next';
}

// Track if pattern is complete
let patternComplete = false;

// Format text with markdown-style syntax
function formatText(text) {
    let html = text
        // Escape HTML first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold: **text** or __text__
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Italic: *text* or _text_
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Line breaks: | or \n
        .replace(/\s*\|\s*/g, '<br>')
        .replace(/\\n/g, '<br>')
        // Horizontal separator: --
        .replace(/\s*--\s*/g, '<hr class="step-divider">');

    return html;
}

// Render current step
function renderStep() {
    if (currentStepIndex >= flattenedSteps.length) {
        // Pattern complete
        patternComplete = true;
        document.getElementById('step-container').innerHTML = `
            <div class="complete-message">
                <h2>🎉 Pattern Complete!</h2>
                <p>Congratulations on finishing your project!</p>
            </div>
        `;
        document.getElementById('next-btn').textContent = 'Done';
        return;
    }

    patternComplete = false;
    const step = flattenedSteps[currentStepIndex];

    // Update section name
    const sectionEl = document.getElementById('section-name');
    sectionEl.textContent = step.section || '';
    sectionEl.style.display = step.section ? 'block' : 'none';

    // Update counter
    document.getElementById('step-counter').textContent =
        `Step ${currentStepIndex + 1} of ${flattenedSteps.length}`;

    // Update content with formatting
    document.getElementById('step-content').innerHTML = formatText(step.text);

    // Update progress bar
    const progress = ((currentStepIndex + 1) / flattenedSteps.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;

    // Update buttons
    document.getElementById('prev-btn').disabled = currentStepIndex === 0;
    document.getElementById('next-btn').textContent =
        currentStepIndex === flattenedSteps.length - 1 ? 'Finish' : 'Next';

    // Save progress
    saveProgress();
}

// Navigation
function nextStep() {
    if (patternComplete) {
        // Handle "Done" button
        clearProgress();
        renderPatternList();
        showView('patternList');
        return;
    }

    completedSteps.add(currentStepIndex);
    if (currentStepIndex < flattenedSteps.length) {
        currentStepIndex++;
        renderStep();
    }
}

function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        renderStep();
    }
}

// Render overview/checklist
function renderOverview() {
    // Set title and subtitle
    document.getElementById('overview-title').textContent = currentPattern?.name || 'Overview';
    const sizeName = currentSize?.name;
    document.getElementById('overview-subtitle').textContent = sizeName || '';
    
    const container = document.getElementById('overview-list');
    let html = '';
    let currentSection = null;

    flattenedSteps.forEach((step, index) => {
        if (step.section !== currentSection) {
            if (currentSection !== null) {
                html += '</div>';
            }
            currentSection = step.section;
            html += `<div class="overview-section"><h2>${currentSection || 'Instructions'}</h2>`;
        }

        const isCompleted = completedSteps.has(index);
        html += `
            <div class="overview-item ${isCompleted ? 'completed' : ''}" data-index="${index}">
                <span class="check">${isCompleted ? '✓' : ''}</span>
                <span class="text">${formatText(step.text)}</span>
            </div>
        `;
    });

    if (currentSection !== null) {
        html += '</div>';
    }

    container.innerHTML = html;

    // Click to jump to step
    container.querySelectorAll('.overview-item').forEach(item => {
        item.addEventListener('click', () => {
            currentStepIndex = parseInt(item.dataset.index);
            renderStep();
            showView('step');
        });
    });
}

// Go back to pattern info from step view
function goToPatternInfo() {
    renderPatternInfo();
    showView('patternInfo');
}

// Load pattern index from patterns/index.json
async function loadPatternIndex() {
    try {
        const response = await fetch('patterns/index.json');
        const files = await response.json();
        PATTERNS = files.map(file => ({ file }));
    } catch (e) {
        console.error('Failed to load pattern index:', e);
        PATTERNS = [];
    }
}

// Initialize app
async function init() {
    await loadPatternIndex();
    await renderPatternList();
    showView('patternList');

    document.getElementById('back-to-list').addEventListener('click', async () => {
        await renderPatternList();
        showView('patternList');
    });
    document.getElementById('back-to-pattern-info').addEventListener('click', goToPatternInfo);
    document.getElementById('view-checklist').addEventListener('click', () => {
        renderOverview();
        showView('overview');
    });
    document.getElementById('back-to-step').addEventListener('click', () => showView('step'));
    document.getElementById('start-pattern').addEventListener('click', startPattern);
    document.getElementById('reset-progress').addEventListener('click', resetProgress);
    document.getElementById('next-btn').addEventListener('click', nextStep);
    document.getElementById('prev-btn').addEventListener('click', prevStep);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', init);
