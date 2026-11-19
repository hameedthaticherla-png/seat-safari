# Seat Safari user-flow diagram

## Scope

Seat Safari helps students find and self-report currently empty seats in the Central Library and Academic Block computer labs. It does not reserve seats. Check-ins expire after 90 minutes, and Academic Block labs close at 7:00 PM.

## Flow

```mermaid
flowchart TD
    Start([Open Seat Safari]) --> Entry{How did the student arrive?}

    Entry -->|Browse| Building[Choose Central Library or Academic Block]
    Building --> Floor[Choose floor]
    Floor --> Area[Choose area or computer lab]
    Area --> Counts[Review empty count and seat status]
    Counts --> Choose[Select an empty seat]

    Entry -->|Scan seat QR| Resolve{Does the QR identify a configured seat?}
    Resolve -->|Yes| QRFeedback[Feedback dialog opens with seat context]
    QRFeedback --> FeedbackChoice{Send feedback or continue?}
    FeedbackChoice -->|Send feedback| QRFeedbackSaved[Feedback saved; success shown]
    FeedbackChoice -->|Not now or close| SeatDetails[Show the linked seat]
    QRFeedbackSaved --> SeatDetails
    Resolve -->|No| BrowseDefault[Show the normal seat-finding page]
    BrowseDefault --> Building
    Choose --> SeatDetails

    SeatDetails --> SeatState{Is the seat available now?}
    Counts --> SeatState
    SeatState -->|Occupied by someone else| PickAnother[Choose another empty seat]
    PickAnother --> Counts
    SeatState -->|Empty and space is open| CheckIn[Tap “I'm using this seat”]
    SeatState -->|Occupied by this device| CheckOut[Tap “I've left this seat”]
    SeatState -->|Lab is closed| Closed[Show closed status; prevent new check-in]

    CheckIn --> ServerCheck{Does the server accept check-in?}
    ServerCheck -->|No: taken, closed, or device already has a seat| Explain[Show reason and refresh status]
    Explain --> Counts
    ServerCheck -->|Yes| Occupied[Seat marked occupied for up to 90 minutes]
    Occupied --> Lease{Student leaves or lease expires?}
    Lease -->|Leaves| CheckOut
    Lease -->|90 minutes| Released[Seat released; reminder says to scan its QR again]
    Released --> StillThere{Is the student still there?}
    StillThere -->|Yes| Entry
    StillThere -->|No| Done([Finish])
    CheckOut --> EmptyAgain[Seat becomes available]
    EmptyAgain --> Counts

    AnyStep[Any point in the flow] --> Footer[Open feedback from the page footer]
    Footer --> FooterForm[Feedback dialog opens without seat context]
    FooterForm -->|Send| FooterSaved[Feedback saved; success shown]
    FooterForm -->|Close| Resume[Return to the current page state]
    FooterSaved --> Resume
```

## Notes

- Occupancy is self-reported. A printed QR code selects a seat but does not verify physical presence.
- A valid QR link opens the feedback dialog before showing the seat controls. Students can close it and continue.
- An expired seat must be scanned again before a student can mark it occupied again.
- Central Library area splits on Floors 2, 4, and 5 are provisional until actual per-area counts are confirmed.
