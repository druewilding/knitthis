// Available patterns (in a real app, this could be fetched from an API)
const PATTERNS = [
    { file: 'sample-pattern.yaml', name: 'Sample Pattern' }
];

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

// Render pattern list
function renderPatternList() {
    const container = document.getElementById('pattern-list');
    const allProgress = getAllProgress();
    
    container.innerHTML = PATTERNS.map(p => {
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
        
        return `
            <div class="pattern-card" data-file="${p.file}">
                <h2>${p.name}</h2>
                <p>Tap to view pattern</p>
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
        };
    } else {
        currentSize = {};
        sizeSelector.classList.add('hidden');
    }
    
    // Update start button text if there's saved progress
    const startBtn = document.getElementById('start-pattern');
    flattenPattern();
    if (loadProgress()) {
        startBtn.textContent = `Continue from Step ${currentStepIndex + 1}`;
    } else {
        startBtn.textContent = 'Start Knitting';
    }
    // Reset for fresh start check
    currentStepIndex = 0;
    completedSteps.clear();
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

// Substitute variables like {stitches} with size values
function substituteVariables(text) {
    if (typeof text !== 'string') return String(text);
    
    return text.replace(/\{(\w+)\}/g, (match, varName) => {
        if (currentSize && currentSize[varName] !== undefined) {
            return currentSize[varName];
        }
        return match;
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
    // Reset next button handler
    document.getElementById('next-btn').textContent = 'Next';
    document.getElementById('next-btn').onclick = nextStep;
}

// Render current step
function renderStep() {
    if (currentStepIndex >= flattenedSteps.length) {
        // Pattern complete
        document.getElementById('step-container').innerHTML = `
            <div class="complete-message">
                <h2>🎉 Pattern Complete!</h2>
                <p>Congratulations on finishing your project!</p>
            </div>
        `;
        document.getElementById('next-btn').textContent = 'Done';
        document.getElementById('next-btn').onclick = () => {
            clearProgress();
            renderPatternList();
            showView('patternList');
        };
        return;
    }
    
    const step = flattenedSteps[currentStepIndex];
    
    // Update section name
    const sectionEl = document.getElementById('section-name');
    sectionEl.textContent = step.section || '';
    sectionEl.style.display = step.section ? 'block' : 'none';
    
    // Update counter
    document.getElementById('step-counter').textContent = 
        `Step ${currentStepIndex + 1} of ${flattenedSteps.length}`;
    
    // Update content
    document.getElementById('step-content').textContent = step.text;
    
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
                <span class="text">${step.text}</span>
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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    renderPatternList();
    showView('patternList');
    
    document.getElementById('back-to-list').addEventListener('click', () => showView('patternList'));
    document.getElementById('back-to-info').addEventListener('click', () => {
        renderOverview();
        showView('overview');
    });
    document.getElementById('back-to-step').addEventListener('click', () => showView('step'));
    document.getElementById('start-pattern').addEventListener('click', startPattern);
    document.getElementById('next-btn').addEventListener('click', nextStep);
    document.getElementById('prev-btn').addEventListener('click', prevStep);
});