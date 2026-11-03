import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, ListRow, Screen, Section, space } from '@/ui';

export default function Settings() {
  return (
    <Screen scroll tab>
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        Ajustes
      </AppText>
      <Section title="Carros">
        <View>
          <ListRow
            icon="car"
            label="Seus carros"
            description="Trocar, renomear ou remover"
            onPress={() => router.push('/vehicles')}
          />
          <ListRow icon="plus" label="Adicionar carro" onPress={() => router.push('/onboarding')} />
        </View>
      </Section>
      <Section title="Seus dados">
        <View>
          <ListRow
            icon="account"
            label="Conta e sincronização"
            description="Cópia na nuvem e uso em outro celular"
            onPress={() => router.push('/account')}
          />
          <ListRow
            icon="backup"
            label="Fazer backup"
            description="Salve um arquivo protegido por senha"
            onPress={() => router.push('/backup')}
          />
          <ListRow
            icon="restore"
            label="Restaurar backup"
            onPress={() => router.push('/restore')}
          />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.xl },
});
