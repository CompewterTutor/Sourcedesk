# Bidnet research for chrome extension

## Overview

### Links
- Solicitations: https://www.bidnetdirect.com/private/buyer/solicitations?target=clear
- Individual Solicitation/RFP page("Preview"):https://www.bidnetdirect.com/private/buyer/solicitations/8679572376
- Q&A page:https://www.bidnetdirect.com/private/buyer/solicitations/8679572376/questions-answers

### Relevant page elements

**Question and Answer Table Page**
> This is the main page our plugin will be working with along with individual question pages. At the top there are filter tools as well as information on how many questions, how many are open/answered and published
Table Header has buttons for expanding/collapsing questions and answers and also an action button that can batch publish public answers only.

individual question 3 dot button: reveals "Answer" and "Edit Answer"

table with rows of questions, columns for:
  - question number
  - vendor name
  - Question and Answer
    - has Collapsable Stacked elements with Question and Answer, can be batch expanded with element at top of table
  - Question Date
  - Answer Date
  - Action Menu (Answer, Edit Answer, Forward)
  - Pagination and perPage selectors (up to 100 per page)
  element information in the bidnet_src directory with examples of full html source
  - Private answered questions have a lock icon under the question number

  **Individual Question Page**
  - Publish Button
  - Dropdown to select answer visibility (Public, Private)
  - Answer Text Edit box
  - Comment Edit Box
  - "Save and Quit" button (submit form)
  - submission returns to the table of questions and answers but is scrolled to the top
  
**URL CAN BE MANIPULATED TO SHOW MORE THAN 100 QUESTIONS PER PAGE**
In our first project's case we are able to see all 220 questions per page by changing the url to https://www.bidnetdirect.com/private/buyer/solicitations/8679572376/questions-answers?searchCriteria.pageSize=220&searchCriteria.pageNumber=1
