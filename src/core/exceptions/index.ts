/** Thrown when an operation requires authentication but no user session exists. */
export class UnauthenticatedUserException extends Error {
  constructor(message = 'User is not authenticated') {
    super(message)
    this.name = 'UnauthenticatedUserException'
  }
}

/** Thrown when the authenticated user is not authorized for the requested operation. */
export class UnauthorizedUserException extends Error {
  constructor(message = 'User is not authorized for this operation') {
    super(message)
    this.name = 'UnauthorizedUserException'
  }
}

/** Thrown when a user profile is expected to exist but is not found. */
export class NoUserProfileException extends Error {
  constructor(message = 'User profile does not exist') {
    super(message)
    this.name = 'NoUserProfileException'
  }
}

/** Thrown when a phone number string cannot be parsed to a valid international format. */
export class InvalidPhoneNumberError extends Error {
  constructor(
    message = 'Invalid phone number. Use international format (+41 79 012 34 56) or Swiss national format (079 012 34 56).',
  ) {
    super(message)
    this.name = 'InvalidPhoneNumberError'
  }
}

/** Thrown when a friendship operation requires a verified phone but the caller's phone is unverified. */
export class UnverifiedPhoneError extends Error {
  constructor(message = 'Phone number must be verified to use this feature') {
    super(message)
    this.name = 'UnverifiedPhoneError'
  }
}

/** Thrown when a friendship or friend request already exists between two users. */
export class FriendshipExistsError extends Error {
  constructor(message = 'A friendship or pending request already exists') {
    super(message)
    this.name = 'FriendshipExistsError'
  }
}
