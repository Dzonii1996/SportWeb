import { render, screen } from '@testing-library/react';
import App from './App';

// Početna strana učitava termine; u testu server ne postoji
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ success: true, matches: [] }) })
  );
  localStorage.clear();
});

test('početna strana se prikazuje sa navigacijom', async () => {
  render(<App />);

  expect(screen.getByText(/Pronađi ekipu/)).toBeInTheDocument();
  expect(screen.getAllByText('Registracija').length).toBeGreaterThan(0);

  // Bez termina se nudi pravljenje prvog
  expect(await screen.findByText('Još nema zakazanih termina.')).toBeInTheDocument();
});
