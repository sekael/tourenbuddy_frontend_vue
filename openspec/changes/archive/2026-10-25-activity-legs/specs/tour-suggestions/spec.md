## ADDED Requirements

### Requirement: Activity suggestions carry the legs

An activity suggestion on a split tour SHALL carry the legs, and accepting it SHALL set them. A
suggestion without legs SHALL keep the tour's legs only while they still match its activities.

#### Scenario: A friend suggests flying down

- **WHEN** a partner suggests hiking up and paragliding down for a hiking tour and the owner accepts
- **THEN** the tour SHALL have hiking up and paragliding down
