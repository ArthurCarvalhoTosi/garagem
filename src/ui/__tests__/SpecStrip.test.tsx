import { render, screen, userEvent } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { AccessibilityInfo } from 'react-native';
import { SpecStrip, type SpecItem } from '../SpecStrip';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const items: SpecItem[] = [
  { key: 'oil', icon: 'oil', label: 'Óleo', value: '5W-30 Sintético' },
  { key: 'tire', icon: 'car-tire-alert', label: 'Calibragem', value: null },
];

describe('SpecStrip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows "Adicionar" for an empty value and calls onEdit when tapped', async () => {
    const onEdit = jest.fn();
    await render(<SpecStrip items={items} onEdit={onEdit} />);

    expect(screen.getByText('Adicionar')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Calibragem: Adicionar' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('copies a filled value on long press and announces it', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<SpecStrip items={items} onEdit={jest.fn()} />);
    const plaque = screen.getByLabelText('Óleo: 5W-30 Sintético');

    expect(plaque).toHaveProp('accessibilityHint', 'Toque longo para copiar');
    await userEvent.setup().longPress(plaque);

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('5W-30 Sintético');
    expect(announce).toHaveBeenCalledWith('Copiado');
    expect(await screen.findByText('Copiado')).toBeOnTheScreen();
  });

  it('has an "Editar" button that calls onEdit', async () => {
    const onEdit = jest.fn();
    await render(<SpecStrip items={items} onEdit={onEdit} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Editar' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('invites to fill in when every value is empty', async () => {
    const onEdit = jest.fn();
    const empty = items.map((i) => ({ ...i, value: null }));
    await render(<SpecStrip items={empty} onEdit={onEdit} />);

    expect(screen.getByText('Guarde óleo e calibragem para consultar no posto.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Óleo: Adicionar' })).not.toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Adicionar' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
