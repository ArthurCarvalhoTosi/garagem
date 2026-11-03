import { render, screen, userEvent } from '@testing-library/react-native';
import Settings from '@/app/(tabs)/settings';
import { router } from '@/test-utils/screens';

jest.mock('expo-router', () => require('@/test-utils/screens').expoRouterMock);

beforeEach(() => jest.clearAllMocks());

test.each([
  ['Seus carros. Trocar, renomear ou remover', '/vehicles'],
  ['Adicionar carro', '/onboarding'],
  ['Conta e sincronização. Cópia na nuvem e uso em outro celular', '/account'],
  ['Fazer backup. Salve um arquivo protegido por senha', '/backup'],
  ['Restaurar backup', '/restore'],
])('"%s" opens %s', async (name, path) => {
  await render(<Settings />);

  await userEvent.setup().press(screen.getByRole('button', { name }));

  expect(router.push).toHaveBeenCalledWith(path);
});
