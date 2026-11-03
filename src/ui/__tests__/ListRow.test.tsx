import { render, screen, userEvent } from '@testing-library/react-native';
import { ListRow } from '../ListRow';
import { PlateChip } from '../PlateChip';

describe('ListRow', () => {
  it('is one button whose name carries the description', async () => {
    const onPress = jest.fn();
    await render(
      <ListRow
        icon="car"
        label="Seus carros"
        description="Trocar, renomear ou remover"
        onPress={onPress}
      />,
    );

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Seus carros. Trocar, renomear ou remover' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('PlateChip', () => {
  it('names the current car and opens the car list', async () => {
    const onPress = jest.fn();
    await render(<PlateChip nickname="Meu Sandero" onPress={onPress} />);

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Trocar de carro. Atual: Meu Sandero' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
