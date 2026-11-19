# Seat Safari usability test plan

## Objectives

- Check whether students can find an appropriate empty seat and understand its status.
- Verify QR links select the correct seat and the feedback prompt does not block check-in.
- Check that check-in, checkout, 90-minute expiry, and 7:00 PM closure are understandable.
- Confirm the footer feedback form is easy to submit and gives a clear success state.

## Target users

Run one moderated round with 5–7 students who regularly use campus study spaces:

- At least 2 Central Library users, including someone seeking quiet reading and someone seeking charging access.
- At least 2 computer-lab users who sometimes study without a laptop.
- At least 1 student who has scanned a campus QR code or used a campus occupancy app.
- Include first-time and returning Seat Safari users. Participants can match more than one profile.

## Setup

- Use a test database and a campus-reachable URL for phone QR scans. A `localhost` QR code will not work from a separate phone.
- Confirm physical seat numbering before using operational QR labels. The Central Library per-area splits on Floors 2, 4, and 5 are provisional.
- Use a test fixture or controllable clock to simulate 90-minute expiry and 7:00 PM closure. Do not wait through the full lease or alter production data.
- Prepare at least one empty seat, one occupied seat, two devices, one valid QR label, and one invalid QR link.
- Use fictional feedback text; never include real passwords or sensitive information.

## Tasks and success signals

| ID | Target user | Task | Success signal |
|---|---|---|---|
| T1 | First-time Library student | Find the Floor 2 reading area with no charging ports and report its empty-seat count. | Reaches the correct area without help, recognizes the no-charging description, and reports the count shown within 60 seconds. |
| T2 | Library student | Select an empty seat and mark that they are using it. | Completes check-in and sees the seat marked occupied. A second open client sees the count update within 15 seconds. |
| T3 | Student using a phone | Scan a printed QR label and continue to the linked seat. | Correct building, floor, area, and seat appear. Feedback opens with the matching seat context. Student can dismiss it and check in. |
| T4 | Current seat occupant | Leave and mark the seat empty. | Checks out from the same browser device; another device cannot check out that seat. The empty count updates within 15 seconds. |
| T5 | Student without a laptop | Find a computer lab in an Academic Block and check in before closing. | Finds a Floor 3 lab, notices its 7:00 PM closing time, and marks an empty seat while open. |
| T6 | Student whose check-in expired | Advance the test clock to 90 minutes while they are still seated. | Understands that the seat was released, scans the same QR again, dismisses or submits the feedback prompt, and checks in again. |
| T7 | Student who has left | Advance the test clock to 90 minutes after they have left. | Understands the old check-in ended and clears the old “my seat” state without claiming another seat. |
| T8 | Student using a lab after closing | Try to check in after 7:00 PM, then check out a seat previously marked by that device. | New check-in is blocked with a clear closed message; checkout remains possible. |
| T9 | Any student | Use the footer to submit a suggestion, complaint, technical issue, or general feedback. | Selects a category, submits valid text, sees confirmation, and the feedback is stored with optional seat context. |
| T10 | Any student | Scan an invalid or retired QR code. | Understands that no seat was selected and can recover to normal browsing without a dead end. |

## Measures and release criteria

- At least 80% of participants complete T1–T5 and T9 without moderator help.
- Every valid QR scan in the test set selects the matching seat. Any wrong seat or area is a release blocker.
- Check-in and checkout produce no unexplained errors, and another open client reflects changes within 15 seconds.
- The 90-minute reminder clearly says the seat was released and scanning again is required to check back in.
- No participant believes the QR feedback form is required; record whether it interrupts or feels repetitive during a 90-minute re-scan.
- Closed labs never accept a new check-in after 7:00 PM India time; checkout remains available.
- Feedback submissions validate, persist, and show confirmation.
- Record completion, time on task, wrong turns, errors, requests for help, and a confidence rating from 1–5 after each task.

## Moderator script

### Opening

