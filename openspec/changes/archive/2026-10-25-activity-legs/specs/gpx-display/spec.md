## ADDED Requirements

### Requirement: Lines per leg

A split tour's connector lines SHALL wear the colours of their own leg (start → goal the way-up
activities, goal → end the way-down ones). A single-line GPX track of a split tour SHALL change
from the way-up colours to the way-down colours at the track point nearest the goal.

#### Scenario: Hike & fly track

- **WHEN** a hike & fly tour has a GPX track walking to the summit and flying to the valley
- **THEN** the track SHALL be drawn in the hiking colour up to the summit and in the paragliding
  colour after it
