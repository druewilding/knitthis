// Available patterns (in a real app, this could be fetched from an API)
const PATTERNS = [
    { file: 'sample-pattern.yaml', name: 'Sample Pattern' }
];

// App state
let currentPattern = null;
let currentSize = null;
let flattenedSteps = [];
let currentStepIndex = 0;
let completedSteps = new Set();

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

// Show a view, hide others
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

// Render pattern list
function renderPatternList() {
    const container = document.getElementById('pattern-list');
    container.innerHTML = PATTERNS.map(p => `
        <div class="pattern-card" data-file="${p.file}">
            <h2>${p.name}</h2>
            <p>Tap to view pattern</p>
        </div>
    `).join('');
    
    container.querySelectorAll('.pattern-card').forEach(card => {
        card.addEventListener('click', () => loadPattern(card.dataset.file));
    });
}

// Load and display pattern info
async function loadPattern(file) {
    try {
        currentPattern = await loadYAML(`patterns/${file}`);
        renderPatternInfo();
        showView('patternInfo');
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
        currentSize = p.sizes[0];
        sizeSelector.classList.remove('hidden');
        
        sizeSelect.addEventListener('change', (e) => {
            currentSize = p.sizes[parseInt(e.target.value)];
        });
    } else {
        currentSize = {};
        sizeSelector.classList.add('hidden');
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
    currentStepIndex = 0;
    completedSteps.clear();
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
        document.getElementById('next-btn').onclick = () => showView('patternList');
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