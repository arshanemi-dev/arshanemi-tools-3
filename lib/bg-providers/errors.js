export class ProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.status = status
  }
}
