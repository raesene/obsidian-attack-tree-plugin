# Attack Tree Plugin for Obsidian

An Obsidian plugin that allows you to create and visualize attack trees using YAML files in the deciduous format. This plugin provides a rich, interactive interface for security analysis and threat modeling.

## Features

- **YAML Editor**: Split-pane interface with syntax-aware YAML editor
- **Real-time Visualization**: Live attack tree rendering using Graphviz
- **Interactive Navigation**: Click on nodes and edges to navigate to source YAML
- **Multiple Themes**: Support for default, dark, classic, and accessible themes  
- **Export Options**: Export attack trees as SVG or PNG images
- **Auto-detection**: Automatically opens YAML files in attack tree view
- **Customizable Settings**: Configure default themes and auto-open behavior

## Installation

1. Copy the plugin files to your Obsidian plugins directory:
   ```
   .obsidian/plugins/attack-tree-plugin/
   ```

2. Enable the plugin in Obsidian Settings > Community Plugins

## Usage

### Creating Attack Trees

1. Use the ribbon icon (git-branch) or command palette to create a new attack tree
2. Or create a YAML file manually with attack tree structure

### YAML Format

Attack trees use the deciduous YAML format:

```yaml
title: Example Attack Tree

facts:
- reality: Starting point
  from: []

attacks:
- phishing: Phishing attack
  from:
  - reality
- credential_theft: Steal credentials
  from:
  - phishing

mitigations:
- mfa: Multi-factor authentication
  from:
  - credential_theft

goals:
- data_breach: Access sensitive data
  from:
  - credential_theft
```

### Key Components

- **facts**: Starting conditions or known states
- **attacks**: Attack vectors and techniques
- **mitigations**: Defensive measures and controls
- **goals**: Target objectives or compromise states

Each node can have:
- A descriptive label
- `from` array listing prerequisite nodes
- Special properties like `backwards: true` or `implemented: false`

### Themes

Choose from multiple visualization themes:
- **default**: Standard color scheme
- **dark**: Dark mode friendly
- **classic**: Traditional Graphviz styling  
- **accessible**: High contrast for accessibility

## Example Files

The plugin includes several example attack tree files:
- `s3-bucket-video-recordings.yaml` - S3 bucket security analysis
- `cryptominer-in-container.yaml` - Container security scenario

## Commands

- **Create new attack tree**: Generate a new YAML template
- **Open attack tree view**: Open current YAML file in attack tree view

## Settings

Configure the plugin in Settings > Attack Tree Plugin:
- **Default Theme**: Choose visualization theme
- **Auto-open Attack Trees**: Automatically open YAML files in attack tree view

## Development

Built using:
- TypeScript
- Obsidian Plugin API
- Deciduous attack tree engine
- Graphviz for visualization
- js-yaml for YAML parsing

## Credits

Based on the [Deciduous](https://github.com/rpetrich/deciduous) project by Ryan Petrich and Kelly Shortridge.
