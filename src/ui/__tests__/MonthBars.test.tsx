import { render, screen } from '@testing-library/react-native';
import { MonthBars } from '../MonthBars';

const hidden = { includeHiddenElements: true };

describe('MonthBars', () => {
  it('is one image for screen readers, with values on the months that have one', async () => {
    await render(
      <MonthBars
        accessibilityLabel="Gasto previsto por mês. novembro: R$ 350,00."
        bars={[
          { key: 'nov', label: 'nov', cents: 35000, unknown: false },
          { key: 'dez', label: 'dez', cents: 0, unknown: false },
          { key: 'jan', label: 'jan', cents: 0, unknown: true },
          { key: 'fev', label: 'fev', cents: 7000, unknown: false },
        ]}
      />,
    );

    expect(
      screen.getByRole('image', { name: 'Gasto previsto por mês. novembro: R$ 350,00.' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('350', hidden)).toBeOnTheScreen();
    // No price on record: a "?" instead of a zero.
    expect(screen.getByText('?', hidden)).toBeOnTheScreen();
    // Bars scale to the largest month.
    expect(screen.getByTestId('bar-nov', hidden).children.at(-1)).toHaveStyle({ height: 96 });
    expect(screen.getByTestId('bar-fev', hidden).children.at(-1)).toHaveStyle({ height: 19 });
  });
});
