/**
 * Settings Panel Component
 * Provides a UI for managing application settings
 */
class SettingsPanel {
    constructor(containerId, options = {}) {
        // DOM Elements
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID '${containerId}' not found`);
            return;
        }

        // Configuration
        this.config = {
            autoLoad: true,
            showReset: true,
            saveButtonText: 'Save Settings',
            resetButtonText: 'Reset to Defaults',
            loadingText: 'Loading settings...',
            saveSuccessText: 'Settings saved successfully!',
            saveErrorText: 'Failed to save settings',
            resetConfirmText: 'Are you sure you want to reset all settings to their default values?',
            ...options
        };

        // State
        this.isLoading = false;
        this.fields = [];
        this.configManager = window.configManager || null;

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the settings panel
     */
    initialize() {
        // Create the form structure
        this.render();

        // Initialize config manager if not already available
        if (!this.configManager && window.configManager) {
            this.configManager = window.configManager;
        } else if (!this.configManager) {
            console.error('ConfigManager not found. Make sure config-manager.js is loaded.');
            return;
        }

        // Set up event listeners
        this.setupEventListeners();

        // Load settings if auto-load is enabled
        if (this.config.autoLoad) {
            this.loadSettings();
        }
    }

    /**
     * Render the settings panel
     */
    render() {
        // Clear the container
        this.container.innerHTML = '';

        // Create form element
        this.form = document.createElement('form');
        this.form.id = 'settings-form';
        this.form.className = 'settings-form';
        this.form.setAttribute('novalidate', '');

        // Create form groups container
        const formGroups = document.createElement('div');
        formGroups.id = 'settings-form-groups';
        formGroups.className = 'settings-form-groups';

        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'settings-loading';
        loadingDiv.className = 'settings-loading';
        loadingDiv.textContent = this.config.loadingText;
        loadingDiv.style.display = 'none';

        // Add form actions
        const formActions = document.createElement('div');
        formActions.className = 'settings-form-actions';
        
        // Save button
        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.className = 'btn btn-primary';
        saveButton.textContent = this.config.saveButtonText;
        saveButton.disabled = true;
        
        // Reset button
        let resetButton = null;
        if (this.config.showReset) {
            resetButton = document.createElement('button');
            resetButton.type = 'button';
            resetButton.className = 'btn btn-outline-secondary';
            resetButton.textContent = this.config.resetButtonText;
            resetButton.addEventListener('click', () => this.handleReset());
            formActions.appendChild(resetButton);
        }
        
        formActions.appendChild(saveButton);

        // Status message
        const statusDiv = document.createElement('div');
        statusDiv.id = 'settings-status';
        statusDiv.className = 'settings-status';
        statusDiv.setAttribute('aria-live', 'polite');

        // Assemble the form
        this.form.appendChild(loadingDiv);
        this.form.appendChild(formGroups);
        this.form.appendChild(formActions);
        this.form.appendChild(statusDiv);
        
        // Add form to container
        this.container.appendChild(this.form);

        // Store references to important elements
        this.formGroups = formGroups;
        this.loadingDiv = loadingDiv;
        this.statusDiv = statusDiv;
        this.saveButton = saveButton;
        this.resetButton = resetButton;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Input change events (for enabling/disabling save button)
        this.form.addEventListener('input', () => {
            // Enable save button when any input changes
            if (this.saveButton) {
                this.saveButton.disabled = false;
            }
        });
    }

    /**
     * Load settings from the server
     */
    async loadSettings() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        this.clearStatus();
        
        try {
            const config = await this.configManager.load();
            this.populateForm(config);
            this.saveButton.disabled = true; // Disable save button after loading
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showStatus('error', 'Failed to load settings');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    /**
     * Save settings to the server
     */
    async saveSettings() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        this.clearStatus();
        
        try {
            const formData = this.getFormData();
            await this.configManager.save(formData);
            this.showStatus('success', this.config.saveSuccessText);
            this.saveButton.disabled = true; // Disable save button after saving
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatus('error', `${this.config.saveErrorText}: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    /**
     * Handle reset button click
     */
    async handleReset() {
        if (confirm(this.config.resetConfirmText)) {
            try {
                await this.configManager.reset();
                await this.loadSettings(); // Reload the form with default values
                this.showStatus('success', 'Settings reset to defaults');
            } catch (error) {
                console.error('Error resetting settings:', error);
                this.showStatus('error', 'Failed to reset settings');
            }
        }
    }

    /**
     * Populate the form with configuration values
     * @param {Object} config - Configuration object
     */
    populateForm(config) {
        if (!this.formGroups) return;
        
        // Clear existing form groups
        this.formGroups.innerHTML = '';
        this.fields = [];
        
        // Group settings by category
        const categories = this.groupSettingsByCategory(config);
        
        // Create a form group for each category
        for (const [category, settings] of Object.entries(categories)) {
            const fieldset = document.createElement('fieldset');
            fieldset.className = 'settings-category';
            
            const legend = document.createElement('legend');
            legend.textContent = this.formatCategoryName(category);
            fieldset.appendChild(legend);
            
            // Add form fields for each setting
            for (const [key, value] of Object.entries(settings)) {
                const field = this.createFormField(key, value);
                if (field) {
                    fieldset.appendChild(field);
                    this.fields.push(key);
                }
            }
            
            this.formGroups.appendChild(fieldset);
        }
        
        // Re-attach event listeners
        this.setupEventListeners();
    }

    /**
     * Group settings by category based on naming convention (e.g., WORDPRESS_URL -> wordpress)
     * @param {Object} config - Configuration object
     * @returns {Object} Grouped settings
     */
    groupSettingsByCategory(config) {
        const categories = {};
        
        for (const [key, value] of Object.entries(config)) {
            // Skip null/undefined values
            if (value === null || value === undefined) continue;
            
            // Determine category from key (e.g., WORDPRESS_URL -> wordpress)
            let category = 'general';
            const match = key.match(/^([A-Z]+)_/);
            if (match && match[1]) {
                category = match[1].toLowerCase();
            }
            
            // Initialize category if it doesn't exist
            if (!categories[category]) {
                categories[category] = {};
            }
            
            // Add setting to category
            categories[category][key] = value;
        }
        
        return categories;
    }

    /**
     * Format a category name for display
     * @param {string} name - Category name
     * @returns {string} Formatted name
     */
    formatCategoryName(name) {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Create a form field for a setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     * @returns {HTMLElement} Form group element
     */
    createFormField(key, value) {
        // Skip certain keys
        if (key === 'NODE_ENV' || key === 'PORT' || key === 'FRONTEND_PORT') {
            return null;
        }
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.htmlFor = `setting-${key}`;
        label.textContent = this.formatSettingName(key);
        
        let input;
        
        // Determine input type based on key or value type
        if (key.toLowerCase().includes('password') || key === 'WORDPRESS_TOKEN') {
            // Password field
            input = document.createElement('input');
            input.type = 'password';
            input.value = value || '';
            
            // Add show/hide toggle for password fields
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            
            input.className = 'form-control';
            input.id = `setting-${key}`;
            input.name = key;
            input.dataset.originalValue = value || '';
            
            const inputGroupAppend = document.createElement('div');
            inputGroupAppend.className = 'input-group-append';
            
            const toggleButton = document.createElement('button');
            toggleButton.className = 'btn btn-outline-secondary';
            toggleButton.type = 'button';
            toggleButton.innerHTML = '👁️';
            toggleButton.title = 'Show/hide';
            toggleButton.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggleButton.innerHTML = '👁️';
                } else {
                    input.type = 'password';
                    toggleButton.innerHTML = '👁️';
                }
            });
            
            inputGroupAppend.appendChild(toggleButton);
            inputGroup.appendChild(input);
            inputGroup.appendChild(inputGroupAppend);
            
            formGroup.appendChild(label);
            formGroup.appendChild(inputGroup);
        } else if (typeof value === 'boolean') {
            // Checkbox for boolean values
            const div = document.createElement('div');
            div.className = 'custom-control custom-switch';
            
            input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'custom-control-input';
            input.id = `setting-${key}`;
            input.name = key;
            input.checked = Boolean(value);
            input.dataset.originalValue = value;
            
            const inputLabel = document.createElement('label');
            inputLabel.className = 'custom-control-label';
            inputLabel.htmlFor = `setting-${key}`;
            
            div.appendChild(input);
            div.appendChild(inputLabel);
            
            formGroup.appendChild(label);
            formGroup.appendChild(div);
        } else if (typeof value === 'number') {
            // Number input
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-control';
            input.id = `setting-${key}`;
            input.name = key;
            input.value = value;
            input.dataset.originalValue = value;
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
        } else if (Array.isArray(value)) {
            // Textarea for arrays (comma-separated values)
            input = document.createElement('textarea');
            input.className = 'form-control';
            input.id = `setting-${key}`;
            input.name = key;
            input.rows = Math.min(5, Math.max(2, value.length));
            input.value = value.join('\n');
            input.dataset.originalValue = value.join('\n');
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
        } else if (typeof value === 'object' && value !== null) {
            // Textarea for objects (JSON stringified)
            input = document.createElement('textarea');
            input.className = 'form-control';
            input.id = `setting-${key}`;
            input.name = key;
            input.rows = 5;
            input.value = JSON.stringify(value, null, 2);
            input.dataset.originalValue = JSON.stringify(value, null, 2);
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
        } else {
            // Default to text input
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.id = `setting-${key}`;
            input.name = key;
            input.value = value || '';
            input.dataset.originalValue = value || '';
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
        }
        
