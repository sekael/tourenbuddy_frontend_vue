## ADDED Requirements

### Requirement: Users can delete their own account
The Worker SHALL offer `POST /account/delete`, authenticated by the caller's Supabase JWT and acting only on the verified caller. It SHALL delete every Storage object whose first path segment is the caller's id in `tour-gpx` and `tour-attachments`, then the caller's auth user. If deleting objects fails, it SHALL keep the account and answer with an error, so the call can be retried.

#### Scenario: Deletion succeeds
- **WHEN** a signed-in user calls `POST /account/delete`
- **THEN** their GPX and attachment files are gone from both buckets, their auth user is deleted, and the answer is 200

#### Scenario: No or invalid token
- **WHEN** the call carries no JWT or one Supabase rejects
- **THEN** the answer is 401 and nothing is deleted

#### Scenario: Storage fails
- **WHEN** a Storage delete call fails
- **THEN** the answer is 502, the auth user still exists, and a later call deletes what is left

### Requirement: Deleting an account removes its data silently
Deleting an auth user SHALL remove every row of that user in `public` (profile, tours with their partners, outings, attachments rows, links and suggestions, contacts and methods, friendships, friend requests, blocks, availability, calendar feeds and settings, notifications, release note state, push subscriptions and device tokens) through foreign keys, SHALL keep abuse reports with the user's id set to null, and SHALL emit no notification to any other user.

#### Scenario: User with friends and shared tours
- **WHEN** a user who has friends, friends-visible tours, a tour link and a pending suggestion is deleted without a session
- **THEN** none of their rows remain, the friends' inboxes gain no entry, and the friends' own tours and links to others are intact

#### Scenario: Reports survive anonymized
- **WHEN** a user who reported someone, and was reported, is deleted
- **THEN** both reports remain with that user's id null

### Requirement: Account deletion in the web app
The PWA profile sheet SHALL offer "Delete account", which confirms in a dialog naming what is deleted and that it cannot be undone, then calls the deletion route and signs out. A failure SHALL leave the user signed in with a localized error.

#### Scenario: User confirms
- **WHEN** the user confirms the dialog and the route answers 200
- **THEN** the app signs out and shows sign-in

#### Scenario: Offline or route failure
- **WHEN** the call fails
- **THEN** the user stays signed in and sees a localized error
