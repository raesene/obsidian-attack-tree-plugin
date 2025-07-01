import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf } from 'obsidian';
import { AttackTreeView, ATTACK_TREE_VIEW_TYPE } from './src/AttackTreeView';

interface AttackTreePluginSettings {
	defaultTheme: string;
	autoOpenAttackTrees: boolean;
}

const DEFAULT_SETTINGS: AttackTreePluginSettings = {
	defaultTheme: 'default',
	autoOpenAttackTrees: true
}

export default class AttackTreePlugin extends Plugin {
	settings: AttackTreePluginSettings;

	async onload() {
		await this.loadSettings();

		// Register the attack tree view
		this.registerView(
			ATTACK_TREE_VIEW_TYPE,
			(leaf) => new AttackTreeView(leaf)
		);

		// Register file extensions
		this.registerExtensions(['yaml', 'yml'], ATTACK_TREE_VIEW_TYPE);

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon('git-branch', 'Attack Tree Plugin', (evt: MouseEvent) => {
			this.createNewAttackTree();
		});

		// Add commands
		this.addCommand({
			id: 'create-attack-tree',
			name: 'Create new attack tree',
			callback: () => {
				this.createNewAttackTree();
			}
		});

		this.addCommand({
			id: 'open-attack-tree-view',
			name: 'Open attack tree view for current file',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && this.isAttackTreeFile(activeFile)) {
					if (!checking) {
						this.openAttackTreeView(activeFile);
					}
					return true;
				}
				return false;
			}
		});

		// Auto-open attack tree files
		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile) => {
				if (file && this.settings.autoOpenAttackTrees && this.isAttackTreeFile(file)) {
					this.openAttackTreeView(file);
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new AttackTreeSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private isAttackTreeFile(file: TFile): boolean {
		if (!file) return false;
		
		// Check file extension
		const extension = file.extension.toLowerCase();
		if (extension !== 'yaml' && extension !== 'yml') return false;
		
		return true;
	}

	private async openAttackTreeView(file: TFile) {
		const existingLeaf = this.app.workspace.getLeavesOfType(ATTACK_TREE_VIEW_TYPE)
			.find(leaf => (leaf.view as AttackTreeView).file === file);
		
		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
		} else {
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({
				type: ATTACK_TREE_VIEW_TYPE,
				state: { file: file.path }
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	private async createNewAttackTree() {
		const fileName = 'new-attack-tree.yaml';
		const defaultContent = `title: New Attack Tree

facts:
- reality: Starting point
  from: []

attacks:
- initial_attack: Initial attack vector
  from:
  - reality

mitigations:
- defense: Defense mechanism
  from:
  - initial_attack

goals:
- compromise: System compromise
  from:
  - initial_attack
`;

		try {
			const file = await this.app.vault.create(fileName, defaultContent);
			await this.openAttackTreeView(file);
		} catch (error) {
			new Notice('Failed to create attack tree file');
		}
	}
}

class AttackTreeSettingTab extends PluginSettingTab {
	plugin: AttackTreePlugin;

	constructor(app: App, plugin: AttackTreePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Attack Tree Plugin Settings'});

		new Setting(containerEl)
			.setName('Default Theme')
			.setDesc('Choose the default theme for attack tree visualizations')
			.addDropdown(dropdown => dropdown
				.addOption('default', 'Default')
				.addOption('dark', 'Dark')
				.addOption('classic', 'Classic')
				.addOption('accessible', 'Accessible')
				.setValue(this.plugin.settings.defaultTheme)
				.onChange(async (value) => {
					this.plugin.settings.defaultTheme = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-open Attack Trees')
			.setDesc('Automatically open YAML files in attack tree view when opened')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoOpenAttackTrees)
				.onChange(async (value) => {
					this.plugin.settings.autoOpenAttackTrees = value;
					await this.plugin.saveSettings();
				}));
	}
}
