# Process to email summary and analysis for agent with copilot

Gather sub folder name of email

tell copilot about the subfolder
what kind of summary

## step 2

agent provides: 
  - key themes
  - important updates
  - decisions made (clearly highlighted)
  - action items and owners (if mentioned)
- if you'd like, I can also format for a meeting update or status report

agent recommends 2 ways of getting the summaries to him so he can do work. The first is manually by copying and pasting but that sucks and is only good for one offs. The default response for smaller selectable tasks is to suggest opening target folder in Outlook, selecting either the emails or the entire folder, then clicking copilot and typing into the chat.
For large batches, export the folder and upload it to the agent.

The Agent should then confirm that he has the target data emails but ask for confirmation from the user that these are the right emails and offer a tip to return the best summary: give a time range and a focus, so status updates, decisions, vendor issues, etc) that way he can keep the output short, concise and structured: easy to use in a work update.

## Agent 2: Outlook Email Folder Secretary Agent (connect copilot to outlook and teams OR use power automate OR run once manually to select options and refine result then take resulting workflow and ask to create power automate workflow with scheduled or event based trigger)
1. Agent: So this agent would ask for a folder containing the emails you'd like to get a summary for:
  - a date range, 
  - the standard info: 
  - key themes, 
  - important updates, 
  - decisions made, 
  - action items and owners, 
  - key people
  - whether or not to group related threads, 
  - what you want the summary to be called(default the folder name plus date),
  - any topics that need to be focused more than others. 
  - It should also ask if this concerns a named group of contacts involved and whether or not you should consider any major themes, updatesa decisions, or action items that any group member has been left out of communication and needs to be caught up. Call it a "Same-Page Check" as in "Getting everyone on the same page.
- 1b. User answers if it's manually triggered, otherwise info is filled in from scheduled trigger in power automator
  2. Agent Ask the user how you'd like the summary to be delivered, 
    - via a Page, a word document, or some other method
    -  whether or not he should create any tasks in 
      - Planner or 
      - MS Tasks, 
    - add any important milestones or due dates to your calendar, and 
    - whether or not he should tag or copy a duplicate of any significant correspondence to a new collection folder in outlook. 
  2b. User respponds
  3 Agent: 
    B 1. If this workflow is run manually, 
        - have the agent ask the user to review the results and 
        - refine the deliverable target, 
    B 2. At the end of the manual workflow run when the user is satisfied with the result, ask if 
      - they want to schedule an automation to occur on a schedule or event (such as when new emails arrive), 
        - if yes: when to schedule the start of the next workflow trigger, and
        -  if there are any different deliverables for the scheduled version of the workflow such as 
          - a teams alerts, 
          - an emailed summary,
          - mark a completed task in planner or ms tasks
          - email other contacts
        if no schedule is needed and this is a one off, ask the user if they need any other information or other folders summarized and repeat the process - END


Power Automate Notea

1. create a flow: Create -> Scheduled cloud flow
2. set frequency (weekly, day, time)
3. Get emails from specified folder ("Planning" or other) -> **Get Emails (V3)" - Outlook**
4. Configure:
  5. Folder: "Planning"
  6. Which (Top: 50)
  7. Include Attachments: No **Review for number of emails**
  8. Prepare the email content
    - Add a "Compose" Action: 
      - ``` Join all email bodies + subject lines into one block of text``` OR
      - BETTER: ``` Join all emails into one markdown file with correspondence organized by date and under headers with the subject lines, contact and time, with bodies of text under that **Use Dynamic content Subject + Body)
  9. Add AI Summary
    - Add Action: ` Create text with GPT (AI Builder) `
      - Prompt: ``` Summarize the following emails from a folder named "Planning". Proviide a concise weekly summary using this structure: ```
      ` Key Themes: 2-5 Bullets `
      ` Important Updates (brief updates) `
      ` Decisions Made **BOLD** each decision `
      ` Action Items: `
      ` Numbered List with a priority rating and optional due date if it's within the week `
      ` Keep the tone professional and clear `
      ` If it applies to the situation, consider either drafting a response for the user to approve before sending off or making a note of it in Teams or MS OneNote or add it to MS Tasks `
      ` Emails: {paste dynamic content from previous step}`
    10. Send Summary Email
          - Add Action: `Send an email (V2)`
          - Configure action: 
            - To: You
            - Subject Weekly Planning Email Folder - {Date}
            - Body: Output from AI Step
  ### Tips
  - email number reasonable (under 100 per run)
  - consistent subject lines for easy grouping
  - review and treat it like a fluid process, add filters to refine result or add filter to exclude auto generated messages
  - break into daily reports (highly recommended) and weekly rollups on friday or monday morning
  - add a teams posting
  - add a running log (call it the agent's memory) in one note. learnings, common contact groups, common missed deadlines, recommended new actions, etc
  - add a scheduler to refine and tailor and make better once a week
  - vendor specific summaries which are great for sourcing work
    ### NOTES
  the input box for combining emails paste:
  ```
Join(
  outputs('Select'),
  '\n\n---\n\n
)
  ```
once you are to the ai summary prompt action, click inside the prompt box and click add dynamic content: Select **Outputs** from Compose Step

- **SUBJECT LINE DATE SUBSTITUTION**
- Weekly Planning Summary - @{utcNow('MM/dd?yyyy')}
- Exclude Noise : Add condition: Skip subjects containing:
  - "RE:" - not sure about this one
  - "FW:"
  - "Auto"
  -
