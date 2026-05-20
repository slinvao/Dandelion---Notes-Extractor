const { Plugin, PluginSettingTab, Setting, Notice, TFolder, AbstractInputSuggest } = require('obsidian');

class FolderSuggest extends AbstractInputSuggest {
    constructor(app, inputEl) {
        super(app, inputEl);
        this.inputElement = inputEl;
    }
    getSuggestions(inputStr) {
        const folders = this.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder);
        const lowerCaseInputStr = inputStr.toLowerCase();
        return folders.filter(folder => folder.path.toLowerCase().includes(lowerCaseInputStr));
    }
    renderSuggestion(folder, el) {
        el.setText(folder.path);
    }
    selectSuggestion(folder, evt) {
        this.inputElement.value = folder.path;
        this.inputElement.dispatchEvent(new Event('input'));
        this.close();
    }
}

const DEFAULT_SETTINGS = {
    separator: '---',
    separatorBehavior: 'discard', 
    replaceWithEmbed: true,
    embedStyle: 'block', 
    wrapInQuote: true,
    destinationFolder: '',
    defaultTags: '',
    hideQuoteTitle: false,
    hideBlockIds: false,
    cleanProperties: false
};

class DandelionExtractorPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.toggleCustomCSS();
        this.addSettingTab(new DandelionSettingTab(this.app, this));

        this.addCommand({
            id: 'extract-all',
            name: 'Extract ALL blocks from document',
            editorCallback: (editor, view) => {
                this.extractClippings(view.file, 'all', editor);
            }
        });

        this.addCommand({
            id: 'extract-from-cursor',
            name: 'Extract blocks from cursor down',
            editorCallback: (editor, view) => {
                this.extractClippings(view.file, 'cursor', editor);
            }
        });

        this.addCommand({
            id: 'extract-selection',
            name: 'Extract only selected blocks',
            editorCallback: (editor, view) => {
                const selection = editor.getSelection();
                if (!selection) {
                    new Notice('Please select the text you want to extract first.');
                    return;
                }
                this.extractClippings(view.file, 'selection', editor);
            }
        });

        this.addCommand({
            id: 'generate-separators',
            name: 'Generate separators in selection (Auto-format empty lines)',
            editorCallback: (editor, view) => {
                this.generateSeparators(editor, view);
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.toggleCustomCSS();
    }

    toggleCustomCSS() {
        const body = document.body;
        if (this.settings.hideQuoteTitle) body.classList.add('clippings-hide-quote-title');
        else body.classList.remove('clippings-hide-quote-title');

        if (this.settings.hideBlockIds) body.classList.add('clippings-hide-block-ids');
        else body.classList.remove('clippings-hide-block-ids');

        if (this.settings.cleanProperties) body.classList.add('clippings-clean-properties');
        else body.classList.remove('clippings-clean-properties');
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    generateBlockId() {
        return Math.random().toString(36).substring(2, 8);
    }

    generateSeparators(editor, view) {
        if (!editor.somethingSelected()) {
            new Notice('Please select the text where you want to generate separators first.');
            return;
        }
        const sepPattern = this.settings.separator.trim();
        const selection = editor.getSelection();
        const blocks = selection.trim().split(/\n{2,}/);
        const processedBlocks = blocks.map(b => b.trim()).filter(b => b.length > 0 && b !== sepPattern);
        
        const newText = processedBlocks.join(`\n\n${sepPattern}\n`);
        
        editor.replaceSelection(newText);
        new Notice('Success! Separators generated in your selection.');
    }

    async extractClippings(file, mode = 'all', editor = null) {
        const originalContent = editor ? editor.getValue() : await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);

        let parentAuthor = "";
        if (cache && cache.frontmatter) {
            parentAuthor = cache.frontmatter.autor || cache.frontmatter.author || "";
        }

        let unextractedContentBefore = "";
        let contentToProcess = "";
        let unextractedContentAfter = "";

        if (mode === 'selection' && editor) {
            const fromOffset = editor.posToOffset(editor.getCursor('from'));
            const toOffset = editor.posToOffset(editor.getCursor('to'));
            unextractedContentBefore = originalContent.substring(0, fromOffset);
            contentToProcess = originalContent.substring(fromOffset, toOffset);
            unextractedContentAfter = originalContent.substring(toOffset);
        } else if (mode === 'cursor' && editor) {
            const cursorLine = editor.getCursor().line;
            const cursorOffset = editor.posToOffset({line: cursorLine, ch: 0});
            unextractedContentBefore = originalContent.substring(0, cursorOffset);
            contentToProcess = originalContent.substring(cursorOffset);
        } else {
            if (cache && cache.frontmatterPosition) {
                const endPos = cache.frontmatterPosition.end.offset;
                unextractedContentBefore = originalContent.substring(0, endPos);
                contentToProcess = originalContent.substring(endPos);
            } else {
                contentToProcess = originalContent;
            }
        }

        const sepPattern = this.escapeRegExp(this.settings.separator);
        const regex = new RegExp(`(?:^|\\n)(?=[ \\t]*${sepPattern})`);
        const chunks = contentToProcess.split(regex);
        
        let createdCount = 0;
        let newParentChunks = [];

        let targetFolder = this.settings.destinationFolder;
        if (!targetFolder) {
            targetFolder = file.parent.path === '/' ? '' : file.parent.path + '/';
        } else {
            if (!targetFolder.endsWith('/')) targetFolder += '/';
            const folderObj = this.app.vault.getAbstractFileByPath(targetFolder.slice(0, -1));
            if (!folderObj) {
                try {
                    await this.app.vault.createFolder(targetFolder.slice(0, -1));
                } catch (e) {
                    console.error("Error creating folder:", e);
                }
            }
        }

        for (let i = 0; i < chunks.length; i++) {
            let chunk = chunks[i];
            
            if (this.settings.separatorBehavior === 'discard') {
                const discardRegex = new RegExp(`^[ \\t]*${sepPattern}`);
                chunk = chunk.replace(discardRegex, '');
            }
            
            let trimmed = chunk.trim();
            if (trimmed.length === 0) {
                if (!this.settings.replaceWithEmbed) newParentChunks.push(chunks[i]);
                continue;
            }

            let cleanText = trimmed.replace(/[\/\\:*?"<>|#^\[\]]/g, '').replace(/\n/g, ' ').trim();
            let safeName = cleanText;
            
            if (safeName.length > 50) {
                let cutStr = safeName.substring(0, 50);
                let lastSpace = cutStr.lastIndexOf(' '); 
                if (lastSpace > 0) {
                    safeName = cutStr.substring(0, lastSpace) + '...'; 
                } else {
                    safeName = cutStr + '...'; 
                }
            }
            
            if (!safeName) safeName = 'Note';
            
            let fileName = `${safeName}.md`;
            let newFilePath = `${targetFolder}${fileName}`;
            let counter = 1;

            while (this.app.vault.getAbstractFileByPath(newFilePath)) {
                fileName = `${safeName} ${counter}.md`;
                newFilePath = `${targetFolder}${fileName}`;
                counter++;
            }

            const parentBlockID = this.generateBlockId();
            const childBlockID = this.generateBlockId();
            const dateStr = window.moment().format('YYYY-MM-DD HH:mm');
            const safeAuthor = parentAuthor.replace(/"/g, '\\"'); 
            
            const tagsArray = this.settings.defaultTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
            const formattedTags = tagsArray.length > 0 ? `[${tagsArray.join(', ')}]` : '[]';
            
            let noteBody = "";
            if (this.settings.wrapInQuote) {
                const quoteContent = trimmed.split('\n').map(line => `> ${line}`).join('\n');
                noteBody = `>[!quote]\n${quoteContent}\n> ^${childBlockID}`;
            } else {
                noteBody = `${trimmed}\n\n^${childBlockID}`;
            }

            let sourceLink = "";
            if (this.settings.embedStyle === 'block') {
                sourceLink = `"[[${file.basename}#^${parentBlockID}|${file.basename}]]"`;
            } else {
                sourceLink = `"[[${file.basename}]]"`;
            }

            const newNoteContent = `---
source: ${sourceLink}
author: "${safeAuthor}"
created: ${dateStr}
tags: ${formattedTags}
---
${noteBody}
`;

            try {
                await this.app.vault.create(newFilePath, newNoteContent);
                createdCount++;
                
                if (this.settings.replaceWithEmbed) {
                    if (this.settings.embedStyle === 'block') {
                        newParentChunks.push(`![[${fileName.replace('.md', '')}#^${childBlockID}]] ^${parentBlockID}`);
                    } else {
                        newParentChunks.push(`![[${fileName.replace('.md', '')}]]`);
                    }
                } else {
                    newParentChunks.push(chunks[i]);
                }
            } catch (error) {
                console.error("Error creating note:", error);
                newParentChunks.push(chunks[i]); 
            }
        }

        if (this.settings.replaceWithEmbed && createdCount > 0) {
            const joinSeparator = this.settings.separatorBehavior === 'discard' 
                ? `\n\n${this.settings.separator}\n` 
                : `\n\n`;
                
            let newContent = "";
            
            if (mode === 'selection') {
                newContent = unextractedContentBefore + newParentChunks.join(joinSeparator) + unextractedContentAfter;
            } else {
                newContent = unextractedContentBefore + (unextractedContentBefore && unextractedContentBefore.endsWith('\n') ? '' : '\n') + newParentChunks.join(joinSeparator) + unextractedContentAfter;
            }
            
            if (editor) {
                editor.setValue(newContent);
            } else {
                await this.app.vault.modify(file, newContent);
            }
        }

        new Notice(`Success! Created ${createdCount} atomic notes.`);
    }
}

class DandelionSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h3', {text: 'Extraction Settings'});

        new Setting(containerEl)
            .setName('Block Separator')
            .setDesc('The text/markdown used to extract notes AND to generate new separators (e.g., "---" or "## ").')
            .addText(text => text
                .setPlaceholder('---')
                .setValue(this.plugin.settings.separator)
                .onChange(async (value) => {
                    this.plugin.settings.separator = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Separator Behavior')
            .setDesc('Choose what to do with the separator when creating the new note.')
            .addDropdown(dropdown => dropdown
                .addOption('discard', 'Discard separator (Best for "---")')
                .addOption('keep', 'Keep separator as prefix (Best for "## ")')
                .setValue(this.plugin.settings.separatorBehavior)
                .onChange(async (value) => {
                    this.plugin.settings.separatorBehavior = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Wrap extracted text in a Quote Callout')
            .setDesc('If enabled, the new note will wrap the text in a >[!quote] block.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.wrapInQuote)
                .onChange(async (value) => {
                    this.plugin.settings.wrapInQuote = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Original Note Behavior'});

        new Setting(containerEl)
            .setName('Replace original with transclusion')
            .setDesc('Replaces the extracted text in the parent note with an embed (![[Note]]).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.replaceWithEmbed)
                .onChange(async (value) => {
                    this.plugin.settings.replaceWithEmbed = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Embed Style')
            .setDesc('How the transclusion will look in the parent note.')
            .addDropdown(dropdown => dropdown
                .addOption('block', 'Block Reference (Hidden title, precise link)')
                .addOption('standard', 'Standard File Embed (Shows title)')
                .setValue(this.plugin.settings.embedStyle)
                .onChange(async (value) => {
                    this.plugin.settings.embedStyle = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Destination & Metadata'});

        new Setting(containerEl)
            .setName('Destination Folder')
            .setDesc('Where the new atomic notes will be saved. Shows autocomplete suggestions.')
            .addText(text => {
                new FolderSuggest(this.app, text.inputEl);
                text.setPlaceholder('e.g., Clippings')
                    .setValue(this.plugin.settings.destinationFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.destinationFolder = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Default Tags')
            .setDesc('Tags added to the new notes (comma separated). Leave empty for none.')
            .addText(text => text
                .setPlaceholder('quote, clipping')
                .setValue(this.plugin.settings.defaultTags)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTags = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: 'Visual Styles (CSS)'});

        new Setting(containerEl)
            .setName('Hide "Quote" title')
            .setDesc('Hides the native callout title for a cleaner design.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideQuoteTitle)
                .onChange(async (value) => {
                    this.plugin.settings.hideQuoteTitle = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Hide Block IDs')
            .setDesc('Hides the ^x1y2z3 codes from Reading View.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideBlockIds)
                .onChange(async (value) => {
                    this.plugin.settings.hideBlockIds = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Clean Properties Panel')
            .setDesc('Hides the "Properties" title and only shows the add button on hover.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.cleanProperties)
                .onChange(async (value) => {
                    this.plugin.settings.cleanProperties = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = DandelionExtractorPlugin;
