# Dandelion - Notes-Extractor
Dandelion is a simple yet powerful Obsidian plugin that transforms long documents full of highlights, quotes, or clippings (such as Kindle exports or Readwise notes) into deeply linked atomic notes in a fraction of a second.

Transform long documents into deeply linked atomic notes and watch dandelions emerge in your Graph View.

![[Dandelion Graph View]](https://imgur.com/a/e7lNwZe)

Instead of manually copying, pasting, and linking your reading highlights one by one, Dandelion automates the entire workflow. It extracts text blocks, creates individual atomic notes, and can optionally replace the original content with block-level transclusions, resulting in a cleaner, more modular, and aesthetically organized vault.

## 🚀 Key Features

- **Separator Generation:** If needed, Dandelion can automatically generate separators before extraction by detecting double line breaks.

- **Smart Extraction:** Automatically detects and extracts text blocks using custom dividers such as `---` or `##`.

- **Targeted Workflow:** Choose whether to extract the entire document, everything below the cursor, or only selected text.

- **Block-Level Transclusions:** Replaces extracted text in the original note with precise block embeds (`![[New Note#^blockId]]`). Your parent document remains intact while becoming a visual map of your atomic notes.

- **Intelligent Titles:** Automatically generates smart file names from the first 50 characters of each clipping. Dandelion avoids cutting words in half and gracefully handles identical beginnings.

- **Custom Folders & Tags:** Keep your vault organized by defining default tags and destination folders directly in the plugin settings.

- **Visual Styles:** Optional built-in CSS refines the visual experience by hiding “Quote” callout titles, concealing block IDs in Reading mode, and giving the properties panel a cleaner aesthetic.

- **Undo Support:** Fully compatible with Obsidian’s native Undo (`Ctrl/Cmd + Z`). Made a mistake during extraction? Restore the original parent note instantly.
  
  

> [!tip] **A Quick Recommendation**
>  
> For your first extraction, consider using a duplicated note and a temporary test folder while exploring the available settings. 
> 
> Undo (`Ctrl/Cmd + Z`) restores the parent note, but does not remove generated atomic notes.


---
## 🛠️ How to Use It

1. Open a note containing reading highlights, quotes, or text blocks.
2. Ensure the blocks are separated by your chosen divider (default: `---`).  
	If your text is only separated by empty lines, select it and run the **Generate Separators** command first.

3. Open the Command Palette (`Ctrl/Cmd + P`) and search for **Dandelion**.
 
4. Choose one of the available extraction commands:

- _Extract all blocks from document_
- _Extract blocks below cursor_
- _Extract selected blocks_

5. Dandelion will create a new note for each block inside your configured folder and optionally replace the original content with clean block transclusions.


### The Transformation

**Before Extraction (Parent Note):**

```
---
Source: [[The Art of War]]
---
Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.

---
```

**After Extraction (Parent Note):**

```
---
Source: [[The Art of War]]
---
![[Let your plans be dark and impenetrable as night...#^x1y2z3]] ^a9b8c7

---
```

**Newly Generated Atomic Note:**

```
---
Source: "[[The Art of War#^a9b8c7|The Art of War]]"
Author: "Sun Tzu"
created: 2026-05-12 16:03
tags: [clipping, quote]
---
>[!quote]
> Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.
> ^x1y2z3
```


## Settings & Customization

You can customize Dandelion’s behavior in `Settings → Dandelion`:

- **Block Separator:** Define the exact string used to separate blocks (e.g., `---` or `##`).
- **Separator Behavior:** Choose whether to discard the separator (ideal for `---`) or keep it as a prefix in the extracted note (ideal for `## Headings`).
- **Embed Style:** Choose between precise Block References (which hide the file title) or standard file embeds (`![[Note]]`).
- **Callout Wrapper:** Toggle automatic wrapping of extracted content inside a `>[!quote]` callout.
- **Destination & Tags:** Define a default destination folder and a comma-separated list of tags to inject into the frontmatter.

## 📥 Installation

1. Download the latest release from the [Releases](https://github.com/slinvao/Dandelion---Notes-Extractor) page.

2. Extract the `main.js`, `manifest.json`, and `styles.css` files.

3. Place them inside your vault's plugin folder: `.obsidian/plugins/dandelion-extractor/`.

4. Reload Obsidian and enable the plugin in `Settings > Community Plugins`.
