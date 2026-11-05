// Applying a row limit resets only this catalog's page through its GET form.
for (const select of document.querySelectorAll<HTMLSelectElement>('select[name$="_size"]')) {
  select.addEventListener('change', () => select.form?.requestSubmit());
}
