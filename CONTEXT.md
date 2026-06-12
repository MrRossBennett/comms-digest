# Comms Digest

Comms Digest helps a household understand and act on school communications concerning its children. The initial domain is intentionally school-specific; broader correspondence processing is a possible application of the underlying approach, not part of the product language.

## Language

**Household**:
The family unit whose school communications and responsibilities are collected into one view. A **Household** has one **Household Owner** and one or more **Children** in the first version.
_Avoid_: Account, tenant, customer

**Household Owner**:
The adult responsible for configuring a **Household** and reviewing its **Digest**. The first version has exactly one **Household Owner** per **Household**.
_Avoid_: User, administrator, parent account

**Child**:
A young person in a **Household** whose **School** and school year help determine which communications are relevant.
_Avoid_: Student, pupil, dependent

**School**:
An educational organisation attended by one or more **Children** in a **Household** and responsible for issuing relevant **School Communications**.
_Avoid_: Institution, organisation, provider

**School Communication**:
A message or document issued by a school or school-related service that may contain information or responsibilities relevant to one or more **Children**.
_Avoid_: Correspondence, content, document

**Communication Source**:
A sender or recurring origin of **School Communications**, such as a school office, teacher, club, or school messaging service. A confirmed **Communication Source** may be relevant to one or more **Children** or the whole **Household**.
_Avoid_: Sender rule, Gmail filter, contact

**Source Review**:
The onboarding step in which the **Household Owner** confirms, rejects, and assigns discovered **Communication Sources** before the first **Digest** is produced.
_Avoid_: Inbox setup, sender configuration

**Digest**:
A prioritised view of relevant information and responsibilities derived from **School Communications** for a **Household**. It is organised into **Act Now**, **Coming Up**, and **Good to Know**.
_Avoid_: Summary, feed, newsletter

**Act Now**:
The part of a **Digest** containing unresolved **Responsibilities** that require the **Household Owner** to do or decide something, usually by a stated deadline.
_Avoid_: To-do list, urgent items

**Coming Up**:
The part of a **Digest** containing dated activities, deadlines, and **Calendar Suggestions** that the **Household** should anticipate.
_Avoid_: Calendar, schedule

**Good to Know**:
The part of a **Digest** containing relevant information that requires no present action from the **Household Owner**.
_Avoid_: Other, miscellaneous, FYI

**Calendar Suggestion**:
A proposed calendar entry derived from a **School Communication** that the **Household Owner** may review, edit, and confirm. It is not a calendar event until the **Household Owner** explicitly confirms it.
_Avoid_: Calendar event, automatic event

**Responsibility**:
Something the **Household Owner** must do or decide in response to a **School Communication**, supported by one or more **Claims**. A **Responsibility** is unresolved, completed, dismissed, or superseded; recurring responsibilities are represented as separate dated occurrences.
_Avoid_: Action, task, to-do

**Audience**:
The people or school group to whom information from a **School Communication** applies. An **Audience** may be child-specific, group-specific, school-wide, household-wide, or unresolved; the original audience wording is preserved even when it is resolved to one or more **Children**.
_Avoid_: Target, recipient, year-group tag

**Claim**:
A cited statement derived from a **School Communication** and used to support information in a **Digest**. A **Claim** is presented as confirmed, tentative, unclear and needing review, or contradicted by a later **School Communication**; numeric confidence scores are never shown to the **Household Owner**.
_Avoid_: Fact, extraction, confidence score

**Citation**:
The exact supporting passage from an immutable snapshot of a **School Communication** that grounds a **Claim**. Every **Claim** has at least one **Citation**, although the **Household Owner** may choose whether citations are visible in the **Digest**.
_Avoid_: Source link, footnote, evidence score

**Grounded Chat**:
A conversation in which Comms Digest answers from stored **Claims**, **Responsibilities**, **Citations**, and relevant **School Communications**. It refuses questions that cannot be supported and requires confirmation before causing any external change.
_Avoid_: Chatbot, general assistant, Q&A

## Example Dialogue

**Household Owner:** Did anything important come in from school this week?

**Comms Digest:** The latest **Digest** contains two **School Communications** relevant to your **Household**: a Year 4 swimming payment for one **Child**, and a whole-school closure notice relevant to both **Children**.

**Household Owner:** Add the swimming lesson to my calendar.

**Comms Digest:** Here is the **Calendar Suggestion**. Please confirm it before I add it.

**Household Owner:** I already paid for that trip.

**Comms Digest:** I have marked that **Responsibility** as completed.
