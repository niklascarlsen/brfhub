function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  if ('cause' in error) {
    return pgErrorCode(error.cause);
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}

// The constraint or index a violation broke, to tell which rule refused
// the write.
export function violatedConstraint(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('constraint' in error && typeof error.constraint === 'string') {
    return error.constraint;
  }

  if ('cause' in error) {
    return violatedConstraint(error.cause);
  }

  return undefined;
}
