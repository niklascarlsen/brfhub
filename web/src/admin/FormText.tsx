// A form's explanation under its fields.
export function Note({children}: {children: string}) {
  return <p className='text-[13px] leading-5 text-theme-muted'>{children}</p>;
}

// What came of saving the form.
export function Status({message}: {message: string | null}) {
  return message ? (
    <p role='status' className='text-sm text-theme-ink'>
      {message}
    </p>
  ) : null;
}
