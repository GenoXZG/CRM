document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  document.querySelector('.toggler-btn')?.addEventListener('click', () => sidebar?.classList.toggle('collapsed'));
  document.querySelectorAll('.toggle-password').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    button.title = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
    button.querySelector('i').className = visible ? 'bi bi-eye-slash' : 'bi bi-eye';
  }));
  document.querySelectorAll('.user-form').forEach(form => {
    const password = form.elements.namedItem('password');
    const confirmation = form.elements.namedItem('confirmPassword');
    const feedback = form.querySelector('.password-feedback');
    function validate() {
      const mismatched = password.value !== confirmation.value;
      confirmation.setCustomValidity(mismatched ? 'Las contraseñas no coinciden.' : '');
      if (feedback) feedback.textContent = confirmation.value && mismatched ? 'Las contraseñas no coinciden.' : '';
      return !mismatched;
    }
    password.addEventListener('input', validate);
    confirmation.addEventListener('input', validate);
    form.addEventListener('submit', event => { if (!validate()) {event.preventDefault(); confirmation.reportValidity();} });
  });
  const email = document.getElementById('filterEmail'), role = document.getElementById('filterRole'), date = document.getElementById('filterDate');
  const rows = [...document.querySelectorAll('.user-row')];
  const count = document.getElementById('userCount');
  function cutoff(period) {
    if (!period) return null;
    const d = new Date();
    if (period === '7') d.setDate(d.getDate() - 7);
    else if (period === 'month') d.setMonth(d.getMonth() - 1);
    else if (period === 'sixmonths') d.setMonth(d.getMonth() - 6);
    else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
    return d;
  }
  function apply() {
    const query = email.value.trim().toLocaleLowerCase(), selectedRole = role.value, since = cutoff(date.value);
    let shown = 0;
    rows.forEach(row => {
      const match = row.dataset.email.toLocaleLowerCase().includes(query) && (!selectedRole || selectedRole === row.dataset.role) && (!since || new Date(row.dataset.date) >= since);
      row.hidden = !match;
      const edit = row.nextElementSibling;
      if (edit?.classList.contains('user-edit-row')) edit.hidden = !match;
      if (match) shown++;
    });
    count.textContent = String(shown);
    document.getElementById('noUsers').classList.toggle('d-none', shown !== 0);
  }
  [email, role, date].forEach(control => control.addEventListener(control === email ? 'input' : 'change', apply));
  document.getElementById('clearFilters').addEventListener('click', () => { email.value = ''; role.value = ''; date.value = ''; apply(); });
});
