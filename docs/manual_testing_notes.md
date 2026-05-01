# Manual Testing Notes

> 5/1/26
- chat has no stop button
- Context Sidebar with Project Docs has unreadable titles. Needs a tooltip and a second line for the buttons
- I attempted to attach a file from google drive that was an html file with an html table in it that contained a list of RFP Questions ripped from the BidNET site. It was horrible horrible code and extremely bloated so it was better to write an extraction script. While attempting this, I was unable to get it to recognize the file as context although the checkbox was checked. I tried from both an import from google drive and by uploading it. Neither seemed to get through to the chat. I then tried to copy and paste the contents but it took forever.
- - really need a way to turn a docx into a markdown file, might want to install an mcp server or two alongside the web server
- Notes rich text editor is buggy. The toggle button is backwards. It's missing a link function.
-importing questions from google sheets sucks. It looks for a header row with the string 'question' but i have a title row and a header row beneath that, which is 'questions' and it gave me an error. i created another google sheet with a single header row with the string 'question' and it gave me an error on import "Import failed: IDBDatabase.transaction: 'questions' is not a known object store name"

- need a way to instruct and monitor the chunking for vector search progress or status
- add calendar widget for tasks in the sidebar right
- if running in server mode need a way to have the user backup their stuff to the server if they want
- there's another sub project here that pertains to the Q&A portion of the job/tool I built separately: it is located in the .private-documents folder under the Supplier_Q_AND_A folder. You can grok that project by reading the README.md, the WORKFLOW.md and the projects/RFP_F-75/input/memory-final.md. I'd like you to adapt the scripts inside the scripts folder there to add tools to the web ui for sourcedesk. Think about a plan to do that and how to adapt that tool for use here. Also when questions are added to the "questions" view, I'd like to be able to batch 10 at a time with comments in between and keep a running count of both unanswered questions and also questions that may be answered by ai but need further detail or confirmation on being fully correct. a confidence level along with that would be nice. a summary at the end as a deliverable would be great. You can see the deliverables i generated for the first run in the project folder. there's also an intermediate folder for artifacts from importing from the bidnet UI.
