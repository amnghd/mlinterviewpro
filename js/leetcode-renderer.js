/**
 * LeetCode Problems Renderer
 * Dynamically renders problems from JSON data
 */

class LeetCodeRenderer {
    constructor() {
        this.problems = [];
        this.filteredProblems = [];
        this.currentFilter = {
            difficulty: 'all',
            pattern: 'all',
            search: ''
        };
        this.editors = new Map();
    }

    async init() {
        try {
            const response = await fetch('data/leetcode-problems.json');
            const data = await response.json();
            this.problems = data.problems;
            this.metadata = data.metadata;
            this.filteredProblems = [...this.problems];
            this.renderAll();
            this.setupEventListeners();
            this.loadSavedProgress();
        } catch (error) {
            console.error('Error loading problems:', error);
        }
    }

    renderAll() {
        this.renderStats();
        this.renderFilters();
        this.renderProblems();
    }

    renderStats() {
        const statsContainer = document.getElementById('problem-stats');
        if (!statsContainer) return;

        const easy = this.problems.filter(p => p.difficulty === 'Easy').length;
        const medium = this.problems.filter(p => p.difficulty === 'Medium').length;
        const hard = this.problems.filter(p => p.difficulty === 'Hard').length;

        statsContainer.innerHTML = `
            <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                Easy: ${easy}
            </span>
            <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                Medium: ${medium}
            </span>
            <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                Hard: ${hard}
            </span>
            <span class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                Total: ${this.problems.length}
            </span>
        `;
    }

    renderFilters() {
        const filterContainer = document.getElementById('problem-filters');
        if (!filterContainer) return;

        // Get unique patterns
        const patterns = new Set();
        this.problems.forEach(p => p.patterns.forEach(pat => patterns.add(pat)));

        filterContainer.innerHTML = `
            <div class="flex flex-wrap gap-4 items-center">
                <div>
                    <label class="text-sm font-medium text-gray-600 mr-2">Difficulty:</label>
                    <select id="filter-difficulty" class="border rounded-lg px-3 py-2">
                        <option value="all">All</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>
                <div>
                    <label class="text-sm font-medium text-gray-600 mr-2">Pattern:</label>
                    <select id="filter-pattern" class="border rounded-lg px-3 py-2">
                        <option value="all">All Patterns</option>
                        ${[...patterns].sort().map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div class="flex-1">
                    <input type="text" id="filter-search"
                           placeholder="Search problems..."
                           class="w-full border rounded-lg px-3 py-2">
                </div>
            </div>
        `;
    }