        // Add help text for certain fields
        const helpText = this.getHelpText(key);
        if (helpText) {
            const small = document.createElement('small');
            small.className = 'form-text text-muted';
            small.textContent = helpText;
            formGroup.appendChild(small);
        }
        
        return formGroup;
    }

    /**
     * Format a setting name for display
     * @param {string} name - Setting name
     * @returns {string} Formatted name
     */
    formatSettingName(name) {
        return name
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    /**
     * Get help text for a setting
     * @param {string} key - Setting key
     * @returns {string} Help text
     */
    getHelpText(key) {
        const helpTexts = {
            'WORDPRESS_URL': 'The base URL of your WordPress installation (e.g., https://example.com)',
            'WORDPRESS_USERNAME': 'WordPress username for authentication',
            'WORDPRESS_TOKEN': 'Application password or token for WordPress authentication',
            'OLLAMA_BASE_URL': 'Base URL for the Ollama API (default: http://localhost:11434)',
            'DEFAULT_MODEL': 'Default Ollama model to use for text generation',
            'DEFAULT_GITHUB_PATH': 'Default path to scan for Git repositories',
            'GIT_SCAN_DEPTH': 'Maximum depth to scan for Git repositories',
            'ARTICLE_STYLE': 'Default style for generated articles (e.g., first_person, professional)',
            'ARTICLE_TONE': 'Default tone for generated articles (e.g., formal, casual)',
            'ARTICLE_LANGUAGE': 'Default language for generated articles',
            'LOG_LEVEL': 'Logging level (error, warn, info, debug)'
        };
        
        return helpTexts[key] || '';
    }

    /**
     * Get form data as an object
     * @returns {Object} Form data
     */
    getFormData() {
        const formData = {};
        const formElements = this.form.elements;
        
        for (const element of formElements) {
            if (element.name && this.fields.includes(element.name)) {
                if (element.type === 'checkbox') {
                    formData[element.name] = element.checked;
                } else if (element.tagName === 'TEXTAREA' && element.value) {
                    // Try to parse as JSON if it looks like JSON
                    if (element.value.trim().startsWith('{') || element.value.trim().startsWith('[')) {
                        try {
                            formData[element.name] = JSON.parse(element.value);
                        } catch (e) {
                            // If not valid JSON, treat as plain text
                            formData[element.name] = element.value;
                        }
                    } else {
                        // For multiline text, split by newlines and trim each line
                        formData[element.name] = element.value
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0);
                    }
                } else if (element.value !== '') {
                    // Convert numeric strings to numbers if they look like numbers
                    formData[element.name] = isNaN(Number(element.value)) 
                        ? element.value 
                        : Number(element.value);
                }
            }
        }
        
        return formData;
    }

    /**
     * Show or hide the loading indicator
     * @param {boolean} show - Whether to show the loading indicator
     */
    showLoading(show) {
        if (this.loadingDiv) {
            this.loadingDiv.style.display = show ? 'block' : 'none';
        }
        
        // Disable form elements while loading
        const formElements = this.form.elements;
        for (const element of formElements) {
            if (element.tagName !== 'FIELDSET') {
                element.disabled = show;
            }
        }
    }

    /**
     * Show a status message
     * @param {string} type - Message type (success, error, info, warning)
     * @param {string} message - Message text
     */
    showStatus(type, message) {
        if (!this.statusDiv) return;
        
        this.statusDiv.textContent = message;
        this.statusDiv.className = `settings-status alert alert-${type}`;
        this.statusDiv.setAttribute('role', 'alert');
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.clearStatus();
            }, 5000);
        }
    }

    /**
     * Clear the status message
     */
    clearStatus() {
        if (this.statusDiv) {
            this.statusDiv.textContent = '';
            this.statusDiv.className = 'settings-status';
            this.statusDiv.removeAttribute('role');
        }
    }
}

// Export the SettingsPanel class for ES modules
export { SettingsPanel };

// Also make available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.SettingsPanel = SettingsPanel;
}
