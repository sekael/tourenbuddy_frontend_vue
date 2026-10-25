## ADDED Requirements

### Requirement: The search knows what is being picked

The picker SHALL pass what it picks (goal, start or end) to the search. For a start or end
point the search SHALL also find public-transport stops and SHALL list access places (stops,
stations, villages, huts and other buildings, addresses) before terrain (glaciers, ridges), also
among same-named places. A goal search SHALL keep the service order. Ranking SHALL never hide a
result.

#### Scenario: Start at the trailhead, not on the glacier

- **WHEN** the user picks a start near the Sustenhorn and searches "Steingletscher"
- **THEN** the hamlet Steingletscher and the bus stop "Steingletscher, Susten" SHALL be listed
  before the Steingletscher glacier

#### Scenario: Goal search unchanged

- **WHEN** the user picks a goal and searches "Steingletscher"
- **THEN** no stop SHALL be requested and the results SHALL keep the service's order with the
  nearest-first rule for same-named places

#### Scenario: A stop and a same-named place at one spot

- **WHEN** a stop and a gazetteer place share a name and lie within 150 m of each other
- **THEN** only one of them SHALL be listed

#### Scenario: Stops show their kind

- **WHEN** a stop is listed
- **THEN** its kind SHALL read as a localized "Public transport stop"

#### Scenario: The stop search fails

- **WHEN** the stop request fails while the place search succeeds
- **THEN** the place results SHALL still be shown without an error
