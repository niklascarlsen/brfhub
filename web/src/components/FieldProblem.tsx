// What is wrong with the field above, said while it is filled in. The
// field points to it, so a screen reader reads it with the field.
export function FieldProblem({id, message}: {id?: string; message: string}) {
  return (
    <p
      id={id}
      aria-live='polite'
      className='ml-0.5 mt-1.5 text-[13px] leading-5 text-theme-danger'
    >
      {message}
    </p>
  );
}
