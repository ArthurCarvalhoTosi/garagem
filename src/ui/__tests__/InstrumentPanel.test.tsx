import { act, render, screen, within } from '@testing-library/react-native';
import { InstrumentPanel, type Telltale } from '../InstrumentPanel';

const hidden = { includeHiddenElements: true };
const AMBER = '#F2B132';
const RED = '#FF5449';
const OFF = '#3A444B';

const lights: Telltale[] = [
  { key: 'oil', icon: 'oil', urgency: 'critical' },
  { key: 'tires', icon: 'car-tire-alert', urgency: 'attention' },
  { key: 'belt', icon: 'timing-belt', urgency: 'ok' },
];
const status = { urgency: 'critical' as const, text: 'Troca de óleo, passou 300 km' };

const colorOf = (key: string, icon: string) =>
  within(screen.getByTestId(`telltale-${key}`, hidden)).getByTestId(`icon-${icon}`, hidden).props
    .tintColor;

describe('InstrumentPanel', () => {
  afterEach(() => jest.useRealTimers());

  // First in the file: the ignition check runs once per app launch, so later renders skip it.
  it('lights everything for the ignition check, then only what counts', async () => {
    jest.useFakeTimers();
    await render(<InstrumentPanel km={50000} estimated lights={lights} status={status} />);

    expect(colorOf('belt', 'timing-belt')).toBe(AMBER);
    await act(async () => jest.advanceTimersByTime(1200));

    expect(colorOf('oil', 'oil')).toBe(RED);
    expect(colorOf('tires', 'car-tire-alert')).toBe(AMBER);
    expect(colorOf('belt', 'timing-belt')).toBe(OFF);
  });

  it('skips the ignition check after the first time', async () => {
    await render(<InstrumentPanel km={50000} lights={lights} status={status} />);

    expect(colorOf('belt', 'timing-belt')).toBe(OFF);
  });

  it('gives screen readers the drums and the status sentence, not the lights', async () => {
    await render(
      <InstrumentPanel
        km={50000}
        estimated
        lights={lights}
        status={{ ...status, detail: 'Mais 1 troca precisa de atenção.' }}
      />,
    );

    expect(screen.getByLabelText('Hodômetro estimado: 50.000 quilômetros')).toBeOnTheScreen();
    expect(screen.getByText('Troca de óleo, passou 300 km')).toBeOnTheScreen();
    expect(screen.getByText('Mais 1 troca precisa de atenção.')).toBeOnTheScreen();
    expect(screen.queryByTestId('telltales')).not.toBeOnTheScreen();
    expect(screen.getByTestId('telltales', hidden)).toBeOnTheScreen();
  });

  it('shows no row of lights for a car without items', async () => {
    await render(
      <InstrumentPanel km={0} lights={[]} status={{ urgency: 'ok', text: 'Tudo em dia.' }} />,
    );

    expect(screen.queryByTestId('telltales', hidden)).not.toBeOnTheScreen();
  });
});