    renderProblems() {
        const container = document.getElementById('problems-container');
        if (!container) return;

        if (this.filteredProblems.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    No problems match your filters.
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredProblems.map(problem => this.renderProblemCard(problem)).join('');

        // Initialize CodeMirror editors
        setTimeout(() => {
            this.initializeCodeEditors();
        }, 100);
    }

    renderProblemCard(problem) {
        const difficultyClass = {
            'Easy': 'difficulty-easy',
            'Medium': 'difficulty-medium',
            'Hard': 'difficulty-hard'
        }[problem.difficulty];

        const savedProgress = localStorage.getItem(`progress_lc_${problem.id}`) || 'not-started';
        const progressClass = {
            'not-started': 'progress-not-started',
            'working': 'progress-working',
            'need-help': 'progress-need-help',
            'solved': 'progress-solved'
        }[savedProgress];

        const hasMultipleApproaches = problem.solutions.length > 1;

        return `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden mb-6" data-problem-id="${problem.id}">
                <div class="p-6">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 class="text-xl font-bold">${problem.id}. ${problem.title}</h3>
                                <span class="${difficultyClass} px-3 py-1 rounded text-sm font-medium">${problem.difficulty}</span>
                                <select class="progress-dropdown ${progressClass}"
                                        onchange="leetcodeRenderer.updateProgress(${problem.id}, this.value)"
                                        data-problem="${problem.id}">
                                    <option value="not-started" ${savedProgress === 'not-started' ? 'selected' : ''}>Not Started</option>
                                    <option value="working" ${savedProgress === 'working' ? 'selected' : ''}>Working</option>
                                    <option value="need-help" ${savedProgress === 'need-help' ? 'selected' : ''}>Need Help</option>
                                    <option value="solved" ${savedProgress === 'solved' ? 'selected' : ''}>Solved</option>
                                </select>
                            </div>
                            <p class="text-gray-600 mb-3">${problem.description}</p>
                            <div class="flex flex-wrap gap-2">
                                ${problem.companies.slice(0, 5).map(c => `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">${c}</span>`).join('')}
                                ${problem.patterns.map(p => `<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">${p}</span>`).join('')}
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="leetcodeRenderer.toggleSolution('sol-${problem.id}')"
                                    class="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition">
                                <i class="fas fa-lightbulb mr-2"></i>Solutions
                            </button>
                            <a href="${problem.leetcodeUrl}" target="_blank"
                               class="border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                    </div>
                </div>
                <div id="sol-${problem.id}" class="solution-content bg-gray-50 border-t">
                    <div class="p-6">
                        ${this.renderComparisonTable(problem)}
                        ${hasMultipleApproaches ? this.renderApproachTabs(problem) : ''}
                        ${this.renderSolutions(problem)}
                    </div>
                </div>
            </div>
        `;
    }

    renderComparisonTable(problem) {
        if (problem.solutions.length < 2) return '';

        return `
            <div class="mb-6 overflow-x-auto">
                <h4 class="font-bold mb-3 text-purple-700"><i class="fas fa-chart-bar mr-2"></i>Runtime Comparison</h4>
                <table class="w-full text-sm border rounded-lg comparison-table">
                    <thead>
                        <tr>
                            <th class="px-4 py-2 text-left">Approach</th>
                            <th class="px-4 py-2">Time</th>
                            <th class="px-4 py-2">Space</th>
                            <th class="px-4 py-2 text-left">Best For</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${problem.solutions.map(sol => {
                            const timeClass = sol.timeComplexity.includes('n²') || sol.timeComplexity.includes('n³')
                                ? 'text-red-600'
                                : sol.timeComplexity.includes('log') || sol.timeComplexity === 'O(n)' || sol.timeComplexity === 'O(1)'
                                    ? 'text-green-600'
                                    : 'text-yellow-600';
                            return `
                                <tr class="border-t ${sol.isOptimal ? 'best-approach' : ''}">
                                    <td class="px-4 py-2 ${sol.isOptimal ? 'font-bold' : ''}">${sol.approach}${sol.isOptimal ? ' ⭐' : ''}</td>
                                    <td class="px-4 py-2 ${timeClass} font-mono">${sol.timeComplexity}</td>
                                    <td class="px-4 py-2 font-mono">${sol.spaceComplexity}</td>
                                    <td class="px-4 py-2">${sol.bestFor}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderApproachTabs(problem) {
        return `
            <div class="flex gap-2 mb-4 flex-wrap approach-tabs" data-solution="sol-${problem.id}">
                ${problem.solutions.map((sol, idx) => `
                    <button onclick="leetcodeRenderer.showApproach('sol-${problem.id}', ${idx})"
                            class="approach-tab ${idx === 0 ? 'active' : 'bg-gray-100'} px-4 py-2 rounded-lg font-medium border"
                            data-approach="${idx}">
                        ${sol.approach}${sol.isOptimal ? ' ⭐' : ''}
                    </button>
                `).join('')}
            </div>
        `;
    }

    renderSolutions(problem) {
        return problem.solutions.map((sol, idx) => `
            <div id="sol-${problem.id}-approach-${idx}" class="approach-content ${idx === 0 ? 'active' : ''}" style="${idx === 0 ? '' : 'display: none;'}">
                <div class="flex gap-2 mb-3">
                    <span class="complexity-badge ${sol.timeComplexity.includes('n²') || sol.timeComplexity.includes('n³') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                        Time: ${sol.timeComplexity}
                    </span>
                    <span class="complexity-badge ${sol.spaceComplexity.includes('n²') ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        Space: ${sol.spaceComplexity}
                    </span>
                </div>
                <div class="relative">
                    <button onclick="leetcodeRenderer.copyCode(this)"
                            class="absolute top-2 right-2 z-10 bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 copy-btn">
                        <i class="fas fa-copy mr-1"></i>Copy
                    </button>
                    <textarea class="code-editor" data-editor-id="editor-${problem.id}-${idx}">${this.escapeHtml(sol.code)}</textarea>
                </div>
                ${sol.expectedOutput ? `
                    <div class="mt-4 output-box rounded-lg p-4 text-sm">
                        <div class="text-green-400 mb-2"><i class="fas fa-terminal mr-2"></i>Expected Output:</div>
                        <pre>${this.escapeHtml(sol.expectedOutput)}</pre>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    initializeCodeEditors() {
        document.querySelectorAll('.code-editor:not(.CodeMirror-hidden-textarea)').forEach(textarea => {
            if (!this.editors.has(textarea.dataset.editorId)) {
                const editor = CodeMirror.fromTextArea(textarea, {
                    mode: 'python',
                    theme: 'dracula',
                    lineNumbers: true,
                    indentUnit: 4,
                    tabSize: 4,
                    lineWrapping: true
                });
                this.editors.set(textarea.dataset.editorId, editor);
            }
        });
    }

    toggleSolution(id) {
        const content = document.getElementById(id);
        if (!content) return;

        content.classList.toggle('open');
        if (content.classList.contains('open')) {
            setTimeout(() => {
                content.querySelectorAll('.CodeMirror').forEach(cm => cm.CodeMirror?.refresh());
            }, 100);
        }
    }

    showApproach(solutionId, approachIdx) {
        const container = document.getElementById(solutionId);
        if (!container) return;

        // Update tabs
        container.querySelectorAll('.approach-tab').forEach((tab, idx) => {
            if (idx === approachIdx) {
                tab.classList.add('active');
                tab.classList.remove('bg-gray-100');
            } else {
                tab.classList.remove('active');
                tab.classList.add('bg-gray-100');
            }
        });

        // Update content
        container.querySelectorAll('.approach-content').forEach((content, idx) => {
            if (idx === approachIdx) {
                content.style.display = '';
                content.classList.add('active');
                setTimeout(() => {
                    content.querySelectorAll('.CodeMirror').forEach(cm => cm.CodeMirror?.refresh());
                }, 50);
            } else {
                content.style.display = 'none';
                content.classList.remove('active');
            }
        });
    }

    copyCode(btn) {
        const container = btn.closest('.relative');
        const textarea = container.querySelector('textarea');
        const editorId = textarea?.dataset?.editorId;
        const editor = this.editors.get(editorId);
        const code = editor ? editor.getValue() : textarea?.value || '';

        navigator.clipboard.writeText(code).then(() => {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
            btn.classList.add('bg-green-600');
            setTimeout(() => {
                btn.innerHTML = original;
                btn.classList.remove('bg-green-600');
            }, 2000);
        });
    }

    updateProgress(problemId, status) {
        const key = `progress_lc_${problemId}`;
        localStorage.setItem(key, status);

        // Update dropdown styling
        const dropdown = document.querySelector(`select[data-problem="${problemId}"]`);
        if (dropdown) {
            dropdown.classList.remove('progress-not-started', 'progress-working', 'progress-need-help', 'progress-solved');
            dropdown.classList.add(`progress-${status.replace('-', '-')}`);

            const classMap = {
                'not-started': 'progress-not-started',
                'working': 'progress-working',
                'need-help': 'progress-need-help',
                'solved': 'progress-solved'
            };
            dropdown.classList.add(classMap[status] || 'progress-not-started');
        }

        // Sync to Firebase if logged in
        if (typeof syncProgressToFirebase === 'function') {
            syncProgressToFirebase(problemId, status);
        }
    }

    loadSavedProgress() {
        document.querySelectorAll('select[data-problem]').forEach(dropdown => {
            const problemId = dropdown.getAttribute('data-problem');
            const key = `progress_lc_${problemId}`;
            const savedStatus = localStorage.getItem(key);
            if (savedStatus) {
                dropdown.value = savedStatus;
                this.updateProgress(problemId, savedStatus);
            }
        });
    }

    applyFilters() {
        this.filteredProblems = this.problems.filter(p => {
            // Difficulty filter
            if (this.currentFilter.difficulty !== 'all' && p.difficulty !== this.currentFilter.difficulty) {
                return false;
            }
            // Pattern filter
            if (this.currentFilter.pattern !== 'all' && !p.patterns.includes(this.currentFilter.pattern)) {
                return false;
            }
            // Search filter
            if (this.currentFilter.search) {
                const search = this.currentFilter.search.toLowerCase();
                const matchesTitle = p.title.toLowerCase().includes(search);
                const matchesId = p.id.toString().includes(search);
                const matchesPattern = p.patterns.some(pat => pat.toLowerCase().includes(search));
                const matchesCompany = p.companies.some(c => c.toLowerCase().includes(search));
                if (!matchesTitle && !matchesId && !matchesPattern && !matchesCompany) {
                    return false;
                }
            }
            return true;
        });

        this.renderProblems();
    }

    setupEventListeners() {
        document.getElementById('filter-difficulty')?.addEventListener('change', (e) => {
            this.currentFilter.difficulty = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filter-pattern')?.addEventListener('change', (e) => {
            this.currentFilter.pattern = e.target.value;
            this.applyFilters();
        });

        document.getElementById('filter-search')?.addEventListener('input', (e) => {
            this.currentFilter.search = e.target.value;
            this.applyFilters();
        });
    }
}

// Initialize renderer
const leetcodeRenderer = new LeetCodeRenderer();
document.addEventListener('DOMContentLoaded', () => leetcodeRenderer.init());
