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

export class MissingDocumentFontsError extends Error {
  missingFonts: Array<{
    family: string;
    fullName: string;
    postscriptName: string;
    style: string;
  }>;

  constructor(
    missingFonts: Array<{
      family: string;
      fullName: string;
      postscriptName: string;
      style: string;
    }>
  ) {
    const labels = missingFonts.map((font) => font.fullName).join(", ");
    super(`Missing fonts: ${labels}`);
    this.name = "MissingDocumentFontsError";
    this.missingFonts = missingFonts;
  }
}
