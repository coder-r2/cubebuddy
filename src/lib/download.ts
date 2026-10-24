/** Save text as a file through a temporary link. */
export function download(text: string, filename: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Today as YYYYMMDD, for file names. */
export const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');
