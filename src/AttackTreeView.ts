import { FileView, TFile, WorkspaceLeaf } from 'obsidian';
import { load } from 'js-yaml';
import { Graphviz } from '@hpcc-js/wasm';
import { instance } from '@viz-js/viz';
import { convertToDot, themes, type Input } from './deciduous-engine';

export const ATTACK_TREE_VIEW_TYPE = 'attack-tree-view';

export class AttackTreeView extends FileView {
    public contentEl: HTMLElement;
    private errorEl: HTMLElement;
    private renderTarget: HTMLElement;
    private editorEl: HTMLTextAreaElement;
    private themeSelector: HTMLSelectElement;
    private exportButtons: HTMLElement;
    private graphviz: any;
    private vizInstance: any;
    private isDark: boolean = false;
    private currentTheme: string = 'default';

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.initializeGraphviz();
    }

    private async initializeGraphviz() {
        try {
            // Try viz.js first as it's more compatible with Obsidian
            this.vizInstance = await instance();
            console.log('Successfully initialized viz.js');
        } catch (vizError) {
            console.warn('Failed to initialize viz.js, trying @hpcc-js/wasm:', vizError);
            
            try {
                // Fallback to @hpcc-js/wasm with better error handling
                this.graphviz = await Graphviz.load();
                console.log('Successfully initialized @hpcc-js/wasm');
            } catch (wasmError) {
                console.error('Both viz.js and @hpcc-js/wasm failed to initialize:', wasmError);
                this.graphviz = null;
                this.vizInstance = null;
            }
        }
    }

    getViewType(): string {
        return ATTACK_TREE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file?.basename || 'Attack Tree';
    }

    getIcon(): string {
        return 'git-branch';
    }

    async onLoadFile(file: TFile): Promise<void> {
        const content = await this.app.vault.read(file);
        this.render(content);
    }

    async onunload() {
        super.onunload();
    }

    protected async onOpen(): Promise<void> {
        this.createView();
    }

    private createView() {
        const container = this.containerEl.children[1];
        container.empty();

        // Create main container with split layout
        const mainContainer = container.createDiv('attack-tree-main');
        mainContainer.style.cssText = `
            display: flex;
            height: 100%;
            flex-direction: row;
        `;

        // Left panel (editor)
        const leftPanel = mainContainer.createDiv('attack-tree-editor-panel');
        leftPanel.style.cssText = `
            width: 40%;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--background-modifier-border);
        `;

        // Editor header
        const editorHeader = leftPanel.createDiv('attack-tree-editor-header');
        editorHeader.style.cssText = `
            padding: 10px;
            border-bottom: 1px solid var(--background-modifier-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        editorHeader.createEl('h3', { text: 'YAML Editor' });

        // Theme selector
        this.themeSelector = editorHeader.createEl('select');
        this.themeSelector.style.cssText = `
            padding: 4px 8px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background: var(--background-primary);
            color: var(--text-normal);
        `;
        
        Object.keys(themes).forEach(themeName => {
            const option = this.themeSelector.createEl('option');
            option.value = themeName;
            option.textContent = themeName;
        });
        
        this.themeSelector.addEventListener('change', () => {
            this.currentTheme = this.themeSelector.value;
            this.updateRender();
        });

        // Editor textarea
        this.editorEl = leftPanel.createEl('textarea');
        this.editorEl.style.cssText = `
            flex: 1;
            resize: none;
            border: none;
            padding: 10px;
            font-family: var(--font-monospace);
            font-size: 12px;
            background: var(--background-primary);
            color: var(--text-normal);
            outline: none;
        `;
        this.editorEl.placeholder = 'Enter attack tree YAML here...';
        this.editorEl.addEventListener('input', () => {
            this.updateRender();
            if (this.file) {
                this.app.vault.modify(this.file, this.editorEl.value);
            }
        });

        // Right panel (visualization)
        const rightPanel = mainContainer.createDiv('attack-tree-viz-panel');
        rightPanel.style.cssText = `
            width: 60%;
            display: flex;
            flex-direction: column;
        `;

        // Visualization header
        const vizHeader = rightPanel.createDiv('attack-tree-viz-header');
        vizHeader.style.cssText = `
            padding: 10px;
            border-bottom: 1px solid var(--background-modifier-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        vizHeader.createEl('h3', { text: 'Attack Tree Visualization' });

        // Export buttons
        this.exportButtons = vizHeader.createDiv('attack-tree-export-buttons');
        this.exportButtons.style.cssText = `
            display: flex;
            gap: 8px;
        `;

        const exportSvg = this.exportButtons.createEl('button', { text: 'Export SVG' });
        exportSvg.style.cssText = `
            padding: 4px 8px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background: var(--interactive-normal);
            color: var(--text-normal);
            cursor: pointer;
        `;
        exportSvg.addEventListener('click', () => this.exportSvg());

        const exportPng = this.exportButtons.createEl('button', { text: 'Export PNG' });
        exportPng.style.cssText = exportSvg.style.cssText;
        exportPng.addEventListener('click', () => this.exportPng());

        // Error display
        this.errorEl = rightPanel.createDiv('attack-tree-error');
        this.errorEl.style.cssText = `
            padding: 10px;
            color: var(--text-error);
            background: var(--background-secondary);
            border: 1px solid var(--text-error);
            border-radius: 4px;
            margin: 10px;
            display: none;
            font-family: var(--font-monospace);
            font-size: 12px;
        `;

        // Render target
        this.renderTarget = rightPanel.createDiv('attack-tree-render');
        this.renderTarget.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 10px;
        `;

        this.contentEl = container as HTMLElement;
    }

    private render(content: string) {
        if (this.editorEl) {
            this.editorEl.value = content;
            this.updateRender();
        }
    }

    private async updateRender() {
        if (!this.editorEl || !this.renderTarget) {
            return;
        }

        // Check if rendering engines are still initializing
        if (this.graphviz === undefined && this.vizInstance === undefined) {
            this.renderTarget.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Initializing Graphviz...</div>';
            return;
        }

        // Check if both rendering engines failed to initialize
        if (this.graphviz === null && this.vizInstance === null) {
            this.showError('Failed to initialize Graphviz rendering engine. Please check your internet connection and try reloading the plugin.');
            this.renderTarget.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-error);">Graphviz initialization failed</div>';
            return;
        }

        const yamlContent = this.editorEl.value;
        
        if (!yamlContent.trim()) {
            this.renderTarget.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Enter YAML content to see attack tree visualization</div>';
            this.hideError();
            return;
        }

        try {
            const parsed = load(yamlContent) as Input;
            
            // Set the selected theme
            if (this.currentTheme) {
                parsed.theme = this.currentTheme;
            }

            const { dot, title } = convertToDot(parsed);
            
            let svg: string;
            if (this.vizInstance) {
                // Use viz.js
                svg = this.vizInstance.renderSVGElement(dot).outerHTML;
            } else if (this.graphviz) {
                // Use @hpcc-js/wasm
                svg = this.graphviz.layout(dot, "svg", "dot");
            } else {
                throw new Error('No rendering engine available');
            }
            
            this.renderTarget.innerHTML = svg;
            
            // Add click handlers for nodes
            this.addNodeClickHandlers();
            
            this.hideError();
            
        } catch (error) {
            this.showError(error.message);
            this.renderTarget.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Error rendering attack tree - see error message above</div>';
        }
    }

    private addNodeClickHandlers() {
        const svgElement = this.renderTarget.querySelector('svg');
        if (!svgElement) return;

        // Add click handlers to nodes
        const nodes = svgElement.querySelectorAll('g.node');
        nodes.forEach(node => {
            const titleEl = node.querySelector('title');
            if (titleEl && titleEl.textContent) {
                const nodeName = titleEl.textContent;
                node.addEventListener('click', () => {
                    this.navigateToNode(nodeName);
                });
                (node as HTMLElement).style.cursor = 'pointer';
            }
        });

        // Add click handlers to edges
        const edges = svgElement.querySelectorAll('g.edge');
        edges.forEach(edge => {
            const titleEl = edge.querySelector('title');
            if (titleEl && titleEl.textContent) {
                const edgeTitle = titleEl.textContent;
                const matches = edgeTitle.match(/^(\w+)->(\w+)$/);
                if (matches) {
                    edge.addEventListener('click', () => {
                        this.navigateToEdge(matches[1], matches[2]);
                    });
                    (edge as HTMLElement).style.cursor = 'pointer';
                }
            }
        });
    }

    private navigateToNode(nodeName: string) {
        const yamlContent = this.editorEl.value;
        const lines = yamlContent.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(`- ${nodeName}:`)) {
                this.selectTextInEditor(i, nodeName.length + 3);
                break;
            }
        }
    }

    private navigateToEdge(fromNode: string, toNode: string) {
        const yamlContent = this.editorEl.value;
        const lines = yamlContent.split('\n');
        
        // Find the toNode first
        let toNodeLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`- ${toNode}:`)) {
                toNodeLine = i;
                break;
            }
        }
        
        if (toNodeLine === -1) return;
        
        // Then find the fromNode in the 'from' section of toNode
        for (let i = toNodeLine + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(`- ${fromNode}`)) {
                this.selectTextInEditor(i, fromNode.length + 3);
                break;
            }
            // Stop if we hit another top-level node
            if (line.match(/^- \w+:/)) {
                break;
            }
        }
    }

    private selectTextInEditor(lineNumber: number, selectionLength: number) {
        const lines = this.editorEl.value.split('\n');
        let start = 0;
        for (let i = 0; i < lineNumber; i++) {
            start += lines[i].length + 1; // +1 for newline
        }
        
        this.editorEl.focus();
        this.editorEl.setSelectionRange(start, start + selectionLength);
    }

    private showError(message: string) {
        this.errorEl.textContent = message;
        this.errorEl.style.display = 'block';
    }

    private hideError() {
        this.errorEl.style.display = 'none';
    }

    private async exportSvg() {
        if (!this.renderTarget) return;
        
        const svgElement = this.renderTarget.querySelector('svg');
        if (!svgElement) return;
        
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.file?.basename || 'attack-tree'}.svg`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    private async exportPng() {
        if (!this.renderTarget) return;
        
        const svgElement = this.renderTarget.querySelector('svg');
        if (!svgElement) return;
        
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
            canvas.width = img.width * 2;
            canvas.height = img.height * 2;
            ctx?.scale(2, 2);
            ctx?.drawImage(img, 0, 0);
            
            canvas.toBlob(blob => {
                if (blob) {
                    const pngUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = pngUrl;
                    a.download = `${this.file?.basename || 'attack-tree'}.png`;
                    a.click();
                    URL.revokeObjectURL(pngUrl);
                }
            });
            
            URL.revokeObjectURL(url);
        };
        
        img.src = url;
    }

    async getViewData(): Promise<string> {
        return this.editorEl?.value || '';
    }

    async setViewData(data: string, clear: boolean): Promise<void> {
        if (clear || !this.editorEl?.value) {
            this.render(data);
        }
    }

    clear(): void {
        if (this.editorEl) {
            this.editorEl.value = '';
        }
        if (this.renderTarget) {
            this.renderTarget.innerHTML = '';
        }
        this.hideError();
    }
}