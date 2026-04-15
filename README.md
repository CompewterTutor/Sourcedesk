# Sourcedesk

An in-browser makeshift RAG and Project Management system for the web version of Claude. Runs completely in browser, single file, uses IndexedDB for persistent storage.

## Usage
1. Save the file and open it in a modern web browser.
2. Go to Settings > Paste your API Key
3. Create a new project and start using it. You can add files to the project, create templates and Claude will consider any and all files in the project to be part of the context.

---


## Features

### Storage
100% IndexedDB. API key, all templates, all projects, all uploaded docs, and full chat history per project persist across sessions. Nothing goes anywhere except the Anthropic API.

### Projects
created from a template or blank. Each project has its own doc collection, its own chat history, and its own working document (the template content gets copied in as an editable draft).

### Context Panel
 This shows exactly what Claude can "see": the attached template, all uploaded docs with toggles to include/exclude each one individually, and checkboxes to pull in docs from other projects too. You can upload .txt, .md, .csv, .pdf, and .docx files.
 
 ### Retrieval
 BM25 over chunked doc text. When you sends a message, it scores all active chunks against the query, pulls the top 4, and injects them into the system prompt. Each reply shows which docs were referenced.
 
 ## Roadmap for future features
 - **Global Instructions** - a set of instructions that can be set to be included in the system prompt for all projects, or on a per-project basis.
 - **Custom Prompt Templates** - ability to create and save custom system prompt templates that can be applied to projects. This would allow users to easily switch between different prompting strategies or frameworks.
 - **Create template from document**: Upload a doc, create a new skeleton with an interactive process to create placeholder variables and choose which content to keep static. Automatically creates placeholders for dates, times, names, and other entities.
 - **Google Drive Connector**: Claude can search/fetch docs on demand. This is basically free lightweight RAG with no setup. Add files directly to a project or reference directly on your google drive. Auto-sync your IndexedDB with a specific Drive folder for backup and cross-device access.
 - **Project Deliverables** - a feature to define and manage the expected outputs/documents/artifacts or results for a project, including deadlines, milestones, and responsible team members. For example an RFP might have the RFP document, and the attached files like Pricing Structure, example proposals, job descriptions, addendums, etc. as deliverables. Ability to export to Google Drive or download an archive of these deliverables in a structured format (e.g. JSON or CSV) or a zip file of generated docx/pdf files.
 - **Project/Template Variables and Constants**: a separate group of variables that you can set to be globally or locally available. Can be used in templates instead of {{PLACEHOLDER}} and will be auto-filled on template-based document creation. Support for simple date expressions (e.g. {{TODAY+7}}) and auto-extraction of variables from uploaded documents (e.g. extract all dates and names and offer to save them as constants).
 - **Notes** - a simple text editor for jotting down thoughts or pasting in emails. Emails get parsed for contact info and dates, which can be saved as constants or added to the important contacts/resources section.
 - **Important Contacts/Resources** - a place to store important contact info and links that are applicable to the project. Meta data can include tags, contact info, notes, etc. Can be set to be included in context.
 - **Org Charts** - a simple org chart creator and viewer that can be used to visualize team structures, project stakeholders, or any other hierarchical information relevant to the project. Can be set to be included in context.
 - **Versioning** - ability to save versions of the working document as you iterate on it, with the option to roll back to previous versions.
 - **Database Export/Import** - ability to export the entire IndexedDB database as a JSON file for backup or transfer, and to import it back in.
 - **Mobile Optimization** - improve the UI and UX for mobile devices, including better handling of the context panel and chat interface on smaller screens.
 - **Project/Chat Export** - ability to export the chat history and associated docs for a project as a single file (e.g. JSON or PDF) for sharing or archiving.
 - **Project Type Creation/Editing** - ability to create and edit project templates that include predefined instructions, document structures, and other settings to streamline the creation of new projects for common use cases (e.g. meeting notes, research projects, writing projects, etc.).
 - **Enhanced Retrieval** - implement more advanced retrieval techniques such as semantic search using embeddings, or a hybrid approach that combines BM25 with semantic similarity to improve the relevance of retrieved documents.
 - **Vendor Catalog**: A directory of vendors, consultants, freelancers, and agencies categorized by industry, expertise, and services offered. Each entry includes contact info, notes, and tags. Can be set to be included in context for relevant projects.
 - **Calendar Integration**: Sync important dates, deadlines, and meetings from your calendar to the project timeline. This can help keep track of project milestones and ensure timely follow-ups.
 - **Task Management**: A simple task management system within each project to create, assign, and track tasks related to the project. Tasks can have due dates, priority levels, and status indicators.
 -
