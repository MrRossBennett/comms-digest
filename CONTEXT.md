# Comms Digest

Comms Digest helps a household understand and act on school communications concerning its students. The initial domain is intentionally school-specific; broader correspondence processing is a possible application of the underlying approach, not part of the product language.

## Language

**Household**:
The family unit whose school communications and responsibilities are collected into one view. A **Household** has one **Household Owner**, one or more **Schools**, and one or more **Students** in the first version. It receives one combined **Digest** across all of its **Schools**.
_Avoid_: Account, tenant, customer

**Household Owner**:
The adult responsible for configuring a **Household** and reviewing its **Digest**. The first version has exactly one **Household Owner** per **Household**.
_Avoid_: User, administrator, parent account

**Demo Household**:
A clearly labelled synthetic **Household** used to let an authenticated **Household Owner** experience Comms Digest before onboarding is available. It must not be presented as belonging to the **Household Owner** or replace the future creation of their own **Household**.
_Avoid_: Default household, sample account

**Student**:
A young person in a **Household** whose **School** and school year help determine which communications are relevant.
The first version stores only a display name chosen by the **Household Owner**, school year, optional class, and **School**. A first name or nickname is sufficient; surnames, dates of birth, gender, and other identifiers are not collected.
_Avoid_: Child, pupil, dependent

**School**:
An educational organisation attended by one or more **Students** in a **Household** and responsible for issuing relevant **School Communications**. Each **Student** belongs to one **School** in the first version; a **Household** may contain multiple **Schools**.
_Avoid_: Institution, organisation, provider

**School Communication**:
A message or document issued by a school or school-related service that may contain information or responsibilities relevant to one or more **Students**.
Once fetched from a confirmed **Communication Source**, its source text is stored as an immutable snapshot. Its School and selected-Student boundary is inherited from **Source Review** and cannot be widened by extraction or reconciliation.
_Avoid_: Correspondence, content, document

**Communication Source**:
An email domain used by a recurring origin of **School Communications**, such as a School or school messaging service. It includes messages from every sender address at that domain, so a **Household Owner** does not need to configure each office, teacher, club, or newsletter address separately. A confirmed **Communication Source** may be relevant to one or more **Students** or the whole **Household**.
Discovery stores the sender domain, a representative sender identity, message count, and most recent date only. Message subjects and bodies are not persisted during discovery.
_Avoid_: Sender rule, Gmail filter, contact

**Source Review**:
The onboarding step in which the **Household Owner** confirms, rejects, and assigns discovered **Communication Sources** before the first **Digest** is produced.
Gmail permission is requested separately from sign-in and is read-only. A confirmed **Communication Source** applies to the whole **Household**, one **School**, or selected **Students** at one **School**.
_Avoid_: Inbox setup, sender configuration

**Digest**:
A prioritised view of relevant information and responsibilities derived from **School Communications** for a **Household**. It is organised into **Act Now**, **Coming Up**, and **Good to Know**.
The first version is refreshed manually. Repeated fetches skip already-seen external message identifiers and rebuild one combined **Digest** from the Household's stored evidence.
The **Household Owner** may dismiss a **Digest** item that is not useful. Dismissal is stored against its underlying **Claims** and **Responsibilities**, not the generated Digest row, so it survives refreshes and can be reopened later. Newly added evidence makes a changed item visible again until the Household Owner reviews it.
_Avoid_: Summary, feed, newsletter

**Ingestion scaling boundary**:
The beta performs Gmail discovery and communication fetching synchronously, with conservative per-mailbox request concurrency and retries for temporary provider limits. This is appropriate for early usage but is not the final ingestion architecture.
Each manual beta fetch processes at most ten new Gmail messages, limits each stored and model-processed source snapshot to 20,000 characters, and limits model extraction output to 2,000 tokens per message.
At scale, ingestion should move to a durable background queue with per-**Household** scan locks, bounded concurrency across accounts, retry backoff with jitter, incremental Gmail history-based sync, observable progress and failures, project-quota monitoring, and explicit per-run AI spend limits.

