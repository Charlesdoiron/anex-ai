export class JobCancelledError extends Error {
  constructor(message = "Extraction cancelled") {
    super(message)
    this.name = "JobCancelledError"
  }
}
