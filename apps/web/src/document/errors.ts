export class DocumentParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DocumentParseError";
  }
}

export class DocumentValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DocumentValidationError";
  }
}

export class UnsupportedDocumentVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedDocumentVersionError";
  }
}