**Act Now**:
The part of a **Digest** containing unresolved **Responsibilities** that require the **Household Owner** to do or decide something, usually by a stated deadline.
_Avoid_: To-do list, urgent items

**Coming Up**:
The part of a **Digest** containing dated activities, deadlines, and **Calendar Suggestions** that the **Household** should anticipate.
_Avoid_: Calendar, schedule

**Good to Know**:
The part of a **Digest** containing relevant information that requires no present action from the **Household Owner**.
_Avoid_: Other, miscellaneous, FYI

**Day Plan**:
A projection of a **Household**'s **Digest** narrowed to a single date: what the **Household** must do, what each **Student** must bring, and what is coming up. It draws on the same evidence as the **Digest** but is anchored to one day, so a **Household Owner** can prepare for that day without piecing communications together.
The same **Day Plan** is seen from two vantage points. Viewed in the app on the day it describes, it is the **Household Owner**'s "Today's to-dos". Composed the evening before and delivered to the **Household Owner**, it is surfaced as "For tomorrow…". When viewed live it reflects the latest evidence and resolved **Responsibilities**; when delivered, that evening's **Day Plan** is kept as a fixed record of what was sent.
The **Digest** remains the standing, undated backlog reviewed in the app; the **Day Plan** is the dated, prepare-for-the-day view.
_Avoid_: Daily digest, reminder, notification, tomorrow's digest

**Delivery Contact**:
The verified means by which a **Household Owner** has chosen to receive their **Day Plan** away from the app, together with their explicit, revocable consent to be contacted there. A **Delivery Contact** is unverified until the **Household Owner** proves it is theirs, then opted-in until they opt out; only a verified, opted-in **Delivery Contact** receives a **Day Plan**, and opting out stops delivery without discarding the contact.
_Avoid_: Phone number, subscription, notification setting

**Calendar Suggestion**:
A proposed calendar entry derived from a **School Communication** that the **Household Owner** may review, edit, and confirm. It is not a calendar event until the **Household Owner** explicitly confirms it.
_Avoid_: Calendar event, automatic event

**Responsibility**:
Something the **Household Owner** must do or decide in response to a **School Communication**, supported by one or more **Claims**. A **Responsibility** is unresolved, completed, dismissed, or superseded; a later **School Communication** may supersede it when the underlying activity is cancelled or changed, unless that communication says the responsibility remains. Recurring responsibilities are represented as separate dated occurrences.
_Avoid_: Action, task, to-do

**Audience**:
The people or school group to whom information from a **School Communication** applies. An **Audience** may be student-specific, group-specific, school-wide, household-wide, or unresolved; the original audience wording is preserved even when it is resolved to one or more **Students**.
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

**Household Routine**:
Structured recurring information entered by the **Household Owner** when it may not appear in a **School Communication**, such as PE days, clubs, or library days. A **Household Routine** applies to one or more **Students**, may be associated with a **School**, repeats on selected weekdays, and may have start and end dates.
The next occurrence appears in the **Digest**, while **Grounded Chat** can use the full recurring pattern. It remains clearly identified as Household-added information and is never represented as a **School Communication**, **Claim**, or **Citation**.
_Avoid_: Manual Claim, recurring School Communication, calendar event

## Example Dialogue

**Household Owner:** Did anything important come in from school this week?

**Comms Digest:** The latest **Digest** contains two **School Communications** relevant to your **Household**: a Year 4 swimming payment for one **Student**, and a whole-school closure notice relevant to both **Students**.

**Household Owner:** Add the swimming lesson to my calendar.

**Comms Digest:** Here is the **Calendar Suggestion**. Please confirm it before I add it.

**Household Owner:** I already paid for that trip.

**Comms Digest:** I have marked that **Responsibility** as completed.