> Thanks for helping us evaluate Seat Safari. We’re testing the product, not you. Please think aloud and tell me what you expect each control to do. I won’t guide you unless you’re stuck. Use the test site and test data only; no seat is being reserved.

### QR task

> Please scan this test seat label with your phone. Continue as you normally would if you were sitting down to study.

After the feedback dialog appears, ask:

> What do you think this prompt is asking you to do? What would you do next?

Do not explain the dialog unless the participant asks for help. Record whether they submit, dismiss, or assume feedback is required before check-in.

### 90-minute reminder task

Advance the test clock or expire the participant’s test lease in the test database. Do not alter production occupancy data.

> Imagine you have been using this seat for about an hour and a half. Please continue based on what Seat Safari shows you.

### Closing questions

- What made it hard to tell which seats were empty, if anything?
- Did the QR scan take you to the seat you expected?
- Was the feedback prompt useful at that moment, or did it interrupt you?
- What would make you trust the displayed seat count more?
- On a scale of 1–5, how confident are you that you could find and mark a seat on your own?

## Results sheet: prior project iterations

The results are separated by source. The student-sourced cases below were received as suggestions during prior project iterations and converted into test tasks. They are not presented as completed student sessions or observed usability findings: no formal student sessions or participant confidence ratings were recorded. Internal implementation checks are identified separately.

### Stakeholder and internal project results

| Session / iteration | Source | Decisions or evidence | Follow-up |
|---|---|---|---|
| S1 - Scope definition | Stakeholder / project-owner requirements | Defined occupancy-only scope, five Central Library floors at 100 seats each, and no reservations. | Actual per-area seat counts were not supplied for Floor 2 or Areas A/B on Floors 4 and 5; seeded splits remain provisional. |
| S2 - Feedback experience | Internal UI and route verification | Verified the footer dialog, QR-triggered seat context, feedback categories, validation, and SQLite persistence. | No in-app staff inbox was included; add a review workflow if staff need to triage submissions inside Seat Safari. |
| S3 - Physical seat/QR pilot | Library and Academic Block locations | Not run; no physical seat map or campus QR placement was provided. | Confirm per-area capacity and seat placement, then scan printed labels on campus devices before launch. |

### Student-sourced test cases and observations received

The items in this table reflect cases or concerns received from students in prior iterations. Product behavior was verified internally where noted; the student scenarios still need to be run with participants to collect usability outcomes.

| Student-sourced case | Test-plan task and internal evidence | Follow-up / observation to collect |
|---|---|---|
| U1 - Academic Block access | Added Task T5: find a Floor 3 computer lab in an Academic Block, understand the 7:00 PM closing time, and check in before closing. Blocks 26, 27, 28, 29, 33, and 34 are configured with six 40-seat labs each; seed/API verification was completed. | Run with students; observe whether they find a lab and notice its closing time. Confirm configured lab names, seat counts, and operating hours against campus records. |
| U2 - QR-based seat marking | Added Tasks T3-T4: scan a seat QR, confirm its location, mark it occupied, and check out. Internal browser/API QA verified check-in/out, one-seat-per-device, QR labels, valid QR selection, and QR-triggered feedback; the QA seat was returned to empty. | Run with student participants and campus phones. Observe whether the QR selects the expected seat and whether the feedback prompt interrupts check-in. Static QR codes are self-reported and phone scans need a campus-reachable URL. |
| U3 - Expiry and closure | Added Tasks T6-T8: handle 90-minute expiry, rescan to check in again, and understand after-hours check-in and checkout. Automated tests verified expiry, stale-seat cleanup, one-seat-per-device, and clearing a lab seat after closing. | Run with students. Observe understanding of the expiry reminder and closed-lab message. Timer behavior used test fixtures, not a live 90-minute student session. |
| U4 - Formal student usability sessions | Target students; not run in the prior iterations. | Recruit 5-7 students and run Tasks T1-T10 before reporting usability success rates or confidence scores. |
